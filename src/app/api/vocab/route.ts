import { supabaseAdmin } from "@/lib/supabase-server";
import { currentUser, unauthorized } from "@/lib/auth";
import { isSampleJob } from "@/lib/sample";

const COLUMNS = "id, word, lemma, part_of_speech, meaning_ko, sentence_en, sentence_ko, job_id, start_sec, created_at";

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { data, error } = await supabaseAdmin()
    .from("vocab")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const b = await request.json();
  if (!b.word || !b.lemma || !b.meaning_ko || !b.sentence_en) {
    return Response.json({ error: "단어 정보가 부족해요." }, { status: 400 });
  }
  const db = supabaseAdmin();
  // "들으러 가기" 링크는 내 작업이나 샘플일 때만 붙인다
  let jobId: string | null = null;
  if (typeof b.job_id === "string") {
    const { data: job } = await db.from("jobs").select("user_id").eq("id", b.job_id).maybeSingle();
    if (job && (job.user_id === user.id || isSampleJob(b.job_id))) jobId = b.job_id;
  }
  const { data, error } = await db
    .from("vocab")
    .upsert(
      {
        user_id: user.id,
        word: String(b.word).slice(0, 60),
        lemma: String(b.lemma).slice(0, 60),
        part_of_speech: b.part_of_speech ? String(b.part_of_speech).slice(0, 20) : null,
        meaning_ko: String(b.meaning_ko).slice(0, 200),
        sentence_en: String(b.sentence_en).slice(0, 2000),
        sentence_ko: b.sentence_ko ? String(b.sentence_ko).slice(0, 2000) : null,
        job_id: jobId,
        start_sec: jobId && typeof b.start_sec === "number" ? b.start_sec : null,
      },
      { onConflict: "user_id,lemma" },
    )
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const id = Number(new URL(request.url).searchParams.get("id"));
  const { error } = await supabaseAdmin().from("vocab").delete().eq("user_id", user.id).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
