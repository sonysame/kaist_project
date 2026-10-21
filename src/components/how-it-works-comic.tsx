import type { ReactNode } from "react";
import { Puppet, type PuppetKind } from "./puppet";

type Panel = { kind: PuppetKind; line: ReactNode; prop: ReactNode; tint: string };

const PANELS: Panel[] = [
  {
    kind: "violet",
    line: (
      <>
        영어 오디오를 <b>올려 줘!</b>
        <br />
        팟캐스트도, 강의도 좋아
      </>
    ),
    prop: <AudioFileProp />,
    tint: "from-accent-soft",
  },
  {
    kind: "orange",
    line: (
      <>
        누가 말했는지 나눠서 <b>대본</b>을 써 줄게.
        <br />
        해석은 <b className="rounded bg-accent px-1 text-[11px] text-white">KOR</b> 을 눌러!
      </>
    ),
    prop: <TranscriptProp />,
    tint: "from-warm-soft",
  },
  {
    kind: "green",
    line: (
      <>
        모르는 단어는 눌러서
        <br />
        <b>단어장에 쏙!</b> 퀴즈로 복습해
      </>
    ),
    prop: <VocabProp />,
    tint: "from-success-soft",
  },
];

/** 메인 페이지의 사용법 3컷 만화. 캐릭터가 말풍선으로 한 단계씩 알려 준다. */
export function HowItWorksComic() {
  return (
    <section aria-labelledby="how-title">
      <h2 id="how-title" className="sr-only">
        사용법
      </h2>
      <ol className="grid gap-4 sm:grid-cols-3">
        {PANELS.map((p, i) => (
          <li
            key={p.kind}
            className={`relative overflow-hidden rounded-2xl border-2 border-foreground/80 bg-gradient-to-b ${p.tint} to-surface p-4 shadow-[4px_4px_0_0_var(--foreground)]`}
          >
            <span className="absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full border-2 border-foreground/80 bg-surface text-sm font-black">
              {i + 1}
            </span>

            {/* 말풍선 */}
            <div className="relative ml-9 rounded-2xl border-2 border-foreground/80 bg-surface px-3 py-2 text-sm leading-snug">
              {p.line}
              <span
                aria-hidden
                className="absolute -bottom-[9px] left-8 h-4 w-4 rotate-45 border-b-2 border-r-2 border-foreground/80 bg-surface"
              />
            </div>

            {/* 장면: 캐릭터 + 소품 */}
            <div className="mt-3 flex items-end justify-between gap-2">
              <Puppet kind={p.kind} className="puppet-bob h-28 w-auto shrink-0" />
              <div className="mb-3 min-w-0 flex-1">{p.prop}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AudioFileProp() {
  return (
    <div className="ml-auto w-28 rotate-3 rounded-xl border-2 border-foreground/80 bg-surface p-2 shadow-card">
      <div className="flex items-end gap-0.5" aria-hidden>
        {[6, 12, 18, 10, 20, 14, 8, 16, 11, 6].map((h, i) => (
          <span key={i} className="w-1.5 rounded-full bg-accent" style={{ height: h }} />
        ))}
      </div>
      <p className="mt-1.5 truncate font-mono text-[10px] text-muted">podcast.mp3</p>
    </div>
  );
}

function TranscriptProp() {
  return (
    <div className="ml-auto w-32 -rotate-2 space-y-1.5 rounded-xl border-2 border-foreground/80 bg-surface p-2 shadow-card" aria-hidden>
      <div className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full bg-[var(--spk-1)]" />
        <span className="h-1.5 flex-1 rounded-full bg-line" />
      </div>
      <div className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full bg-[var(--spk-2)]" />
        <span className="h-1.5 flex-1 rounded-full bg-line" />
        <span className="rounded bg-accent px-1 text-[8px] font-bold text-white">KOR</span>
      </div>
      <p className="pl-4 text-[10px] leading-tight text-muted">안녕하세요, 반가워요!</p>
    </div>
  );
}

function VocabProp() {
  return (
    <div className="relative ml-auto h-16 w-28" aria-hidden>
      <div className="absolute inset-0 translate-x-2 -translate-y-1 rotate-6 rounded-xl border-2 border-foreground/80 bg-success-soft" />
      <div className="absolute inset-0 -rotate-3 rounded-xl border-2 border-foreground/80 bg-surface p-2 shadow-card">
        <p className="truncate text-xs font-black">notoriously</p>
        <p className="text-[10px] font-semibold text-accent">악명 높게</p>
      </div>
    </div>
  );
}
