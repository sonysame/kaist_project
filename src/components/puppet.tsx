// "캐릭터로 보기"에 나오는 오리지널 털복숭이 캐릭터를 SVG로 그린 것 (메인 페이지 만화용)
export type PuppetKind = "violet" | "orange" | "green";

const LOOKS: Record<PuppetKind, { body: string; belly: string; eyes: 1 | 2; antenna: "ball" | "horns" | "leaf" }> = {
  violet: { body: "#7b6cf6", belly: "#b9b0ff", eyes: 2, antenna: "ball" },
  orange: { body: "#ff8a4c", belly: "#ffc9a8", eyes: 1, antenna: "horns" },
  green: { body: "#2fc497", belly: "#a6edd5", eyes: 2, antenna: "leaf" },
};

// 몸통 가장자리의 복슬복슬한 털 위치 (매번 같은 모양이 나오게 고정)
const FUR = Array.from({ length: 40 }, (_, i) => {
  const a = (i / 40) * Math.PI * 2;
  const r = 4 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 3;
  return { x: 60 + Math.cos(a) * 38, y: 92 + Math.sin(a) * 48, r };
});

export function Puppet({ kind, className, talking = true }: { kind: PuppetKind; className?: string; talking?: boolean }) {
  const p = LOOKS[kind];
  return (
    <svg viewBox="0 0 120 160" className={className} aria-hidden>
      {/* 그림자 */}
      <ellipse cx="60" cy="152" rx="36" ry="6" fill="rgb(0 0 0 / 0.12)" />

      {/* 더듬이·뿔·잎 */}
      {p.antenna === "ball" && (
        <g stroke={p.body} strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M44 52 Q36 30 40 20" />
          <path d="M76 52 Q84 30 80 20" />
          <circle cx="40" cy="17" r="6" fill="#ffe066" stroke="none" />
          <circle cx="80" cy="17" r="6" fill="#ffe066" stroke="none" />
        </g>
      )}
      {p.antenna === "horns" && (
        <g fill="#fff4d6">
          <path d="M46 52 L34 24 L54 44 Z" />
          <path d="M74 52 L86 24 L66 44 Z" />
        </g>
      )}
      {p.antenna === "leaf" && (
        <g>
          <path d="M60 46 Q60 34 64 28" stroke="#1f9a74" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="70" cy="26" rx="10" ry="5" transform="rotate(-30 70 26)" fill="#7ddc8a" />
        </g>
      )}

      {/* 털 몸통 */}
      <g fill={p.body}>
        <ellipse cx="60" cy="92" rx="38" ry="48" />
        {FUR.map((f, i) => (
          <circle key={i} cx={f.x} cy={f.y} r={f.r} />
        ))}
      </g>
      <ellipse cx="60" cy="112" rx="22" ry="22" fill={p.belly} />

      {/* 눈 */}
      {(p.eyes === 1 ? [{ cx: 60, r: 14 }] : [{ cx: 47, r: 10 }, { cx: 73, r: 10 }]).map((e) => (
        <g key={e.cx} className="puppet-eye">
          <circle cx={e.cx} cy="70" r={e.r} fill="#fff" />
          <circle cx={e.cx + e.r * 0.15} cy={70 + e.r * 0.12} r={e.r * 0.48} fill="#1d1f2c" />
          <circle cx={e.cx + e.r * 0.35} cy={70 - e.r * 0.12} r={e.r * 0.15} fill="#fff" />
        </g>
      ))}

      {/* 입 */}
      {talking ? (
        <g className="puppet-mouth">
          <ellipse cx="60" cy="94" rx="13" ry="8" fill="#3b0f2a" />
          <ellipse cx="60" cy="98" rx="7" ry="3" fill="#ff6b8a" />
        </g>
      ) : (
        <path d="M48 90 Q60 100 72 90" stroke="#3b0f2a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}
