"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BLANK, MIN_WORDS, buildQuiz, type Question, type QuestionKind } from "@/lib/quiz";
import { speak } from "@/lib/speak";
import type { VocabEntry } from "@/lib/types";
import { Check, Repeat, Sparkles, Volume } from "./icons";

const KIND_LABEL: Record<QuestionKind, string> = {
  meaning: "뜻 고르기",
  word: "단어 고르기",
  cloze: "빈칸 채우기",
};

const KIND_ASK: Record<QuestionKind, string> = {
  meaning: "이 단어의 뜻은?",
  word: "이 뜻에 맞는 영어 단어는?",
  cloze: "빈칸에 들어갈 단어는?",
};

type Result = { q: Question; picked: number };

export function Quiz({ items }: { items: VocabEntry[] }) {
  const [questions, setQuestions] = useState<Question[]>(() => buildQuiz(items));
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [showHint, setShowHint] = useState(false);

  const restart = useCallback(
    (targets?: VocabEntry[]) => {
      setQuestions(buildQuiz(items, { targets }));
      setPos(0);
      setPicked(null);
      setResults([]);
      setShowHint(false);
    },
    [items],
  );

  const q = questions[pos];
  const done = pos >= questions.length;

  const choose = useCallback(
    (i: number) => {
      if (!q || picked !== null) return;
      setPicked(i);
      setResults((r) => [...r, { q, picked: i }]);
      if (q.kind !== "word") speak(q.entry.lemma);
    },
    [q, picked],
  );

  const next = useCallback(() => {
    setPicked(null);
    setShowHint(false);
    setPos((p) => p + 1);
  }, []);

  // 키보드: 1~4로 고르고 Enter로 다음 문제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (picked === null && /^[1-4]$/.test(e.key)) choose(Number(e.key) - 1);
      else if (picked !== null && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, next, picked, done]);

  if (items.length < MIN_WORDS) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-line p-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Sparkles width={26} height={26} />
        </span>
        <p className="mt-4 font-bold">단어를 {MIN_WORDS}개 이상 모으면 퀴즈를 풀 수 있어요</p>
        <p className="mt-1 text-sm text-muted">
          지금 {items.length}개 · {MIN_WORDS - items.length}개만 더 저장하면 돼요. 대본에서 모르는 단어를 눌러 보세요.
        </p>
      </div>
    );
  }

  if (done) return <Summary results={results} onRestart={() => restart()} onRetryWrong={restart} />;

  const correct = picked !== null && picked === q.answer;
  const score = results.filter((r) => r.picked === r.q.answer).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-bold tabular-nums">
          {pos + 1} <span className="text-muted">/ {questions.length}</span>
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-warm transition-[width]"
            style={{ width: `${((pos + (picked !== null ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold tabular-nums text-success">
          맞힘 {score}
        </span>
      </div>

      <div className="mt-5 rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">{KIND_LABEL[q.kind]}</span>
          {q.kind !== "word" && (
            <button
              onClick={() => speak(q.kind === "cloze" ? q.entry.sentence_en : q.entry.lemma)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-accent"
              title={q.kind === "cloze" ? "문장 듣기" : "발음 듣기"}
            >
              <Volume width={14} height={14} /> {q.kind === "cloze" ? "문장 듣기" : "발음 듣기"}
            </button>
          )}
        </div>
        <p className="mt-5 text-sm font-semibold text-muted">{KIND_ASK[q.kind]}</p>

        {q.kind === "cloze" ? (
          <>
            <p className="mt-2 text-xl leading-relaxed">
              {q.prompt.split(BLANK).map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span
                      className={`mx-1 inline-block min-w-24 rounded-lg border-b-2 px-2 text-center font-bold ${
                        picked === null
                          ? "border-accent bg-accent-soft text-accent"
                          : correct
                            ? "border-success bg-success-soft text-success"
                            : "border-danger bg-danger-soft text-danger"
                      }`}
                    >
                      {picked === null ? "?" : q.choices[q.answer]}
                    </span>
                  )}
                </span>
              ))}
            </p>
            {q.hint && (
              <button onClick={() => setShowHint((s) => !s)} className="mt-3 text-sm text-muted hover:text-accent">
                {showHint || picked !== null ? q.hint : "💡 해석 힌트 보기"}
              </button>
            )}
          </>
        ) : (
          <p className={`mt-2 font-black tracking-tight ${q.kind === "meaning" ? "text-4xl" : "text-3xl"}`}>{q.prompt}</p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {q.choices.map((c, i) => {
            const state =
              picked === null ? "idle" : i === q.answer ? "right" : i === picked ? "wrong" : "dim";
            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={picked !== null}
                className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left font-semibold transition ${
                  state === "idle"
                    ? "border-line bg-surface hover:-translate-y-0.5 hover:border-accent hover:bg-accent-soft"
                    : state === "right"
                      ? "border-success bg-success-soft text-success"
                      : state === "wrong"
                        ? "border-danger bg-danger-soft text-danger"
                        : "border-line bg-surface opacity-50"
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                    state === "right" ? "bg-success text-white" : state === "wrong" ? "bg-danger text-white" : "bg-surface-2 text-muted"
                  }`}
                >
                  {state === "right" ? <Check width={14} height={14} /> : i + 1}
                </span>
                <span className="min-w-0">{c}</span>
              </button>
            );
          })}
        </div>

        {picked !== null && (
          <div className={`mt-6 rounded-2xl p-4 ${correct ? "bg-success-soft" : "bg-danger-soft"}`}>
            <p className={`font-bold ${correct ? "text-success" : "text-danger"}`}>{correct ? "정답이에요! 🎉" : "아쉬워요, 다시 기억해 둘까요?"}</p>
            <p className="mt-2 text-sm">
              <span className="font-bold">{q.entry.lemma}</span>
              {q.entry.part_of_speech && <span className="text-muted"> · {q.entry.part_of_speech}</span>} — {q.entry.meaning_ko}
            </p>
            {q.kind !== "cloze" && <p className="mt-1 text-sm text-muted">{q.entry.sentence_en}</p>}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={next}
                autoFocus
                className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
              >
                {pos + 1 < questions.length ? "다음 문제" : "결과 보기"}
              </button>
              <span className="hidden text-xs text-muted sm:inline">Enter로 넘어가기</span>
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-muted">키보드 1~4로 고를 수 있어요</p>
    </div>
  );
}

