import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCorrections, joinWords, type Correction } from "./corrections";
import type { UtteranceWord } from "./types";

/** 작업의 모든 발화에 교정을 적용하고, 바뀐 발화만 저장한다. 바뀐 발화의 ID를 돌려준다 (다시 해석하려고). */
export async function applyTranscriptCorrections(db: SupabaseClient, jobId: string, corrections: Correction[]): Promise<number[]> {
  if (!corrections.length) return [];
  const { data: rows, error } = await db.from("utterances").select("id, words").eq("job_id", jobId);
  if (error) throw new Error(error.message);

  const updates: { id: number; words: UtteranceWord[] }[] = [];
  for (const row of rows ?? []) {
    const { words, changed } = applyCorrections(row.words as UtteranceWord[], corrections);
    if (!changed) continue;
    updates.push({ id: row.id, words });
  }
  // 한꺼번에 너무 많이 보내지 않도록 20개씩
  for (let i = 0; i < updates.length; i += 20) {
    await Promise.all(
      updates
        .slice(i, i + 20)
        .map((u) => db.from("utterances").update({ words: u.words, text_en: joinWords(u.words) }).eq("id", u.id)),
    );
  }

  // 이 녹음에서 단어장에 저장한 예문도 같은 규칙으로 고친다 (예문은 저장 당시 문장을 복사해 둔 것이라)
  const { data: vocab } = await db.from("vocab").select("id, sentence_en").eq("job_id", jobId);
  for (const v of vocab ?? []) {
    const tokens = (v.sentence_en as string).split(" ").map((t) => ({ t, s: 0, e: 0 }));
    const { words, changed } = applyCorrections(tokens, corrections);
    if (changed) await db.from("vocab").update({ sentence_en: joinWords(words) }).eq("id", v.id);
  }
  return updates.map((u) => u.id);
}
