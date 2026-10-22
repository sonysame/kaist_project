import "server-only";
import { supabaseAdmin } from "./supabase-server";
import { findCorrections, summarizeTranscript, translateUtterances } from "./gemini";
import { applyTranscriptCorrections } from "./corrections-db";
import { logError } from "./error-log";

// 처리 마지막 단계 중 실패해도 처리를 멈추지 않고 건너뛰는 것들.
// 관리자 페이지 오류 기록의 "해결" 버튼으로 하나씩 다시 실행할 수 있게 따로 둔다.

const TRANSLATE_BATCH = 80;

/** 고유명사를 고친 문장만 골라 한국어 해석을 다시 만든다 */
export async function retranslate(ids: number[]) {
  const db = supabaseAdmin();
  for (let i = 0; i < ids.length; i += TRANSLATE_BATCH) {
    const { data: rows } = await db
      .from("utterances")
      .select("id, speaker, text_en")
      .in("id", ids.slice(i, i + TRANSLATE_BATCH));
    if (!rows?.length) continue;
    const ko = await translateUtterances(rows.map((u) => ({ id: u.id, speaker: u.speaker, text: u.text_en })), []);
    await Promise.all(
      rows.filter((u) => ko.get(u.id)).map((u) => db.from("utterances").update({ text_ko: ko.get(u.id) }).eq("id", u.id)),
    );
  }
}

/**
 * 잘못 들은 고유명사를 고치고 (예: 10 Cent → Tencent), 고친 문장의 해석을 다시 만든다.
 * 해석은 구간마다 교정 전에 만들어 둔 것이라서. 다시 해석이 실패하면 예전 해석을 두고 오류만 남긴다.
 */
export async function correctJob(jobId: string) {
  const db = supabaseAdmin();
  const { data: lines } = await db.from("utterances").select("id, speaker, text_en").eq("job_id", jobId).order("start_sec");
  if (!lines?.length) return;
  const input = lines.map((l) => ({ id: l.id, speaker: l.speaker, text: l.text_en }));
  const fixedIds = await applyTranscriptCorrections(db, jobId, await findCorrections(input));
  try {
    await retranslate(fixedIds);
  } catch (err) {
    await logError({ jobId, step: "다시 해석", error: err, skipped: true, detail: { ids: fixedIds } });
  }
}

/** 학습 자료 화면 맨 위에서 캐릭터가 말해 줄 한 줄 요약 (광고 제외, 화자는 이름으로) */
export async function summarizeJob(jobId: string) {
  const db = supabaseAdmin();
  const { data: job } = await db.from("jobs").select("speaker_names").eq("id", jobId).maybeSingle();
  const names = (job?.speaker_names ?? {}) as Record<string, string>;
  const { data: lines } = await db
    .from("utterances")
    .select("speaker, text_en, is_ad")
    .eq("job_id", jobId)
    .order("start_sec");
  const content = (lines ?? []).filter((l) => !l.is_ad);
  if (!content.length) return;
  const label = (spk: string) => names[spk] ?? `화자 ${spk.slice(1)}`;
  const summary = await summarizeTranscript(content.map((l) => ({ speaker: label(l.speaker), text: l.text_en })));
  if (summary) await db.from("jobs").update({ summary }).eq("id", jobId);
}
