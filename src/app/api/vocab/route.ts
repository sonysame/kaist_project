import { supabaseAdmin } from "@/lib/supabase-server";

// 로그인 대신 브라우저가 만든 익명 ID로 단어장을 구분한다.
function deviceId(request: Request) {
  const id = request.headers.get("x-device-id");
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

const noDevice = () => Response.json({ error: "기기 ID가 없어요." }, { status: 400 });

export async function GET(request: Request) {
  const device = deviceId(request);
  if (!device) return noDevice();
  const { data, error } = await supabaseAdmin()
    .from("vocab")
    .select("id, word, lemma, part_of_speech, meaning_ko, sentence_en, sentence_ko, job_id, start_sec, created_at")
    .eq("device_id", device)
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(request: Request) {
  const device = deviceId(request);
  if (!device) return noDevice();
  const b = await request.json();
  if (!b.word || !b.lemma || !b.meaning_ko || !b.sentence_en) {
    return Response.json({ error: "단어 정보가 부족해요." }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin()
    .from("vocab")
    .upsert(
      {
        device_id: device,
        word: String(b.word).slice(0, 60),
        lemma: String(b.lemma).slice(0, 60),
        part_of_speech: b.part_of_speech ? String(b.part_of_speech).slice(0, 20) : null,
        meaning_ko: String(b.meaning_ko).slice(0, 200),
        sentence_en: String(b.sentence_en).slice(0, 2000),
        sentence_ko: b.sentence_ko ? String(b.sentence_ko).slice(0, 2000) : null,
        job_id: b.job_id ?? null,
        start_sec: typeof b.start_sec === "number" ? b.start_sec : null,
      },
      { onConflict: "device_id,lemma" },
    )
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function DELETE(request: Request) {
  const device = deviceId(request);
  if (!device) return noDevice();
  const id = Number(new URL(request.url).searchParams.get("id"));
  const { error } = await supabaseAdmin().from("vocab").delete().eq("device_id", device).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
