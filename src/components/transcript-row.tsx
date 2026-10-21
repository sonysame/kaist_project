"use client";

import { memo, useState } from "react";
import { clock } from "@/lib/format";
import type { Utterance } from "@/lib/types";
import { Megaphone, Play } from "./icons";

export const speakerColor = (id: string) => `var(--spk-${((Number(id.slice(1)) || 1) - 1) % 8 + 1})`;

// 광고 속 화자 구분은 모델이 자주 틀려서 사람 이름 대신 '광고'로만 보여 준다
export const AD_LABEL = "광고";

/** 아바타에 넣을 글자: 이름이면 첫 글자, '화자 3'이면 숫자 */
export function initial(name: string) {
  const m = name.match(/^화자 (\d+)$/);
  return m ? m[1] : name.trim().charAt(0).toUpperCase();
}

export function Avatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  const color = speakerColor(id);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
      aria-hidden
    >
      {initial(name)}
    </span>
  );
}

type Props = {
  u: Utterance;
  name: string;
  showSpeaker: boolean;
  active: boolean;
  activeWord: number;
  alwaysKo: boolean;
  onSeek: (u: Utterance) => void;
  onPlayOnce: (u: Utterance) => void;
  onWord: (u: Utterance, wordIdx: number, rect: DOMRect) => void;
};

/** 대본 한 줄. KOR 버튼을 누르면 한국어 해석이 펼쳐지고, 단어를 누르면 뜻 풀이 창이 열린다. */
export const TranscriptRow = memo(function TranscriptRow({
  u,
  name,
  showSpeaker,
  active,
  activeWord,
  alwaysKo,
  onSeek,
  onPlayOnce,
  onWord,
}: Props) {
  const [koOpen, setKoOpen] = useState(false);
  const showKo = alwaysKo || koOpen;
  const ko =
    u.text_ko === null ? (
      <span className="text-sm text-muted">해석을 만드는 중…</span>
    ) : (
      u.text_ko || <span className="text-sm text-muted">해석 없음</span>
    );

  return (
    <div
      id={`u-${u.id}`}
      className={`group relative grid scroll-mt-24 grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 rounded-2xl px-3 py-2.5 transition-colors ${
        active ? "bg-accent-soft" : "hover:bg-surface-2"
      } ${showSpeaker ? "mt-4" : ""} ${u.is_ad ? "opacity-70" : ""}`}
    >
      <div className="flex flex-col items-center pt-0.5">
        {showSpeaker ? (
          u.is_ad ? (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted ring-1 ring-line">
              <Megaphone width={16} height={16} />
            </span>
          ) : (
            <Avatar id={u.speaker} name={name} />
          )
        ) : (
          <button
            onClick={() => onSeek(u)}
            className={`mt-1 font-mono text-[11px] tabular-nums transition-opacity hover:text-accent ${
              active ? "text-accent opacity-100" : "text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
            }`}
            title="여기서부터 재생"
          >
            {clock(u.start_sec)}
          </button>
        )}
      </div>

      <div className="relative min-w-0 pr-11">
        {/* 오른쪽 위: 이 문장만 듣기 + 해석 펼치기 */}
        <div className="absolute right-0 top-0 flex flex-col items-center gap-1.5">
          <button
            onClick={() => onPlayOnce(u)}
            className="grid h-8 w-8 place-items-center rounded-full bg-surface text-accent shadow-card ring-1 ring-line transition hover:bg-accent hover:text-white"
            title="이 문장만 듣기"
            aria-label="이 문장만 듣기"
          >
            <Play width={13} height={13} className="translate-x-px" />
          </button>
          <button
            onClick={() => setKoOpen((o) => !o)}
            disabled={alwaysKo}
            aria-pressed={showKo}
            aria-label={showKo ? "해석 접기" : "해석 보기"}
            title={alwaysKo ? "'해석 항상 보기'가 켜져 있어요" : showKo ? "해석 접기" : "해석 보기"}
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wide transition disabled:cursor-default ${
              showKo ? "bg-accent text-white" : "bg-surface text-muted ring-1 ring-line hover:text-accent"
            }`}
          >
            KOR
          </button>
        </div>
        {showSpeaker && (
          <div className="mb-1 flex items-center gap-2 text-sm">
            <span className="font-bold" style={{ color: u.is_ad ? "var(--muted)" : speakerColor(u.speaker) }}>
              {name}
            </span>
            <button
              onClick={() => onSeek(u)}
              className="rounded-md px-1 font-mono text-xs tabular-nums text-muted hover:bg-accent-soft hover:text-accent"
              title="여기서부터 재생"
            >
              {clock(u.start_sec)}
            </button>
          </div>
        )}
        <p className="text-[17px] leading-[1.8]">
          {u.words.map((w, i) => (
            <span key={i}>
              {i > 0 && !/^[,.?!;:]/.test(w.t) && " "}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => onWord(u, i, e.currentTarget.getBoundingClientRect())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onWord(u, i, e.currentTarget.getBoundingClientRect());
                }}
                className={`cursor-pointer rounded-md px-0.5 py-px transition-colors ${
                  i === activeWord ? "bg-accent text-white" : "hover:bg-accent/15 hover:text-accent"
                }`}
              >
                {w.t}
              </span>
            </span>
          ))}
        </p>
        {showKo && <p className="mt-1 leading-relaxed text-muted">{ko}</p>}
      </div>
    </div>
  );
});
