import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** from 화자의 문장을 모두 into 화자로 옮긴다. 다음 구간도 into로 이어지게 구간별 연결표도 고친다. */
export async function mergeSpeakers(db: SupabaseClient, jobId: string, from: string, into: string) {
  const { error } = await db.from("utterances").update({ speaker: into }).eq("job_id", jobId).eq("speaker", from);
  if (error) throw new Error(error.message);
  const { data: chunks } = await db.from("chunks").select("idx, speaker_map").eq("job_id", jobId);
  for (const c of chunks ?? []) {
    const map = (c.speaker_map ?? {}) as Record<string, string>;
    if (!Object.values(map).includes(from)) continue;
    const fixed = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v === from ? into : v]));
    await db.from("chunks").update({ speaker_map: fixed }).eq("job_id", jobId).eq("idx", c.idx);
  }
}
