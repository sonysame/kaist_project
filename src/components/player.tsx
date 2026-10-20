"use client";

import { clock } from "@/lib/format";
import { Back5, Forward5, Pause, Play, Repeat } from "./icons";

export const RATES = [0.75, 0.9, 1, 1.25] as const;

type Props = {
  time: number;
  duration: number;
  playing: boolean;
  rate: number;
  loop: boolean;
  onToggle: () => void;
  onSkip: (delta: number) => void;
  onSeek: (sec: number) => void;
  onRate: (r: number) => void;
  onLoop: (on: boolean) => void;
};

/**
 * 학습용 플레이어. 모바일에서는 화면 아래에 붙고, 넓은 화면에서는 오른쪽 카드로 보인다.
 */
export function Player({ time, duration, playing, rate, loop, onToggle, onSkip, onSeek, onRate, onLoop }: Props) {
  const pct = duration ? (time / duration) * 100 : 0;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-card backdrop-blur lg:static lg:rounded-2xl lg:border lg:p-5">
      <div className="flex items-center gap-2 lg:hidden">
        <PlayButton playing={playing} onToggle={onToggle} small />
        <div className="min-w-0 flex-1">
          <Seek time={time} duration={duration} pct={pct} onSeek={onSeek} />
        </div>
        <button
          onClick={() => onLoop(!loop)}
          className={`grid h-9 w-9 place-items-center rounded-full ${loop ? "bg-warm text-white" : "text-muted"}`}
          aria-pressed={loop}
          title="한 문장 반복"
        >
          <Repeat width={18} height={18} />
        </button>
      </div>

      <div className="hidden lg:block">
        <p className="text-xs font-bold tracking-wide text-muted">LISTEN</p>
        <div className="mt-3">
          <Seek time={time} duration={duration} pct={pct} onSeek={onSeek} />
        </div>
        <div className="mt-4 flex items-center justify-center gap-4">
          <button onClick={() => onSkip(-5)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground" title="5초 뒤로">
            <Back5 width={22} height={22} />
          </button>
          <PlayButton playing={playing} onToggle={onToggle} />
          <button onClick={() => onSkip(5)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground" title="5초 앞으로">
            <Forward5 width={22} height={22} />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex rounded-full bg-surface-2 p-1 text-xs font-semibold" role="group" aria-label="재생 속도">
            {RATES.map((r) => (
              <button
                key={r}
                onClick={() => onRate(r)}
                aria-pressed={rate === r}
                className={`rounded-full px-2.5 py-1 tabular-nums transition ${
                  rate === r ? "bg-surface text-accent shadow-card" : "text-muted hover:text-foreground"
                }`}
              >
                {r}x
              </button>
            ))}
          </div>
          <button
            onClick={() => onLoop(!loop)}
            aria-pressed={loop}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              loop ? "bg-warm text-white" : "bg-surface-2 text-muted hover:text-foreground"
            }`}
            title="지금 문장만 계속 반복해서 들어요"
          >
            <Repeat width={14} height={14} />
            문장 반복
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayButton({ playing, onToggle, small }: { playing: boolean; onToggle: () => void; small?: boolean }) {
  const size = small ? "h-10 w-10" : "h-14 w-14";
  return (
    <button
      onClick={onToggle}
      className={`grid ${size} shrink-0 place-items-center rounded-full bg-accent text-white shadow-card transition hover:bg-accent-strong active:scale-95`}
      aria-label={playing ? "일시 정지" : "재생"}
    >
      {playing ? <Pause width={small ? 18 : 22} height={small ? 18 : 22} /> : <Play width={small ? 18 : 22} height={small ? 18 : 22} className="translate-x-px" />}
    </button>
  );
}

function Seek({ time, duration, pct, onSeek }: { time: number; duration: number; pct: number; onSeek: (s: number) => void }) {
  return (
    <div>
      <input
        type="range"
        className="seek w-full"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(time, duration || 0)}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{ ["--pct" as string]: `${pct}%` }}
        aria-label="재생 위치"
      />
      <div className="mt-1 flex justify-between font-mono text-[11px] tabular-nums text-muted">
        <span>{clock(time)}</span>
        <span>{clock(duration)}</span>
      </div>
    </div>
  );
}
