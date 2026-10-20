import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { Definition, Word } from "./types";
import { cleanCorrections, type Correction } from "./corrections";

const TRANSCRIBE_MODEL = process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-3.5-transcribe";
// 3.8-flash는 무료 등급에서 40줄 번역에 2분 넘게 걸려 함수 제한 시간에 걸린다. flash-lite는 5초 안팎.
const TRANSLATE_MODEL = process.env.GEMINI_TRANSLATE_MODEL || "gemini-3.5-flash-lite";

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 환경 변수가 없습니다.");
  return new GoogleGenAI({ apiKey });
}

/** 무료 한도 초과(429)를 구분해서 화면에 알려 주기 위한 에러 */
export class RateLimitError extends Error {}

function rethrow(err: unknown): never {
  const status = (err as { status?: number })?.status;
  const msg = err instanceof Error ? err.message : String(err);
  if (status === 429 || /429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    throw new RateLimitError("Gemini 무료 사용 한도에 도달했어요. 잠시 후 다시 시도해 주세요.");
  }
  throw err instanceof Error ? err : new Error(msg);
}

const seconds = (offset: unknown) => (typeof offset === "string" ? parseFloat(offset) : Number(offset ?? 0));

/** 오디오 구간 하나를 화자 분리 + 단어 타임스탬프와 함께 전사한다. offset은 원본 기준 구간 시작 시각. */
export async function transcribeChunk(audio: Blob, offset: number): Promise<Word[]> {
  const ai = client();
  try {
    const file = await ai.files.upload({ file: audio, config: { mimeType: "audio/mpeg" } });
    try {
      const interaction = await ai.interactions.create({
        model: TRANSCRIBE_MODEL,
        input: [{ type: "audio", uri: file.uri!, mime_type: "audio/mpeg" }],
        generation_config: {
          transcription_config: {
            language_codes: ["en-US"],
            mode: { type: "verbatim", diarization_mode: "speaker", timestamp_granularities: ["word"] },
          },
        },
      } as never);
      return extractWords(interaction, offset);
    } finally {
      if (file.name) await ai.files.delete({ name: file.name }).catch(() => {});
    }
  } catch (err) {
    rethrow(err);
  }
}

type RawAnnotation = { type?: string; text?: string; speaker?: string; start_offset?: string; end_offset?: string };
type RawInteraction = { steps?: { content?: { annotations?: RawAnnotation[] }[] }[] };

function extractWords(interaction: unknown, offset: number): Word[] {
  const words: Word[] = [];
  for (const step of (interaction as RawInteraction).steps ?? []) {
    for (const content of step.content ?? []) {
      for (const a of content.annotations ?? []) {
        if (a.type !== "word_info" || !a.text) continue;
        words.push({
          text: a.text,
          start: offset + seconds(a.start_offset),
          end: offset + seconds(a.end_offset),
          speaker: a.speaker || "spk_1",
        });
      }
    }
  }
  return words;
}

/** 문장 속 단어의 기본형과 문맥에 맞는 한국어 뜻을 알려 준다. */
export async function defineWord(word: string, sentence: string): Promise<Definition> {
  const ai = client();
  const prompt = [
    "You help Korean learners of English. Explain the word as it is used in this sentence.",
    `Sentence: ${sentence}`,
    `Word: ${word}`,
    "Return JSON: lemma (dictionary form in English, lowercase unless a proper noun),",
    "part_of_speech (Korean, e.g. 명사, 동사, 형용사, 부사, 구동사, 관용구),",
    "meaning_ko (the Korean meaning that fits this sentence, short — one or two expressions, no example sentence).",
  ].join("\n");
  try {
    const res = await ai.models.generateContent({
      model: TRANSLATE_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lemma: { type: Type.STRING },
            part_of_speech: { type: Type.STRING },
            meaning_ko: { type: Type.STRING },
          },
          required: ["lemma", "part_of_speech", "meaning_ko"],
        },
      },
    });
    return JSON.parse(res.text ?? "{}") as Definition;
  } catch (err) {
    rethrow(err);
  }
}

export type TranscriptAnalysis = { adIds: number[]; names: Record<string, string> };

/**
 * 대본 전체를 한 번 읽고 (1) 광고·후원사 소개 문장과 (2) 화자 이름을 찾는다.
 * 이름은 자기소개나 서로 부르는 말로 확실할 때만 넣고, 모르면 비워 둔다.
 */
