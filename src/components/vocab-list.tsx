"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { vocabFetch } from "@/lib/device";
import { clock, download } from "@/lib/format";
import { speak } from "@/lib/speak";
import type { VocabEntry } from "@/lib/types";
import { Quiz } from "./quiz";
import { BookOpen, ChevronLeft, ChevronRight, Download, Shuffle, Trash, Volume } from "./icons";

type Mode = "list" | "cards" | "quiz";

export function VocabList() {
  const [items, setItems] = useState<VocabEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("list");
  const [hideMeaning, setHideMeaning] = useState(false);

  useEffect(() => {
    const fetchList = async () => {
      const r = await vocabFetch("/api/vocab");
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      return data as VocabEntry[];
    };
    (async () => {
      let list = await fetchList();
      // 단어장이 비어 있으면 기본 단어를 요청한다. 계정마다 한 번만 넣는지는 서버가 판단한다.
      if (!list.length) {
        const r = await vocabFetch("/api/vocab/starter", { method: "POST" });
        if (r.ok && (await r.json()).inserted) list = await fetchList();
      }
      setItems(list);
    })().catch((e) => setError(e.message));
  }, []);

  async function remove(id: number) {
    setItems((prev) => prev?.filter((v) => v.id !== id) ?? null);
    await vocabFetch(`/api/vocab?id=${id}`, { method: "DELETE" });
  }

  function exportCsv() {
    if (!items) return;
    const esc = (s: string | null) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const rows = items.map((v) => [v.lemma, v.part_of_speech, v.meaning_ko, v.sentence_en, v.sentence_ko].map(esc).join(","));
    download("단어장.csv", "﻿" + ["단어,품사,뜻,예문,예문 해석", ...rows].join("\n"));
  }

  if (error) return <p className="rounded-xl bg-danger-soft p-4 text-sm text-danger">단어장을 불러오지 못했어요: {error}</p>;
  if (!items)
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  if (!items.length)
    return (
      <div className="rounded-3xl border border-dashed border-line p-12 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <BookOpen width={26} height={26} />
        </span>
        <p className="mt-4 font-bold">아직 저장한 단어가 없어요</p>
        <p className="mt-1 text-sm text-muted">대본에서 모르는 단어를 누르고 &lsquo;단어장에 저장&rsquo;을 눌러 보세요.</p>
      </div>
    );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-line bg-surface p-1 text-sm font-semibold shadow-card">
          {(
            [
              ["list", "목록"],
              ["cards", "카드로 외우기"],
              ["quiz", "퀴즈"],
            ] as const
          ).map(([m, l]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-full px-4 py-1.5 transition ${mode === m ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">{items.length}개</span>
        {mode === "list" && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={hideMeaning} onChange={(e) => setHideMeaning(e.target.checked)} className="accent-[var(--accent)]" />
            뜻 가리기
          </label>
        )}
        <button
          onClick={exportCsv}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent"
        >
          <Download width={15} height={15} /> CSV
        </button>
      </div>

      {mode === "quiz" ? (
        // 단어 수가 바뀌면 문제를 새로 만든다
        <Quiz key={items.length} items={items} />
      ) : mode === "cards" ? (
        <Flashcards items={items} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((v) => (
            <li key={v.id} className="group flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight">{v.lemma}</span>
                <button
                  onClick={() => speak(v.lemma)}
                  className="grid h-7 w-7 place-items-center rounded-full text-accent hover:bg-accent-soft"
                  aria-label="발음 듣기"
                  title="발음 듣기"
                >
                  <Volume width={15} height={15} />
                </button>
                {v.part_of_speech && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">{v.part_of_speech}</span>
                )}
                <button
                  onClick={() => remove(v.id)}
                  className="ml-auto grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                  aria-label="삭제"
                  title="삭제"
                >
                  <Trash width={15} height={15} />
                </button>
              </div>
              <p className={`mt-1 font-semibold text-accent ${hideMeaning ? "select-none blur-sm transition hover:blur-none" : ""}`}>
                {v.meaning_ko}
              </p>
              <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">
                <p>{highlight(v.sentence_en, v.word)}</p>
                {v.sentence_ko && <p className="mt-1 text-muted">{v.sentence_ko}</p>}
              </div>
              {v.job_id && v.start_sec !== null && (
                <Link
                  href={`/jobs/${v.job_id}?t=${Math.floor(v.start_sec)}`}
                  className="mt-3 self-start text-xs font-semibold text-accent hover:underline"
                >
                  ▶ {clock(v.start_sec)} 원래 문장 들으러 가기
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** 앞면은 단어와 예문, 누르면 뒤집혀서 뜻이 나온다 */
function Flashcards({ items }: { items: VocabEntry[] }) {
  const [order, setOrder] = useState(() => items.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const v = items[order[pos % order.length]];

  const go = (d: number) => {
    setFlipped(false);
    setPos((p) => (p + d + order.length) % order.length);
  };
  const shuffle = () => {
    setOrder((o) => [...o].sort(() => Math.random() - 0.5));
    setPos(0);
    setFlipped(false);
  };

  return (
    <div className="mx-auto max-w-xl">
      <button
        onClick={() => setFlipped((f) => !f)}
        className="relative block w-full rounded-3xl border border-line bg-surface p-8 text-center shadow-card transition hover:border-accent"
        style={{ minHeight: 280 }}
        aria-label={flipped ? "단어 보기" : "뜻 보기"}
      >
        <span className="absolute left-5 top-4 text-xs font-bold text-muted">
          {pos + 1} / {order.length}
        </span>
        {!flipped ? (
          <>
            <p className="mt-6 text-4xl font-black tracking-tight">{v.lemma}</p>
            {v.part_of_speech && <p className="mt-2 text-sm text-muted">{v.part_of_speech}</p>}
            <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-muted">{highlight(v.sentence_en, v.word)}</p>
            <p className="mt-6 text-xs font-semibold text-accent">눌러서 뜻 보기</p>
          </>
        ) : (
          <>
            <p className="mt-6 text-sm font-semibold text-muted">{v.lemma}</p>
            <p className="mt-2 text-3xl font-black text-accent">{v.meaning_ko}</p>
            {v.sentence_ko && <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-muted">{v.sentence_ko}</p>}
          </>
        )}
      </button>
      <div className="mt-5 flex items-center justify-center gap-3">
        <button onClick={() => go(-1)} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface hover:border-accent hover:text-accent" aria-label="이전">
          <ChevronLeft />
        </button>
        <button onClick={() => speak(v.lemma)} className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent" aria-label="발음 듣기">
          <Volume />
        </button>
        <button onClick={shuffle} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface hover:border-accent hover:text-accent" aria-label="섞기" title="섞기">
          <Shuffle width={18} height={18} />
        </button>
        <button onClick={() => go(1)} className="grid h-11 w-11 place-items-center rounded-full bg-accent text-white hover:bg-accent-strong" aria-label="다음">
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}

function highlight(sentence: string, word: string) {
  const i = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0 || !word) return sentence;
  return (
    <>
      {sentence.slice(0, i)}
      <mark className="rounded bg-accent-soft px-0.5 font-semibold text-accent">{sentence.slice(i, i + word.length)}</mark>
      {sentence.slice(i + word.length)}
    </>
  );
}
