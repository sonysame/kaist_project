"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useAuth } from "./auth-provider";
import { GoogleMark } from "./google-mark";

type Picked = { text: string; context: string; range: Range };
type Result = { ko?: string; error?: string };

const cache = new Map<string, string>();
const PLAYER_SPACE = 96; // 화면 아래 고정 플레이어와 겹치지 않게 남겨 둘 높이

/** 대본에서 두 단어 이상을 드래그하면 '해석' 버튼을 띄우고, 누르면 그 부분만 한국어로 보여 준다 */
export function SelectionTranslate({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const { user, signIn } = useAuth();

  const pickedText = useRef<string | null>(null);

  const close = useCallback(() => {
    pickedText.current = null;
    setPicked(null);
    setResult(null);
  }, []);

  // 드래그(휴대폰은 길게 눌러 선택)가 끝나고 잠시 멈추면 선택한 부분을 읽는다
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
        const root = containerRef.current;
        if (!sel || sel.isCollapsed || !root || !/\s/.test(text) || !root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) {
          close();
          return;
        }
        const range = sel.getRangeAt(0);
        const rowText = (node: Node | null) =>
          (node instanceof Element ? node : node?.parentElement)?.closest("[id^='u-']")?.querySelector("[data-en]")?.textContent ?? "";
        const start = rowText(range.startContainer);
        const end = rowText(range.endContainer);
        const context = (start === end ? start : `${start} ${end}`).replace(/\s+/g, " ").trim();
        if (pickedText.current !== text) {
          pickedText.current = text;
          setResult(null);
          setPicked({ text, context: context || text, range });
        }
        setRect(range.getBoundingClientRect());
      }, 300);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [containerRef, close]);

  // 스크롤해도 선택한 글자 옆에 붙어 있도록 위치를 다시 잰다
  useEffect(() => {
    if (!picked) return;
    const follow = () => setRect(picked.range.getBoundingClientRect());
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
      document.removeEventListener("keydown", onKey);
    };
  }, [picked, close]);

  async function translate() {
    if (!picked) return;
    if (user === null) return setResult({}); // 로그인 안내만 보여 준다
    const hit = cache.get(picked.text);
    if (hit) return setResult({ ko: hit });
    setResult({});
    const r = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: picked.text, context: picked.context }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return setResult({ error: data.error ?? "해석하지 못했어요." });
    cache.set(picked.text, data.ko);
    setResult({ ko: data.ko });
  }

  if (!picked || !rect) return null;

  const width = result ? 320 : 0;
  const left = result
    ? Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
    : Math.min(Math.max(8, rect.left + rect.width / 2 - 36), window.innerWidth - 80);
  // 휴대폰은 선택 메뉴가 위에 뜨므로 아래에 둔다. 아래 공간이 모자라면 위로.
  const height = result ? 160 : 40;
  const top = rect.bottom + 8 + height > window.innerHeight - PLAYER_SPACE ? Math.max(72, rect.top - height - 8) : rect.bottom + 8;

  return (
    <div
      // 버튼·창을 눌러도 선택이 풀리지 않게 한다
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-50"
      style={{ left, top, width: width || undefined }}
    >
      {!result ? (
        <button
          onClick={translate}
          className="rounded-full bg-accent px-3.5 py-2 text-sm font-bold text-white shadow-card hover:bg-accent-strong"
        >
          해석
        </button>
      ) : (
        <div role="dialog" aria-label="선택한 부분 해석" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="bg-gradient-to-br from-accent-soft to-warm-soft px-4 py-3">
            <p className="line-clamp-2 text-sm text-muted">{picked.text}</p>
            <p className="mt-1.5 min-h-6 font-semibold leading-relaxed">
              {user === null ? (
                <span className="text-sm font-normal text-muted">로그인하면 고른 부분의 해석을 볼 수 있어요.</span>
              ) : result.error ? (
                <span className="text-sm font-normal text-danger">{result.error}</span>
              ) : result.ko ? (
                result.ko
              ) : (
                <span className="inline-block h-5 w-48 animate-pulse rounded bg-surface/70" />
              )}
            </p>
          </div>
          {user === null && (
            <div className="px-4 py-3">
              <button
                onClick={() => signIn()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold hover:border-accent"
              >
                <GoogleMark className="h-4 w-4" />
                Google로 로그인
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