export async function analyzeTranscript(lines: { id: number; speaker: string; text: string }[]): Promise<TranscriptAnalysis> {
  const ai = client();
  const speakers = [...new Set(lines.map((l) => l.speaker))];
  const prompt = [
    "Below is a speaker-labeled transcript (format: id|speaker|text). Do two things.",
    "1) ads: list the ids of every line that belongs to an advertisement or sponsor read —",
    "   e.g. thanking a sponsor, describing a sponsor's product, promo codes or URLs, 'this episode is brought to you by'.",
    "   Include the whole ad block, from its lead-in line to its last line. Do NOT include normal discussion",
    "   that merely mentions a company as part of the episode's topic. If there are no ads, return an empty list.",
    `2) speakers: for each label (${speakers.join(", ")}), give the person's name if the transcript makes it clear —`,
    "   a self-introduction ('I'm Ben Gilbert'), or another speaker addressing them by name right before they reply.",
    "   Use the fullest form that is stated (e.g. 'Ben Gilbert'). If unsure, use an empty string. Never invent names.",
    "",
    lines.map((l) => `${l.id}|${l.speaker}|${l.text}`).join("\n"),
  ].join("\n");

  try {
    const res = await ai.models.generateContent({
      model: TRANSLATE_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ad_ids: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            speakers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { label: { type: Type.STRING }, name: { type: Type.STRING } },
                required: ["label", "name"],
              },
            },
          },
          required: ["ad_ids", "speakers"],
        },
      },
    });
    const parsed = JSON.parse(res.text ?? "{}") as { ad_ids?: number[]; speakers?: { label: string; name: string }[] };
    const valid = new Set(lines.map((l) => l.id));
    return {
      adIds: (parsed.ad_ids ?? []).filter((id) => valid.has(id)),
      names: Object.fromEntries(
        (parsed.speakers ?? [])
          .filter((s) => speakers.includes(s.label) && s.name.trim())
          .map((s) => [s.label, s.name.trim().slice(0, 40)]),
      ),
    };
  } catch (err) {
    rethrow(err);
  }
}

// flash-lite는 아는 정보가 오래돼서 광고 속 실제 제품명까지 엉뚱하게 바꿨다. 교정만은 더 정확한 모델로 따로 요청한다.
const CORRECTION_MODEL = process.env.GEMINI_CORRECTION_MODEL || "gemini-3.5-flash";

/**
 * 음성 인식이 고유명사를 비슷한 소리의 평범한 단어로 적은 곳을 찾는다 (예: "10 Cent" → "Tencent").
 * 이미 고유명사로 적힌 이름은 모델이 모르는 것이어도 바꾸지 않도록 엄격하게 지시한다.
 */
export async function findCorrections(lines: { id: number; speaker: string; text: string }[]): Promise<Correction[]> {
  const ai = client();
  const prompt = [
    "Below is an automatic speech-recognition transcript (format: id|speaker|text).",
    "Find places where the recognizer wrote a proper noun (company, product, person, place) as ORDINARY words or numbers",
    "that merely sound like it — for example '10 Cent' written for 'Tencent', or 'we chat' for 'WeChat'.",
    "Strict rules:",
    "- The wrong phrase must be made of common dictionary words or numbers (or an obviously broken spelling of a name that",
    "  the conversation itself spells correctly elsewhere). Never replace one real-looking proper noun with a different one.",
    "- Your knowledge may be out of date: sponsors, products, models and people you do not recognize are probably real.",
    "  Leave them unchanged. Never 'update' versions, product names or numbers.",
    "- Only include a correction when the conversation topic makes it unambiguous. When in doubt, leave it out.",
    "Return JSON {corrections:[{wrong, right}]} using the wrong phrase exactly as it appears. Return an empty list if none.",
    "",
    lines.map((l) => `${l.id}|${l.speaker}|${l.text}`).join("\n"),
  ].join("\n");

  try {
    const res = await ai.models.generateContent({
      model: CORRECTION_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            corrections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { wrong: { type: Type.STRING }, right: { type: Type.STRING } },
                required: ["wrong", "right"],
              },
            },
          },
          required: ["corrections"],
        },
      },
    });
    const parsed = JSON.parse(res.text ?? "{}") as { corrections?: Correction[] };
    return cleanCorrections(parsed.corrections ?? []);
  } catch (err) {
    rethrow(err);
  }
}

type TranslateInput = { id: number; speaker: string; text: string };

/** 발화 목록을 한국어로 번역한다. context는 바로 앞 발화들(번역 결과 포함)로, 문맥을 이어 가는 데 쓴다. */
export async function translateUtterances(
  items: TranslateInput[],
  context: { speaker: string; en: string; ko: string }[],
): Promise<Map<number, string>> {
  if (items.length === 0) return new Map();
  const ai = client();
  const prompt = [
    "You are a professional English→Korean interpreter translating a transcript of a recording.",
    "Translate each utterance into natural, fluent Korean that fits a spoken conversation.",
    "Keep the meaning faithful, keep proper nouns recognizable, and drop pure filler words (um, uh) unless they carry meaning.",
    "Translate every item; return the same id for each one. Return only JSON.",
    context.length
      ? `Previous lines for context (already translated, do not return them):\n${context
          .map((c) => `[${c.speaker}] ${c.en}\n→ ${c.ko}`)
          .join("\n")}`
      : "",
    `Utterances to translate:\n${JSON.stringify(items)}`,
  ].join("\n\n");

  try {
    const res = await ai.models.generateContent({
      model: TRANSLATE_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { id: { type: Type.INTEGER }, ko: { type: Type.STRING } },
            required: ["id", "ko"],
          },
        },
      },
    });
    const parsed = JSON.parse(res.text ?? "[]") as { id: number; ko: string }[];
    return new Map(parsed.map((p) => [p.id, p.ko]));
  } catch (err) {
    rethrow(err);
  }
}
