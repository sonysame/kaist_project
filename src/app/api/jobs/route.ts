import { BUCKET, supabaseAdmin } from "@/lib/supabase-server";
import { audioPath, chunkLayout, chunkPath } from "@/lib/layout";
import { currentUser, unauthorized } from "@/lib/auth";
import { DAILY_UPLOAD_LIMIT, recordUpload, uploadsToday } from "@/lib/quota";
import { SAMPLE_JOB_ID } from "@/lib/sample";

// 32kbps mono MP3 기준 Supabase 무료 플랜 파일 한도(50MB)에 들어가는 길이
const MAX_DURATION_SEC = 3.3 * 3600;

const LIST_COLUMNS = "id, filename, duration_sec, chunk_count, status, error, created_at";

/** 내 학습 자료 목록. 샘플은 누구에게나(로그인하지 않아도) 맨 앞에 보여 준다. */
export async function GET() {
  const user = await currentUser();
  const db = supabaseAdmin();
  const [sample, mine] = await Promise.all([
    db.from("jobs").select(LIST_COLUMNS).eq("id", SAMPLE_JOB_ID).maybeSingle(),
    user
      ? db.from("jobs").select(LIST_COLUMNS).eq("user_id", user.id).neq("id", SAMPLE_JOB_ID).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sample.error || mine.error) return Response.json({ error: (sample.error ?? mine.error)!.message }, { status: 500 });
  const list = [...(sample.data ? [{ ...sample.data, is_sample: true }] : []), ...(mine.data ?? [])];
  return Response.json(list);
}

/** 작업을 만들고, 브라우저가 오디오를 바로 Storage에 올릴 수 있는 서명 URL을 돌려준다. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { filename, durationSec } = (await request.json()) as { filename?: string; durationSec?: number };
  if (!filename || !durationSec || !(durationSec > 0)) {
    return Response.json({ error: "파일 이름과 길이가 필요해요." }, { status: 400 });
  }
  if (durationSec > MAX_DURATION_SEC) {
    return Response.json({ error: "3시간 20분이 넘는 오디오는 아직 지원하지 않아요." }, { status: 400 });
  }

  // 하루 업로드 제한 (한국 시간 기준, 지운 작업도 셈)
  if ((await uploadsToday(user.id)) >= DAILY_UPLOAD_LIMIT) {
    return Response.json(
      { error: `오늘은 ${DAILY_UPLOAD_LIMIT}개까지 올릴 수 있어요. 내일 다시 올려 주세요.`, limitReached: true },
      { status: 429 },
    );
  }

  const db = supabaseAdmin();
  const layout = chunkLayout(durationSec);
  const { data: job, error } = await db
    .from("jobs")
    .insert({ filename, duration_sec: durationSec, chunk_count: layout.length, user_id: user.id })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await recordUpload(user.id);

  const { error: chunkError } = await db
    .from("chunks")
    .insert(layout.map((c) => ({ job_id: job.id, idx: c.idx, start_sec: c.start, end_sec: c.end })));
  if (chunkError) return Response.json({ error: chunkError.message }, { status: 500 });

  const storage = db.storage.from(BUCKET);
  const paths = [audioPath(job.id), ...layout.map((c) => chunkPath(job.id, c.idx))];
  const signed = await Promise.all(paths.map((p) => storage.createSignedUploadUrl(p)));
  const failed = signed.find((s) => s.error);
  if (failed?.error) return Response.json({ error: failed.error.message }, { status: 500 });

  const uploads = signed.map((s) => ({ path: s.data!.path, token: s.data!.token }));
  return Response.json({ id: job.id, layout, full: uploads[0], chunks: uploads.slice(1) });
}
