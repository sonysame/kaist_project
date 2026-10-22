import { BUCKET, supabaseAdmin } from "@/lib/supabase-server";
import { chunkPath } from "@/lib/layout";
import { RateLimitError, analyzeTranscript, findCorrections, summarizeTranscript, transcribeChunk, translateUtterances } from "@/lib/gemini";
import { mergeSpeakers } from "@/lib/speakers";
import { requireJobOwner } from "@/lib/auth";
import { applyTranscriptCorrections } from "@/lib/corrections-db";
import { dailyLimitReached, nextGeminiReset } from "@/lib/gemini-usage";
import { getModel } from "@/lib/models";
import { buildUtterances, chooseCut, keepRange, mapSpeakers } from "@/lib/pipeline";
import type { Word } from "@/lib/types";

// 20분 구간 전사는 1~2분 걸릴 수 있다. Vercel Hobby 플랜의 최대값.
export const maxDuration = 300;

const TRANSLATE_BATCH = 80;

type ChunkRow = {
  idx: number;
  start_sec: number;
  end_sec: number;
  status: "pending" | "transcribed" | "translated";
  keep_until: number | null;
};

/**
 * 처리를 한 단계만 진행한다. 브라우저가 끝날 때까지 이 API를 반복 호출한다.
 * 구간 순서대로 [전사 → 번역]을 하므로 앞부분 결과부터 화면에 나타난다.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/jobs/[id]/step">) {
  const { id } = await ctx.params;
  const auth = await requireJobOwner(id);
  if ("error" in auth) return auth.error;
  const db = supabaseAdmin();

  const { data: job } = await db.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) return Response.json({ error: "작업을 찾을 수 없어요." }, { status: 404 });
  if (job.status === "uploading") return Response.json({ error: "아직 업로드 중이에요." }, { status: 409 });
  if (job.status === "done") return Response.json({ done: true });

  const { data: chunks } = await db
    .from("chunks")
    .select("idx, start_sec, end_sec, status, keep_until")
    .eq("job_id", id)
    .order("idx")
    .returns<ChunkRow[]>();
  const chunk = chunks?.find((c) => c.status !== "translated");

  try {
    if (job.status === "error") await db.from("jobs").update({ status: "processing", error: null }).eq("id", id);

    // 이 단계에 쓸 모델의 하루 한도를 이미 다 썼으면 Gemini를 부르지 않고 내일 이어서 하라고 알린다
    if (await dailyLimitReached(await getModel(chunk?.status === "pending" ? "transcribe" : "text"))) {
      throw new RateLimitError("오늘 Gemini 무료 한도를 다 썼어요.", true);
    }

    // 모든 구간이 끝나면 마지막으로 대본 전체를 읽고 광고 표시 + 화자 이름 추측
    if (!chunk) {
      if (!job.analyzed) await analyze(id, job.speaker_names ?? {});
      await db.from("jobs").update({ status: "done", error: null, analyzed: true }).eq("id", id);
      // 받아 적기가 끝난 구간 파일은 더 쓰지 않으니 지워서 저장 공간을 아낀다 (재생은 full.mp3)
      await db.storage
        .from(BUCKET)
        .remove((chunks ?? []).map((c) => chunkPath(id, c.idx)))
        .catch((e) => console.error("구간 파일을 지우지 못함:", e));
      return Response.json({ done: true, action: "analyzed" });
    }

    if (chunk.status === "pending") {
      await transcribe(id, chunk, chunks!, job.next_speaker_no);
      return Response.json({ done: false, action: "transcribed", chunk: chunk.idx });
    }
    await translate(id, chunk);
    return Response.json({ done: false, action: "translated", chunk: chunk.idx });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof RateLimitError) {
      return Response.json(
        { error: message, rateLimited: true, daily: err.daily, resumeAt: err.daily ? nextGeminiReset().toISOString() : null },
        { status: 429 },
      );
    }
    console.error(err);
    await db.from("jobs").update({ status: "error", error: message }).eq("id", id);
    if (chunk) await db.from("chunks").update({ error: message }).eq("job_id", id).eq("idx", chunk.idx);
    return Response.json({ error: message }, { status: 500 });
  }
}

async function analyze(jobId: string, userNames: Record<string, string>) {
  const db = supabaseAdmin();
  const { data: lines } = await db
    .from("utterances")
    .select("id, speaker, text_en")
    .eq("job_id", jobId)
    .order("start_sec");
  if (!lines?.length) return;

  const input = lines.map((l) => ({ id: l.id, speaker: l.speaker, text: l.text_en }));
  const { adIds, names } = await analyzeTranscript(input);

  // 잘못 들은 고유명사 고치기 (예: 10 Cent → Tencent). 실패해도 대본은 그대로 두고 넘어간다.
  try {
    await applyTranscriptCorrections(db, jobId, await findCorrections(input));
  } catch (err) {
    console.error("고유명사 교정을 건너뜀:", err);
  }

  await db.from("utterances").update({ is_ad: false }).eq("job_id", jobId);
  for (let i = 0; i < adIds.length; i += 200) {
    await db.from("utterances").update({ is_ad: true }).in("id", adIds.slice(i, i + 200));
  }

  // 사용자가 직접 바꾼 이름이 우선. 같은 이름이 붙은 화자는 같은 사람이니 번호가 빠른 쪽으로 합친다.
  const merged = { ...names, ...userNames };
  const byName = new Map<string, string[]>();
  for (const [spk, name] of Object.entries(merged)) {
    const key = name.toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), spk]);
  }
  for (const group of byName.values()) {
    const [into, ...rest] = group.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    for (const from of rest) {
      await mergeSpeakers(db, jobId, from, into);
      delete merged[from];
    }
  }
  await db.from("jobs").update({ speaker_names: merged }).eq("id", jobId);

  // 학습 자료 화면 맨 위에 보여 줄 3~5줄 요약. 실패해도 대본은 그대로 두고 넘어간다.
  try {
    const ads = new Set(adIds);
    const { data: fixed } = await db.from("utterances").select("id, speaker, text_en").eq("job_id", jobId).order("start_sec");
    const content = (fixed ?? []).filter((l) => !ads.has(l.id));
    const label = (spk: string) => merged[spk] ?? `화자 ${spk.slice(1)}`;
    const summary = await summarizeTranscript(content.map((l) => ({ speaker: label(l.speaker), text: l.text_en })));
    if (summary.length) await db.from("jobs").update({ summary }).eq("id", jobId);
  } catch (err) {
    console.error("요약을 건너뜀:", err);
  }
}

async function transcribe(jobId: string, chunk: ChunkRow, chunks: ChunkRow[], nextSpeakerNo: number) {
  const db = supabaseAdmin();
  const storage = db.storage.from(BUCKET);

  const { data: audio, error } = await storage.download(chunkPath(jobId, chunk.idx));
  if (error || !audio) throw new Error(`구간 ${chunk.idx + 1} 오디오를 불러오지 못했어요: ${error?.message}`);

  const words = await transcribeChunk(audio, chunk.start_sec);

  // 앞 구간과 화자 연결
  let prev: { words: Word[]; map: Record<string, string>; keep_until: number | null } | null = null;
  if (chunk.idx > 0) {
    const { data } = await db
      .from("chunks")
      .select("words, speaker_map, keep_until")
      .eq("job_id", jobId)
      .eq("idx", chunk.idx - 1)
      .single();
    prev = { words: data!.words ?? [], map: data!.speaker_map ?? {}, keep_until: data!.keep_until };
  }
  const { map, nextSpeakerNo: next } = mapSpeakers(
    words,
    prev,
    { start: chunk.start_sec, end: chunks[chunk.idx - 1]?.end_sec ?? chunk.start_sec },
    nextSpeakerNo,
  );

  // 다음 구간과 겹치는 부분에서 자를 위치를 정하고, 이 구간이 맡을 범위의 단어만 남긴다
  const nextChunk = chunks[chunk.idx + 1];
  const keepUntil = nextChunk ? chooseCut(words, { start: nextChunk.start_sec, end: chunk.end_sec }) : null;
  const kept = keepRange(words, prev?.keep_until ?? 0, keepUntil ?? Infinity);
  const utterances = buildUtterances(kept, map);

  await db.from("utterances").delete().eq("job_id", jobId).eq("chunk_idx", chunk.idx);
  if (utterances.length) {
    const { error: insertError } = await db.from("utterances").insert(
      utterances.map((u) => ({
        job_id: jobId,
        chunk_idx: chunk.idx,
        speaker: u.speaker,
        start_sec: u.start,
        end_sec: u.end,
        text_en: u.text,
        words: u.words,
      })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  await db
    .from("chunks")
    .update({ status: "transcribed", words, speaker_map: map, keep_until: keepUntil, error: null })
    .eq("job_id", jobId)
    .eq("idx", chunk.idx);
  await db.from("jobs").update({ next_speaker_no: next }).eq("id", jobId);
  // 전사가 끝난 구간 파일은 더 필요 없으니 Storage 용량을 아끼려고 지운다
  await storage.remove([chunkPath(jobId, chunk.idx)]);
}

/** 번역이 안 된 발화를 최대 TRANSLATE_BATCH개 번역한다. 구간 번역이 다 끝나면 true. */
async function translate(jobId: string, chunk: ChunkRow): Promise<boolean> {
  const db = supabaseAdmin();
  const { data: todo } = await db
    .from("utterances")
    .select("id, speaker, start_sec, text_en")
    .eq("job_id", jobId)
    .eq("chunk_idx", chunk.idx)
    .is("text_ko", null)
    .order("start_sec")
    .limit(TRANSLATE_BATCH);

  if (todo?.length) {
    const { data: before } = await db
      .from("utterances")
      .select("speaker, text_en, text_ko")
      .eq("job_id", jobId)
      .lt("start_sec", todo[0].start_sec)
      .not("text_ko", "is", null)
      .order("start_sec", { ascending: false })
      .limit(4);
    const context = (before ?? []).reverse().map((u) => ({ speaker: u.speaker, en: u.text_en, ko: u.text_ko! }));

    const ko = await translateUtterances(
      todo.map((u) => ({ id: u.id, speaker: u.speaker, text: u.text_en })),
      context,
    );
    // 모델이 빠뜨린 줄은 빈 문자열로 두어 같은 줄을 끝없이 다시 요청하지 않게 한다
    await Promise.all(
      todo.map((u) => db.from("utterances").update({ text_ko: ko.get(u.id) ?? "" }).eq("id", u.id)),
    );
    if (todo.length === TRANSLATE_BATCH) return false;
  }

  await db.from("chunks").update({ status: "translated", error: null }).eq("job_id", jobId).eq("idx", chunk.idx);
  return true;
}
