"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { vocabFetch } from "@/lib/device";
import type { Definition, Utterance } from "@/lib/types";
import { speak } from "@/lib/speak";
import { Bookmark, Check, Volume } from "./icons";

export type WordTarget = { u: Utterance; wordIdx: number; rect: DOMRect };

const cache = new Map<string, Definition>();
const clean = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/** 단어를 누르면 뜨는 작은 창. 문맥에 맞는 뜻을 보여 주고 단어장에 저장한다. */
export function WordPopover({ target, jobId, onClose }: { target: WordTarget; jobId: string; onClose: () => void }) {
  const { u, wordIdx, rect } = target;
  const word = clean(u.words[wordIdx]?.t ?? "");
  const key = `${u.id}:${wordIdx}`;
  const [def, setDef] = useState<Definition | null>(cache.get(key) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<"no" | "saving" | "yes">("no");
  const box = useRef<HTMLDivElement>(null);

  // 다른 단어를 누르면 부모가 key를 바꿔 이 컴포넌트를 새로 만든다
  useEffect(() => {
    if (cache.has(key) || !word) return;
    let cancelled = false;
    fetch("/api/define", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, sentence: u.text_en }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        cache.set(key, data);
        if (!cancelled) setDef(data);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [key, word, u.text_en]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // 단어를 누른 그 클릭이 바로 창을 닫지 않도록 다음 틱에 등록
    const t = setTimeout(() => document.addEventListener("mousedown", onDown));
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, { passive: true });
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose);
    };
  }, [onClose]);

  async function save() {
    if (!def) return;
    setSaved("saving");
    const res = await vocabFetch("/api/vocab", {
      method: "POST",
      body: JSON.stringify({
        word,
        ...def,
        sentence_en: u.text_en,
        sentence_ko: u.text_ko,
        job_id: jobId,
        start_sec: u.words[wordIdx]?.s ?? u.start_sec,
      }),
    });
    if (res.ok) setSaved("yes");
    else {
      setSaved("no");
      setError((await res.json().catch(() => ({}))).error ?? "저장하지 못했어요.");
    }
  }

  const width = 320;
  const left = Math.min(Math.max(8, rect.left - 16), window.innerWidth - width - 8);
  const below = rect.bottom + 10;
  const top = below + 230 > window.innerHeight ? Math.max(72, rect.top - 240) : below;

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={`${word} 뜻`}
      className="fixed z-50 overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
      style={{ left, top, width }}
    >
      <div className="bg-gradient-to-br from-accent-soft to-warm-soft px-5 pb-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-tight">{def?.lemma ?? word}</span>
          <button
            onClick={() => speak(def?.lemma ?? word)}
            className="grid h-8 w-8 place-items-center rounded-full bg-surface/80 text-accent hover:bg-surface"
            title="발음 듣기"
            aria-label="발음 듣기"
          >
            <Volume width={16} height={16} />
          </button>
          {def?.part_of_speech && (
            <span className="ml-auto rounded-full bg-surface/80 px-2.5 py-0.5 text-xs font-semibold text-accent">
              {def.part_of_speech}
            </span>
          )}
        </div>
        <p className="mt-2 min-h-7 text-[17px] font-semibold">
          {error ? (
            <span className="text-sm font-normal text-danger">{error}</span>
          ) : def ? (
            def.meaning_ko
          ) : (
            <span className="inline-block h-5 w-40 animate-pulse rounded bg-surface/70" />
          )}
        </p>
      </div>
      <div className="px-5 pb-4 pt-3">
        <p className="line-clamp-3 text-sm leading-relaxed text-muted">{highlight(u.text_en, u.words[wordIdx]?.t ?? word)}</p>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={save}
            disabled={!def || saved !== "no"}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-default ${
              saved === "yes" ? "bg-success-soft text-success" : "bg-accent text-white hover:bg-accent-strong disabled:opacity-50"
            }`}
          >
            {saved === "yes" ? <Check width={16} height={16} /> : <Bookmark width={16} height={16} />}
            {saved === "yes" ? "단어장에 저장됨" : saved === "saving" ? "저장 중…" : "단어장에 저장"}
          </button>
          {saved === "yes" && (
            <Link href="/vocab" className="text-sm font-semibold text-accent">
              단어장 →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function highlight(sentence: string, token: string) {
  const i = sentence.indexOf(token);
  if (i < 0) return sentence;
  return (
    <>
      {sentence.slice(0, i)}
      <mark className="rounded bg-accent-soft px-0.5 font-semibold text-accent">{sentence.slice(i, i + token.length)}</mark>
      {sentence.slice(i + token.length)}
    </>
  );
}
