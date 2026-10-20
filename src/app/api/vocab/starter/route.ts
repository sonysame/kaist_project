import { supabaseAdmin } from "@/lib/supabase-server";
import { STARTER_JOB_ID, STARTER_WORDS } from "@/lib/starter-vocab";

/** 이 브라우저의 단어장이 비어 있을 때만 기본 단어를 넣는다. 넣은 개수를 돌려준다. */
export async function POST(request: Request) {
  const device = request.headers.get("x-device-id");
  if (!device || !/^[0-9a-f-]{36}$/i.test(device)) {
    return Response.json({ error: "기기 ID가 없어요." }, { status: 400 });
  }
  if (!STARTER_WORDS.length) return Response.json({ inserted: 0 });

  const db = supabaseAdmin();
  const { count, error: countError } = await db
    .from("vocab")
    .select("id", { count: "exact", head: true })
    .eq("device_id", device);
  if (countError) return Response.json({ error: countError.message }, { status: 500 });
  if (count) return Response.json({ inserted: 0 });

  // 예문이 나온 녹음이 아직 있으면 "들으러 가기" 링크를 붙인다 (지워졌으면 링크 없이)
  const { data: job } = await db.from("jobs").select("id").eq("id", STARTER_JOB_ID).maybeSingle();
  const { error } = await db.from("vocab").upsert(
    STARTER_WORDS.map((w) => ({
      ...w,
      device_id: device,
      job_id: job ? STARTER_JOB_ID : null,
      start_sec: job ? w.start_sec : null,
    })),
    { onConflict: "device_id,lemma", ignoreDuplicates: true },
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ inserted: STARTER_WORDS.length });
}