function Summary({
  results,
  onRestart,
  onRetryWrong,
}: {
  results: Result[];
  onRestart: () => void;
  onRetryWrong: (targets: VocabEntry[]) => void;
}) {
  const wrong = results.filter((r) => r.picked !== r.q.answer);
  const score = results.length - wrong.length;
  const pct = results.length ? Math.round((score / results.length) * 100) : 0;
  const message = pct === 100 ? "완벽해요! 🏆" : pct >= 70 ? "잘했어요! 👏" : pct >= 40 ? "조금만 더 해 봐요 💪" : "다시 한번 도전해요 📚";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
        <div
          className="mx-auto grid h-36 w-36 place-items-center rounded-full"
          style={{ background: `conic-gradient(var(--accent) ${pct * 3.6}deg, var(--line) 0deg)` }}
        >
          <div className="grid h-28 w-28 place-items-center rounded-full bg-surface">
            <div>
              <p className="text-3xl font-black tabular-nums">{pct}%</p>
              <p className="text-xs text-muted tabular-nums">
                {score} / {results.length}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-5 text-xl font-black">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {wrong.length > 0 && (
            <button
              onClick={() => onRetryWrong(wrong.map((r) => r.q.entry))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-warm px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              <Repeat width={16} height={16} /> 틀린 {wrong.length}개 다시 풀기
            </button>
          )}
          <button
            onClick={onRestart}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
          >
            새 퀴즈 풀기
          </button>
        </div>
      </div>

      {wrong.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 font-bold">다시 볼 단어</h3>
          <ul className="space-y-2">
            {wrong.map(({ q }) => (
              <li key={q.entry.id + q.kind} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
                <button
                  onClick={() => speak(q.entry.lemma)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"
                  aria-label="발음 듣기"
                >
                  <Volume width={15} height={15} />
                </button>
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-bold">{q.entry.lemma}</span>
                    <span className="ml-2 text-accent">{q.entry.meaning_ko}</span>
                  </p>
                  <p className="truncate text-xs text-muted">{q.entry.sentence_en}</p>
                </div>
                {q.entry.job_id && q.entry.start_sec !== null && (
                  <Link href={`/jobs/${q.entry.job_id}?t=${Math.floor(q.entry.start_sec)}`} className="shrink-0 text-xs font-semibold text-accent">
                    들으러 가기
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
