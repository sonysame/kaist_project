import { BUCKET, supabaseAdmin } from "@/lib/supabase-server";
import { audioPath, chunkLayout, chunkPath } from "@/lib/layout";

// 32kbps mono MP3 기준 Supabase 무료 플랜 파일 한도(50MB)에 들어가는 길이
const MAX_DURATION_SEC = 3.3 * 3600;

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("jobs")
    .select("id, filename, duration_sec, chunk_count, status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

/** 작업을 만들고, 브라우저가 오디오를 바로 Storage에 올릴 수 있는 서명 URL을 돌려준다. */
export async function POST(request: Request) {
  const { filename, durationSec } = (await request.json()) as { filename?: string; durationSec?: number };
  if (!filename || !durationSec || !(durationSec > 0)) {
    return Response.json({ error: "파일 이름과 길이가 필요해요." }, { status: 400 });
  }
  if (durationSec > MAX_DURATION_SEC) {
    return Response.json({ error: "3시간 20분이 넘는 오디오는 아직 지원하지 않아요." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const layout = chunkLayout(durationSec);
  const { data: job, error } = await db
    .from("jobs")
    .insert({ filename, duration_sec: durationSec, chunk_count: layout.length })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

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
