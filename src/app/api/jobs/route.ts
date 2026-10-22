import { BUCKET, supabaseAdmin } from "@/lib/supabase-server";
import { audioPath, chunkLayout, chunkPath } from "@/lib/layout";
import { currentUser, unauthorized } from "@/lib/auth";
import { MAX_PART_SEC, durationText } from "@/lib/audio-limits";
import { getUploadLimit, recordUpload, uploadsToday } from "@/lib/quota";
import { SAMPLE_JOB_IDS } from "@/lib/sample";

const LIST_COLUMNS = "id, filename, duration_sec, chunk_count, status, error, created_at";

/** 내 학습 자료 목록. 샘플은 누구에게나(로그인하지 않아도) 맨 앞에 보여 준다. */
export async function GET() {
  const user = await currentUser();
  const db = supabaseAdmin();
  const [samples, mine] = await Promise.all([
    db.from("jobs").select(LIST_COLUMNS).in("id", SAMPLE_JOB_IDS).order("created_at"),
    user
      ? db
          .from("jobs")
          .select(LIST_COLUMNS)
          .eq("user_id", user.id)
          .not("id", "in", `(${SAMPLE_JOB_IDS.join(",")})`)
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (samples.error || mine.error) return Response.json({ error: (samples.error ?? mine.error)!.message }, { status: 500 });
  const list = [...(samples.data ?? []).map((j) => ({ ...j, is_sample: true })), ...(mine.data ?? [])];
  return Response.json(list);
}

/** 작업을 만들고, 브라우저가 오디오를 바로 Storage에 올릴 수 있는 서명 URL을 돌려준다. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { filename, durationSec, previousPartId } = (await request.json()) as {
    filename?: string;
    durationSec?: number;
    previousPartId?: string; // 긴 파일의 2부를 만들 때 1부 작업 ID
  };
  if (!filename || !durationSec || !(durationSec > 0)) {
    return Response.json({ error: "파일 이름과 길이가 필요해요." }, { status: 400 });
  }
  // 긴 파일은 브라우저가 1부·2부로 나눠서 보낸다. 한 부분은 파일 하나(50MB)에 들어가는 길이까지.
  if (durationSec > MAX_PART_SEC + 60) {
    return Response.json({ error: `${durationText(MAX_PART_SEC)}이 넘는 부분은 올릴 수 없어요.` }, { status: 400 });
  }

  const db = supabaseAdmin();
  // 2부는 1부와 같은 파일이라 업로드 횟수를 다시 세지 않는다. 방금 만든 내 1부일 때만.
  let previous: { id: string } | null = null;
  if (previousPartId) {
    const { data, error: prevError } = await db
      .from("jobs")
      .select("id, user_id, created_at, next_part_id")
      .eq("id", previousPartId)
      .maybeSingle();
    if (prevError) {
      return Response.json({ error: `긴 파일을 나눠 올리려면 migrations/006_parts.sql이 필요해요. (${prevError.message})` }, { status: 500 });
    }
    const fresh = data && Date.now() - new Date(data.created_at).getTime() < 3 * 3600_000;
    if (!data || data.user_id !== user.id || data.next_part_id || !fresh) {
      return Response.json({ error: "1부를 찾을 수 없어요. 파일을 처음부터 다시 올려 주세요." }, { status: 400 });
    }
    previous = data;
  } else {
    // 하루 업로드 제한 (한국 시간 기준, 지운 작업도 셈)
    const limit = await getUploadLimit();
    if ((await uploadsToday(user.id)) >= limit) {
      return Response.json(
        { error: `오늘은 ${limit}개까지 올릴 수 있어요. 내일 다시 올려 주세요.`, limitReached: true },
        { status: 429 },
      );
    }
  }

  const layout = chunkLayout(durationSec);
  const { data: job, error } = await db
    .from("jobs")
    .insert({ filename, duration_sec: durationSec, chunk_count: layout.length, user_id: user.id })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (previous) {
    const { error: linkError } = await db.from("jobs").update({ next_part_id: job.id }).eq("id", previous.id);
    if (linkError) {
      return Response.json(
        { error: `1부와 2부를 잇지 못했어요. migrations/006_parts.sql을 실행했는지 확인해 주세요. (${linkError.message})` },
        { status: 500 },
      );
    }
  } else {
    await recordUpload(user.id);
  }

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
