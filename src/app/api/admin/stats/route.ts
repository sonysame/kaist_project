import { BUCKET, supabaseAdmin } from "@/lib/supabase-server";
import { currentUser, isAdmin, unauthorized } from "@/lib/auth";
import { getUploadLimit, startOfTodayKST } from "@/lib/quota";
import { dailyLimits, startOfGeminiDay } from "@/lib/gemini-usage";
import { getModels } from "@/lib/models";
import { isSampleJob } from "@/lib/sample";

// Supabase 무료 플랜 한도 (관리자 화면의 막대 그래프 기준)
const FREE_STORAGE_BYTES = 1024 ** 3; // 파일 저장 1GB
const FREE_DB_BYTES = 500 * 1024 ** 2; // 데이터베이스 500MB

/** 관리자 페이지: 전체 사용량, 저장 공간, 사용자 목록 */
export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (!isAdmin(user)) return Response.json({ error: "관리자만 볼 수 있어요." }, { status: 403 });

  const db = supabaseAdmin();
  const today = startOfTodayKST().toISOString();
  const geminiDay = startOfGeminiDay();
  const [users, jobs, vocab, uploads, dbSize, storage, geminiLog, models, uploadLimit] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from("jobs").select("id, user_id, status, filename, duration_sec, created_at").order("created_at", { ascending: false }),
    db.from("vocab").select("user_id"),
    db.from("upload_log").select("user_id").gte("created_at", today),
    db.rpc("admin_db_size"),
    storageUsage(),
    db.from("gemini_log").select("model, kind, status, input_tokens, output_tokens").gte("created_at", geminiDay.toISOString()),
    getModels(),
    getUploadLimit(),
  ]);
  const err = users.error ?? jobs.error ?? vocab.error ?? uploads.error;
  if (err) return Response.json({ error: err.message }, { status: 500 });

  const count = (rows: { user_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.user_id) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const jobsBy = count(jobs.data);
  const vocabBy = count(vocab.data);
  const uploadsBy = count(uploads.data);
  const emailOf = new Map(users.data.users.map((u) => [u.id, u.email ?? ""]));

  const statusCount = { processing: 0, done: 0, error: 0, uploading: 0 } as Record<string, number>;
  let totalSeconds = 0;
  for (const j of jobs.data ?? []) {
    statusCount[j.status] = (statusCount[j.status] ?? 0) + 1;
    totalSeconds += j.duration_sec;
  }

  // 오늘(Gemini 한도 기준) 모델별 사용량. 지금 쓰는 모델은 기록이 없어도 0으로 보여 준다.
  const limits = dailyLimits();
  const usage = new Map<string, { model: string; calls: number; rateLimited: number; errors: number; inputTokens: number; outputTokens: number }>();
  const row = (model: string) => {
    if (!usage.has(model)) usage.set(model, { model, calls: 0, rateLimited: 0, errors: 0, inputTokens: 0, outputTokens: 0 });
    return usage.get(model)!;
  };
  for (const m of Object.values(models)) row(m);
  for (const g of geminiLog.data ?? []) {
    const r = row(g.model);
    if (g.status === "ok") r.calls++;
    else if (g.status === "rate_limited") r.rateLimited++;
    else r.errors++;
    r.inputTokens += g.input_tokens ?? 0;
    r.outputTokens += g.output_tokens ?? 0;
  }

  return Response.json({
    gemini: {
      since: geminiDay.toISOString(),
      logReady: !geminiLog.error,
      models,
      usage: [...usage.values()].map((u) => ({ ...u, limit: limits[u.model] ?? null })),
    },
    totals: {
      users: users.data.users.length,
      jobs: jobs.data?.length ?? 0,
      audioHours: totalSeconds / 3600,
      vocab: vocab.data?.length ?? 0,
      uploadsToday: uploads.data?.length ?? 0,
      uploadLimit,
      status: statusCount,
    },
    storage: { files: storage.files, bytes: storage.bytes, limit: FREE_STORAGE_BYTES },
    database: { bytes: dbSize.error ? null : Number(dbSize.data), limit: FREE_DB_BYTES },
    users: users.data.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        name: (u.user_metadata?.full_name as string | undefined) ?? "",
        avatar: (u.user_metadata?.avatar_url as string | undefined) ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        jobs: jobsBy.get(u.id) ?? 0,
        uploadsToday: uploadsBy.get(u.id) ?? 0,
        vocab: vocabBy.get(u.id) ?? 0,
        admin: isAdmin(u),
      }))
      .sort((a, b) => (b.lastSignInAt ?? "").localeCompare(a.lastSignInAt ?? "")),
    recentJobs: (jobs.data ?? []).map((j) => ({
      id: j.id,
      filename: j.filename,
      status: j.status,
      durationSec: j.duration_sec,
      createdAt: j.created_at,
      owner: j.user_id ? (emailOf.get(j.user_id) ?? "") : "(주인 없음)",
      isSample: isSampleJob(j.id),
    })),
  });
}

/** audio 버킷의 파일 수와 전체 크기. 작업 폴더마다 안의 파일을 세어 더한다. */
async function storageUsage() {
  const storage = supabaseAdmin().storage.from(BUCKET);
  let files = 0;
  let bytes = 0;
  const { data: folders } = await storage.list("", { limit: 1000 });
  for (const folder of folders ?? []) {
    if (folder.id) continue; // 맨 위에 바로 놓인 파일은 없다 (폴더만 있음)
    const { data: items } = await storage.list(folder.name, { limit: 1000 });
    for (const f of items ?? []) {
      files++;
      bytes += Number((f.metadata as { size?: number } | null)?.size ?? 0);
    }
  }
  return { files, bytes };
}
