import type { UtteranceWord } from "./types";

export type Correction = { wrong: string; right: string };

const norm = (t: string) => t.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
const trailing = (t: string) => t.match(/[^\p{L}\p{N}]+$/u)?.[0] ?? "";
const leading = (t: string) => t.match(/^[^\p{L}\p{N}]+/u)?.[0] ?? "";

/** 발화 단어 배열을 문장으로 다시 잇는다 (pipeline.buildUtterances와 같은 규칙) */
export const joinWords = (ws: UtteranceWord[]) => ws.map((w) => w.t).join(" ").replace(/\s+([,.?!;:])/g, "$1");

/** 모델이 준 교정 목록 중 쓸 만한 것만 남긴다 */
export function cleanCorrections(list: Correction[]): Correction[] {
  const seen = new Set<string>();
  return list
    .map((c) => ({ wrong: c.wrong.trim(), right: c.right.trim() }))
    .filter((c) => {
      const key = c.wrong.toLowerCase();
      const ok =
        c.wrong &&
        c.right &&
        key !== c.right.toLowerCase() &&
        c.wrong.split(/\s+/).length <= 4 &&
        c.right.length <= 40 &&
        !seen.has(key);
      seen.add(key);
      return ok;
    })
    .slice(0, 40);
}

/**
 * 단어 배열에서 잘못 들은 말(한 단어 또는 여러 단어)을 찾아 바른 말로 바꾼다.
 * 여러 단어가 한 단어로 바뀌면 시간은 첫 단어 시작 ~ 마지막 단어 끝으로 합친다.
 * 앞뒤 문장부호(쉼표, 마침표, 소유격 's 등)는 그대로 둔다.
 */
export function applyCorrections(words: UtteranceWord[], corrections: Correction[]): { words: UtteranceWord[]; changed: number } {
  let out = words;
  let changed = 0;
  for (const c of corrections) {
    const target = c.wrong.split(/\s+/).map(norm).filter(Boolean);
    if (!target.length) continue;
    const next: UtteranceWord[] = [];
    for (let i = 0; i < out.length; ) {
      const slice = out.slice(i, i + target.length);
      const lastRaw = slice[slice.length - 1]?.t ?? "";
      // 마지막 단어 뒤에 붙은 소유격('s)도 허용: "10 Cent's" → "Tencent's"
      const possessive = /['’]s$/i.test(lastRaw) ? lastRaw.match(/['’]s$/i)![0] : "";
      const match =
        slice.length === target.length &&
        slice.every((w, k) => {
          const n = norm(k === slice.length - 1 && possessive ? w.t.slice(0, -2) : w.t);
          return n === target[k];
        });
      if (match) {
        const tail = possessive || trailing(lastRaw);
        next.push({ t: leading(slice[0].t) + c.right + tail, s: slice[0].s, e: slice[slice.length - 1].e });
        i += target.length;
        changed++;
      } else {
        next.push(out[i]);
        i++;
      }
    }
    out = next;
  }
  return { words: out, changed };
}
