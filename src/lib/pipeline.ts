import type { UtteranceWord, Word } from "./types";

const SENTENCE_END = /[.?!]["')\]]*$/;
const mid = (w: Word) => (w.start + w.end) / 2;

/**
 * 이번 구간의 화자 라벨(spk_1 ...)을 녹음 전체 기준 ID(S1 ...)로 연결한다.
 * 앞 구간과 겹치는 30초 동안 같은 시각에 나온 단어의 화자를 투표로 맞춘다.
 * 겹침에서 짝을 못 찾은 화자는 새 ID를 받는다.
 */
export function mapSpeakers(
  words: Word[],
  prev: { words: Word[]; map: Record<string, string> } | null,
  overlap: { start: number; end: number },
  nextSpeakerNo: number,
): { map: Record<string, string>; nextSpeakerNo: number } {
  const votes = new Map<string, Map<string, number>>();
  if (prev) {
    const prevInOverlap = prev.words.filter((w) => w.end > overlap.start && w.start < overlap.end);
    for (const w of words) {
      if (w.end <= overlap.start || w.start >= overlap.end) continue;
      let best: Word | null = null;
      let bestOverlap = 0;
      for (const p of prevInOverlap) {
        const o = Math.min(w.end, p.end) - Math.max(w.start, p.start);
        if (o > bestOverlap) [best, bestOverlap] = [p, o];
      }
      const global = best && prev.map[best.speaker];
      if (!global) continue;
      const v = votes.get(w.speaker) ?? new Map<string, number>();
      v.set(global, (v.get(global) ?? 0) + bestOverlap);
      votes.set(w.speaker, v);
    }
  }

  // 표를 많이 받은 짝부터 1:1로 확정
  const pairs = [...votes].flatMap(([local, v]) => [...v].map(([global, score]) => ({ local, global, score })));
  pairs.sort((a, b) => b.score - a.score);
  const map: Record<string, string> = {};
  const usedGlobal = new Set<string>();
  for (const p of pairs) {
    if (map[p.local] || usedGlobal.has(p.global)) continue;
    map[p.local] = p.global;
    usedGlobal.add(p.global);
  }

  // 겹침 30초 동안 말하지 않은 사람은 표를 못 받는다. 이런 화자는 앞 구간에서 짝이 안 정해진
  // 화자와 많이 말한 순서대로 잇는다. (그대로 두면 같은 사람이 새 번호를 받는다)
  if (prev) {
    const spoken = (ws: Word[], toId: (s: string) => string | undefined) => {
      const n = new Map<string, number>();
      for (const w of ws) {
        const id = toId(w.speaker);
        if (id) n.set(id, (n.get(id) ?? 0) + 1);
      }
      return [...n].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    };
    const freeGlobals = spoken(prev.words, (s) => prev.map[s]).filter((g) => !usedGlobal.has(g));
    const freeLocals = spoken(words, (s) => s).filter((l) => !map[l]);
    for (let i = 0; i < Math.min(freeGlobals.length, freeLocals.length); i++) {
      map[freeLocals[i]] = freeGlobals[i];
      usedGlobal.add(freeGlobals[i]);
    }
  }

  // 그래도 남은 화자는 새로 등장한 사람으로 보고 단어가 처음 나오는 순서대로 새 번호 부여
  for (const w of words) {
    if (!map[w.speaker]) map[w.speaker] = `S${nextSpeakerNo++}`;
  }
  return { map, nextSpeakerNo };
}

/**
 * 다음 구간과 겹치는 범위 안에서 문장이 끝나고 쉬는 지점을 골라 경계로 삼는다.
 * 이 구간은 경계 전까지, 다음 구간은 경계부터 사용해서 같은 말이 두 번 나오지 않게 한다.
 */
export function chooseCut(words: Word[], overlap: { start: number; end: number }): number {
  const inWindow = words.filter((w) => w.start >= overlap.start + 3 && w.end <= overlap.end - 3);
  let best: { at: number; score: number } | null = null;
  for (let i = 0; i < inWindow.length - 1; i++) {
    const gap = inWindow[i + 1].start - inWindow[i].end;
    const score = gap + (SENTENCE_END.test(inWindow[i].text) ? 10 : 0);
    if (!best || score > best.score) best = { at: (inWindow[i].end + inWindow[i + 1].start) / 2, score };
  }
  return best?.at ?? (overlap.start + overlap.end) / 2;
}

export function keepRange(words: Word[], from: number, until: number) {
  return words.filter((w) => mid(w) >= from && mid(w) < until);
}

export type DraftUtterance = { speaker: string; start: number; end: number; text: string; words: UtteranceWord[] };

/** 단어를 화자가 바뀌거나 길게 쉬는 곳에서 끊어 발화 단위로 묶는다. */
export function buildUtterances(words: Word[], map: Record<string, string>): DraftUtterance[] {
  const out: DraftUtterance[] = [];
  let cur: DraftUtterance | null = null;
  for (const w of words) {
    const speaker = map[w.speaker] ?? w.speaker;
    const len = cur ? w.end - cur.start : 0;
    const lastEndsSentence = cur ? SENTENCE_END.test(cur.words[cur.words.length - 1].t) : false;
    const split =
      !cur ||
      cur.speaker !== speaker ||
      w.start - cur.end > 2 ||
      (len > 20 && lastEndsSentence) ||
      len > 45;
    const word = { t: w.text, s: round(w.start), e: round(w.end) };
    if (split) {
      if (cur) out.push(finish(cur));
      cur = { speaker, start: w.start, end: w.end, text: "", words: [word] };
    } else {
      cur!.words.push(word);
      cur!.end = w.end;
    }
  }
  if (cur) out.push(finish(cur));
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

function finish(u: DraftUtterance): DraftUtterance {
  return { ...u, text: u.words.map((w) => w.t).join(" ").replace(/\s+([,.?!;:])/g, "$1") };
}
