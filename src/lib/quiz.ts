import type { VocabEntry } from "./types";

export type QuestionKind = "meaning" | "word" | "cloze";

export type Question = {
  kind: QuestionKind;
  entry: VocabEntry;
  /** 문제로 보여 줄 내용 (단어, 뜻, 또는 빈칸이 들어간 문장) */
  prompt: string;
  /** 빈칸 문제일 때 문장 해석 */
  hint?: string | null;
  choices: string[];
  answer: number;
};

export const MIN_WORDS = 4;
const CHOICES = 4;
export const BLANK = "_____";

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 예문에서 저장한 단어(대소문자 무시, 단어 경계)를 빈칸으로 바꾼다. 못 찾으면 null */
export function blankOut(sentence: string, word: string): string | null {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\p{L}\\p{N}'])${esc}(?=$|[^\\p{L}\\p{N}'])`, "iu");
  if (!re.test(sentence)) return null;
  return sentence.replace(re, (_m, pre: string) => `${pre}${BLANK}`);
}

/** 정답 하나와 다른 단어에서 고른 오답 3개로 보기를 만든다. 같은 글자의 보기는 겹치지 않게 한다. */
function makeChoices(
  correct: string,
  pool: VocabEntry[],
  pick: (v: VocabEntry) => string,
  rand: () => number,
): { choices: string[]; answer: number } | null {
  const seen = new Set([correct.toLowerCase()]);
  const wrong: string[] = [];
  for (const v of shuffle(pool, rand)) {
    const c = pick(v);
    if (!c || seen.has(c.toLowerCase())) continue;
    seen.add(c.toLowerCase());
    wrong.push(c);
    if (wrong.length === CHOICES - 1) break;
  }
  if (wrong.length < CHOICES - 1) return null;
  const choices = shuffle([correct, ...wrong], rand);
  return { choices, answer: choices.indexOf(correct) };
}

/**
 * 단어장으로 문제를 만든다. 단어마다 세 유형 중 하나를 돌아가며 고르고,
 * 빈칸 문제를 만들 수 없는 단어(예문에서 못 찾음)는 다른 유형으로 바꾼다.
 */
export function buildQuiz(
  items: VocabEntry[],
  { count = 10, targets, rand = Math.random }: { count?: number; targets?: VocabEntry[]; rand?: () => number } = {},
): Question[] {
  if (items.length < MIN_WORDS) return [];
  // targets가 있으면 그 단어들만 문제로 내고(틀린 단어 다시 풀기), 오답 보기는 전체 단어장에서 고른다
  const picked = shuffle(targets ?? items, rand).slice(0, Math.min(count, (targets ?? items).length));
  const kinds: QuestionKind[] = ["meaning", "cloze", "word"];

  const out: Question[] = [];
  picked.forEach((entry, i) => {
    const others = items.filter((v) => v.id !== entry.id);
    const order = [kinds[i % 3], ...kinds.filter((k) => k !== kinds[i % 3])];
    for (const kind of order) {
      const q = makeQuestion(kind, entry, others, rand);
      if (q) {
        out.push(q);
        return;
      }
    }
  });
  return out;
}

function makeQuestion(kind: QuestionKind, entry: VocabEntry, others: VocabEntry[], rand: () => number): Question | null {
  if (kind === "meaning") {
    const c = makeChoices(entry.meaning_ko, others, (v) => v.meaning_ko, rand);
    return c && { kind, entry, prompt: entry.lemma, ...c };
  }
  if (kind === "word") {
    const c = makeChoices(entry.lemma, others, (v) => v.lemma, rand);
    return c && { kind, entry, prompt: entry.meaning_ko, ...c };
  }
  // 빈칸: 문장에 나온 그대로의 형태(word)를 정답으로, 다른 단어의 형태를 오답으로
  const prompt = blankOut(entry.sentence_en, entry.word);
  if (!prompt) return null;
  const c = makeChoices(entry.word, others, (v) => v.word, rand);
  return c && { kind, entry, prompt, hint: entry.sentence_ko, ...c };
}
