"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { clock } from "@/lib/format";
import type { Utterance } from "@/lib/types";
import { SIZES, drawFrame, type Aspect } from "@/lib/video";
import { Back5, Forward5, Pause, Play } from "./icons";

type Props = {
  title: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  duration: number;
  playing: boolean;
  utterances: Utterance[]; // 광고 포함 전체
  names: (u: Utterance) => string;
  onToggle: () => void;
  onSkip: (delta: number) => void;
  onSeek: (sec: number) => void;
  onClose: () => void;
};

/**
 * 대본 화면의 오디오를 그대로 재생하면서, 화자마다 캐릭터가 말하는 장면을 실시간으로 그린다.
 * 파일로 저장하지 않고 화면에서만 보여 준다.
 */
export function Theater({ title, audioRef, duration, playing, utterances, names, onToggle, onSkip, onSeek, onClose }: Props) {
  const [aspect, setAspect] = useState<Aspect>("landscape");
  const [style, setStyle] = useState<"plain" | "puppets">("puppets");
  const [showKo, setShowKo] = useState(true);
  const [time, setTime] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  const content = useMemo(() => utterances.filter((u) => !u.is_ad), [utterances]);
  // 많이 말한 순서로 최대 4명을 캐릭터로 세운다
  const cast = useMemo(() => {
    const count = new Map<string, number>();
    for (const u of content) count.set(u.speaker, (count.get(u.speaker) ?? 0) + 1);
    return [...count]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => id)
      .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
      .map((id) => ({ id, name: names(content.find((u) => u.speaker === id)!) }));
  }, [content, names]);

  // 오디오 재생 위치를 읽어 매 프레임 다시 그린다
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const { w, h } = SIZES[aspect];
    el.width = w;
    el.height = h;
    const ctx = el.getContext("2d")!;
    const font = getComputedStyle(document.body).fontFamily;
    let frame = 0;
    let lastShown = -1;
    const loop = () => {
      const t = audioRef.current?.currentTime ?? 0;
      drawFrame(ctx, aspect, { title, utterances: content, names, font, showKo, highlight: true, style, cast, time: t, length: duration });
      // 화면 아래 시간 표시는 0.25초마다만 갱신 (React 렌더를 줄이려고)
      if (Math.abs(t - lastShown) > 0.25) {
        lastShown = t;
        setTime(t);
      }
      frame = requestAnimationFrame(loop);
    };
    document.fonts.ready.then(() => (frame = requestAnimationFrame(loop)));
    return () => cancelAnimationFrame(frame);
  }, [aspect, audioRef, cast, content, duration, names, showKo, style, title]);

  // Esc로 닫기, 스페이스로 재생/정지
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
      if (e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onToggle]);

  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-label="캐릭터로 보기">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-black tracking-tight">캐릭터로 보기</h2>
          <Seg value={style} onChange={setStyle} options={[["puppets", "캐릭터"], ["plain", "자막만"]]} />
          <Seg value={aspect} onChange={setAspect} options={[["landscape", "가로"], ["portrait", "세로"]]} />
          <Seg value={showKo ? "on" : "off"} onChange={(v) => setShowKo(v === "on")} options={[["on", "해석 켜기"], ["off", "해석 끄기"]]} />
          <button onClick={onClose} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2">
            닫기
          </button>
        </div>

        <div ref={stage} className="mt-4 grid place-items-center overflow-hidden rounded-2xl bg-black">
          <canvas
            ref={canvas}
            onClick={onToggle}
            className={`cursor-pointer ${aspect === "portrait" ? "h-[68vh] w-auto" : "w-full"}`}
            style={{ aspectRatio: `${SIZES[aspect].w} / ${SIZES[aspect].h}` }}
            aria-label="재생 화면 (누르면 재생/정지)"
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => onSkip(-5)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface-2" title="5초 뒤로">
            <Back5 width={22} height={22} />
          </button>
          <button
            onClick={onToggle}
            className="grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-card hover:bg-accent-strong"
            aria-label={playing ? "일시 정지" : "재생"}
          >
            {playing ? <Pause /> : <Play className="translate-x-px" />}
          </button>
          <button onClick={() => onSkip(5)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface-2" title="5초 앞으로">
            <Forward5 width={22} height={22} />
          </button>
          <input
            type="range"
            className="seek min-w-0 flex-1"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => onSeek(Number(e.target.value))}
            style={{ ["--pct" as string]: `${pct}%` }}
            aria-label="재생 위치"
          />
          <span className="font-mono text-xs tabular-nums text-muted">
            {clock(time)} / {clock(duration)}
          </span>
          <button
            onClick={() => stage.current?.requestFullscreen?.()}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2"
          >
            전체 화면
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">화면을 누르거나 스페이스를 누르면 재생/정지돼요. 숨긴 광고는 재생할 때도 건너뛰어요.</p>
      </div>
    </div>
  );
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-full bg-surface-2 p-1 text-xs font-semibold">
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`rounded-full px-3 py-1 transition ${value === v ? "bg-surface text-accent shadow-card" : "text-muted hover:text-foreground"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
