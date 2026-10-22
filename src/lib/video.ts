"use client";

import type { Utterance } from "./types";

export type Aspect = "landscape" | "portrait";

export const SIZES: Record<Aspect, { w: number; h: number }> = {
  landscape: { w: 1280, h: 720 },
  portrait: { w: 720, h: 1280 },
};

const SPEAKER_COLORS = ["#8b80ff", "#ff9c66", "#3fd1a0", "#f07cc4", "#5cb8ff", "#f2c94c", "#b49cff", "#a3a7bd"];
const speakerColor = (id: string) => SPEAKER_COLORS[((Number(id.slice(1)) || 1) - 1) % SPEAKER_COLORS.length];

export type FrameInfo = {
  title: string;
  utterances: Utterance[];
  names: (u: Utterance) => string;
  time: number;
  /** 진행 막대용 전체 길이 */
  length: number;
  font: string;
  showKo: boolean;
  /** "puppets"면 화자마다 오리지널 털복숭이 캐릭터가 나와서 말할 때 입을 움직인다 */
  style: "plain" | "puppets";
  /** 지금 말하는 단어를 강조하고, 아직 말하지 않은 단어는 흐리게 */
  highlight: boolean;
  /** 캐릭터로 보여 줄 화자 순서 (왼쪽부터) */
  cast: { id: string; name: string }[];
};

/** 캐릭터 화면 한 장면을 그린다. 오디오 재생 위치에 맞춰 매 프레임 호출한다. */
export function drawFrame(ctx: CanvasRenderingContext2D, aspect: Aspect, f: FrameInfo) {
  const { w, h } = SIZES[aspect];
  const portrait = aspect === "portrait";
  const pad = portrait ? 56 : 72;

  // 배경
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#14122b");
  bg.addColorStop(1, "#2a1730");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  glow(ctx, w * 0.85, h * 0.1, Math.max(w, h) * 0.45, "rgba(139,128,255,0.28)");
  glow(ctx, w * 0.1, h * 0.95, Math.max(w, h) * 0.4, "rgba(255,156,102,0.18)");

  // 상단: 로고 + 제목
  ctx.textBaseline = "middle";
  roundRect(ctx, pad, pad - 6, 44, 44, 12);
  const logo = ctx.createLinearGradient(pad, pad, pad + 44, pad + 44);
  logo.addColorStop(0, "#8b80ff");
  logo.addColorStop(1, "#ff9c66");
  ctx.fillStyle = logo;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `900 22px ${f.font}`;
  ctx.fillText("♪", pad + 15, pad + 16);
  ctx.font = `900 24px ${f.font}`;
  ctx.fillText("ListenUp", pad + 58, pad + 6);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `500 18px ${f.font}`;
  ctx.fillText(ellipsize(ctx, f.title, w - pad * 2 - 58), pad + 58, pad + 32);

  // 캐릭터 배치: 가로 화면에 2명 이하면 양옆, 아니면 아래 한 줄
  const puppets = f.style === "puppets" && f.cast.length > 0;
  const side = puppets && !portrait && f.cast.length <= 2;
  const bottom = puppets && !side;
  const left = side ? SIDE_W : pad;
  const right = side ? w - SIDE_W : w - pad;
  const maxW = right - left;
  const top = pad + 90;
  const floor = (bottom ? h - puppetStageHeight(aspect) : h - pad - 44) - 16;

  // 지금 말하는 문장
  const idx = findActive(f.utterances, f.time);
  const u = f.utterances[idx];
  const live = u && f.time <= u.end_sec + 1.2;
  const enSize = portrait ? 46 : puppets ? 38 : 44;
  const koSize = portrait ? 30 : puppets ? 25 : 28;
  const MAX_EN_LINES = 3;
  const MAX_KO_LINES = portrait ? 3 : 2;

  if (u && live) {
    const color = speakerColor(u.speaker);
    const name = f.names(u);
    const words = u.words.map((x) => x.t);
    let active = -1;
    for (let i = 0; i < u.words.length && u.words[i].s <= f.time; i++) active = i;

    ctx.font = `700 ${enSize}px ${f.font}`;
    const allLines = layoutWords(ctx, words, maxW);
    // 긴 문장은 지금 말하는 줄이 있는 3줄 묶음만 보여 준다 (노래방 자막처럼 넘어감)
    const activeLine = Math.max(0, allLines.findIndex((l) => l.some((t) => t.i === active)));
    const page = Math.floor(activeLine / MAX_EN_LINES);
    const enLines = allLines.slice(page * MAX_EN_LINES, page * MAX_EN_LINES + MAX_EN_LINES);
    const enLineH = enSize * 1.38;
    ctx.font = `500 ${koSize}px ${f.font}`;
    // 긴 해석도 자르지 않고 장을 나눠 영어와 함께 넘긴다. 장 수가 같으면 영어 장을 그대로 따르고,
    // 다르면 지금까지 말한 단어 비율만큼 넘긴다 (해석의 순서는 대체로 영어 순서를 따라가니까)
    const koAll = f.showKo && u.text_ko ? wrapText(ctx, u.text_ko, maxW) : [];
    const enPages = Math.ceil(allLines.length / MAX_EN_LINES);
    const koPages = Math.ceil(koAll.length / MAX_KO_LINES);
    const spoken = words.length > 1 ? Math.max(0, active) / (words.length - 1) : 0;
    const koPage = koPages <= 1 ? 0 : koPages === enPages ? page : Math.min(koPages - 1, Math.floor(spoken * koPages));
    const koLines = koAll.slice(koPage * MAX_KO_LINES, koPage * MAX_KO_LINES + MAX_KO_LINES);
    const koLineH = koSize * 1.5;

    const blockH = 60 + enLines.length * enLineH + (koLines.length ? 24 + koLines.length * koLineH : 0);
    let y = Math.max(top, top + (floor - top - blockH) / 2);

    // 화자
    ctx.beginPath();
    ctx.arc(left + 22, y + 22, 22, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `800 20px ${f.font}`;
    ctx.textAlign = "center";
    ctx.fillText(initial(name), left + 22, y + 23);
    ctx.textAlign = "left";
    ctx.fillStyle = color;
    ctx.font = `800 26px ${f.font}`;
    ctx.fillText(name, left + 58, y + 23);
    y += 60;

    // 영어 문장
    ctx.font = `700 ${enSize}px ${f.font}`;
    for (const line of enLines) {
      for (const tok of line) {
        const isActive = f.highlight && tok.i === active;
        if (isActive) {
          roundRect(ctx, left + tok.x - 8, y - 4, tok.w + 16, enSize * 1.18, 12);
          ctx.fillStyle = "#8b80ff";
          ctx.fill();
        }
        ctx.fillStyle = !f.highlight || tok.i <= active ? "#fff" : "rgba(255,255,255,0.55)";
        ctx.fillText(tok.text, left + tok.x, y + enSize * 0.56);
      }
      y += enLineH;
    }

    // 한국어 해석
    if (koLines.length) {
      y += 24;
      ctx.font = `500 ${koSize}px ${f.font}`;
      ctx.fillStyle = "rgba(255,214,186,0.95)";
      for (const line of koLines) {
        ctx.fillText(line, left, y + koSize * 0.6);
        y += koLineH;
      }
    }
  }

  if (puppets) {
    const talking = u && live && !u.is_ad ? u.speaker : null;
    let wordOn = false;
    if (u && talking) wordOn = u.words.some((x) => f.time >= x.s && f.time <= x.e + 0.05);
    drawCast(ctx, aspect, f.cast, talking, wordOn, f.time, f.font, side);
  }

  // 하단 진행 막대
  const barY = h - pad + 6;
  roundRect(ctx, pad, barY, w - pad * 2, 8, 4);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fill();
  const pct = f.length ? Math.min(1, f.time / f.length) : 0;
  roundRect(ctx, pad, barY, Math.max(8, (w - pad * 2) * pct), 8, 4);
  const bar = ctx.createLinearGradient(pad, 0, w - pad, 0);
  bar.addColorStop(0, "#8b80ff");
  bar.addColorStop(1, "#ff9c66");
  ctx.fillStyle = bar;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `500 18px ${f.font}`;
  ctx.fillText(clock(f.time), pad, barY - 22);
  ctx.textAlign = "right";
  ctx.fillText(clock(f.length), w - pad, barY - 22);
  ctx.textAlign = "left";
}

// ── 오리지널 털복숭이 캐릭터 ────────────────────────────────
// 특정 프로그램의 캐릭터를 닮지 않도록 색·모양·장식을 새로 정했다 (서양배 몸통, 더듬이, 큰 눈 하나 또는 둘)
type Puppet = { body: string; belly: string; eyes: 1 | 2; antenna: "ball" | "horns" | "leaf" };
const PUPPETS: Puppet[] = [
  { body: "#7b6cf6", belly: "#b9b0ff", eyes: 2, antenna: "ball" },
  { body: "#ff8a4c", belly: "#ffc9a8", eyes: 1, antenna: "horns" },
  { body: "#2fc497", belly: "#a6edd5", eyes: 2, antenna: "leaf" },
  { body: "#e8619f", belly: "#f9bcd8", eyes: 1, antenna: "ball" },
];

/** 가로 화면에서 양옆 캐릭터가 차지하는 폭 */
const SIDE_W = 250;

function puppetStageHeight(aspect: Aspect) {
  return aspect === "portrait" ? 400 : 230;
}

function drawCast(
  ctx: CanvasRenderingContext2D,
  aspect: Aspect,
  cast: { id: string; name: string }[],
  talking: string | null,
  wordOn: boolean,
  t: number,
  font: string,
  side: boolean,
) {
  const { w, h } = SIZES[aspect];
  const n = Math.max(1, cast.length);
  const size = side ? 190 : aspect === "portrait" ? (n > 2 ? 150 : 190) : 120;
  const baseY = h - (aspect === "portrait" ? 150 : side ? 140 : 100);
  cast.forEach((c, i) => {
    // 양옆 배치면 첫 화자는 왼쪽, 둘째는 오른쪽 끝
    const x = side ? (i === 0 ? SIDE_W / 2 + 10 : w - SIDE_W / 2 - 10) : (w / (n + 1)) * (i + 1);
    const isTalking = c.id === talking;
    drawPuppet(ctx, x, baseY, size, PUPPETS[i % PUPPETS.length], isTalking, isTalking && wordOn, t + i * 1.7);
    // 이름표
    ctx.font = `700 20px ${font}`;
    const tw = ctx.measureText(c.name).width + 24;
    roundRect(ctx, x - tw / 2, baseY + 18, tw, 32, 16);
    ctx.fillStyle = isTalking ? PUPPETS[i % PUPPETS.length].body : "rgba(255,255,255,0.14)";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(c.name, x, baseY + 35);
    ctx.textAlign = "left";
  });
}

function drawPuppet(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  size: number,
  p: Puppet,
  talking: boolean,
  wordOn: boolean,
  t: number,
) {
  const bounce = talking ? Math.abs(Math.sin(t * 7)) * size * 0.05 : Math.sin(t * 1.6) * size * 0.012;
  const sway = talking ? Math.sin(t * 3.2) * 0.05 : 0;
  const bodyW = size * 0.62;
  const bodyH = size * 0.78;
  const cy = baseY - bodyH * 0.5 - bounce;

  ctx.save();
  ctx.translate(cx, baseY);
  ctx.rotate(sway);
  ctx.translate(-cx, -baseY);

  // 그림자
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 6, bodyW * 0.8, size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // 더듬이·뿔
  ctx.strokeStyle = p.body;
  ctx.fillStyle = p.body;
  ctx.lineWidth = size * 0.05;
  ctx.lineCap = "round";
  const topY = cy - bodyH * 0.92;
  if (p.antenna === "ball") {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * bodyW * 0.3, topY + size * 0.08);
      ctx.quadraticCurveTo(cx + s * bodyW * 0.45, topY - size * 0.12, cx + s * bodyW * 0.38, topY - size * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + s * bodyW * 0.38, topY - size * 0.22, size * 0.055, 0, Math.PI * 2);
      ctx.fillStyle = "#ffe066";
      ctx.fill();
    }
  } else if (p.antenna === "horns") {
    ctx.fillStyle = "#fff4d6";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * bodyW * 0.18, topY + size * 0.12);
      ctx.lineTo(cx + s * bodyW * 0.42, topY - size * 0.14);
      ctx.lineTo(cx + s * bodyW * 0.42, topY + size * 0.14);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "#7ddc8a";
    ctx.beginPath();
    ctx.ellipse(cx + size * 0.06, topY - size * 0.06, size * 0.1, size * 0.045, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 털 몸통: 가장자리에 작은 원을 둘러 복슬복슬하게
  const body = (r: number) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy - bodyH * 0.12, bodyW * 0.5 + r, bodyH * 0.62 + r, 0, 0, Math.PI * 2);
  };
  ctx.fillStyle = p.body;
  body(0);
  ctx.fill();
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2;
    const jitter = Math.sin(i * 12.9898) * 0.5 + 0.5;
    const fx = cx + Math.cos(a) * bodyW * 0.5;
    const fy = cy - bodyH * 0.12 + Math.sin(a) * bodyH * 0.62;
    ctx.beginPath();
    ctx.arc(fx, fy, size * (0.03 + jitter * 0.02), 0, Math.PI * 2);
    ctx.fill();
  }
  // 배
  ctx.fillStyle = p.belly;
  ctx.beginPath();
  ctx.ellipse(cx, cy + bodyH * 0.18, bodyW * 0.3, bodyH * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  // 눈 (가끔 깜빡임)
  const blink = Math.sin(t * 0.9) > 0.985;
  const eyeY = cy - bodyH * 0.38;
  const eyeR = p.eyes === 1 ? size * 0.13 : size * 0.085;
  const eyeXs = p.eyes === 1 ? [cx] : [cx - bodyW * 0.18, cx + bodyW * 0.18];
  for (const ex of eyeXs) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    if (blink) ctx.ellipse(ex, eyeY, eyeR, eyeR * 0.12, 0, 0, Math.PI * 2);
    else ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = "#1d1f2c";
      ctx.beginPath();
      ctx.arc(ex + eyeR * 0.15, eyeY + eyeR * 0.1, eyeR * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex + eyeR * 0.3, eyeY - eyeR * 0.1, eyeR * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 입: 단어를 말하는 동안 열렸다 닫혔다
  const open = wordOn ? 0.35 + Math.abs(Math.sin(t * 22)) * 0.65 : talking ? 0.12 : 0;
  const mouthY = cy - bodyH * 0.12;
  const mouthW = bodyW * 0.34;
  ctx.fillStyle = "#3b0f2a";
  ctx.beginPath();
  if (open > 0.05) {
    ctx.ellipse(cx, mouthY, mouthW, size * 0.12 * open + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff6b8a";
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + size * 0.06 * open, mouthW * 0.5, size * 0.04 * open + 1, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = "#3b0f2a";
    ctx.lineWidth = size * 0.025;
    ctx.arc(cx, mouthY - size * 0.04, mouthW * 0.7, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();

  // 말하는 캐릭터 위 말풍선 표시
  if (talking) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    roundRect(ctx, cx - 22, topY - size * 0.42 - bounce, 44, 26, 13);
    ctx.fill();
    ctx.fillStyle = "#5b4fe9";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx - 11 + i * 11, topY - size * 0.42 + 13 - bounce, 3 + (Math.floor(t * 6) % 3 === i ? 1.5 : 0), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

type Token = { text: string; i: number; x: number; w: number };

/** 단어를 줄 단위로 배치한다. 지금 말하는 줄이 어디인지 알아야 해서 직접 줄바꿈한다. */
function layoutWords(ctx: CanvasRenderingContext2D, words: string[], maxW: number): Token[][] {
  const space = ctx.measureText(" ").width;
  const lines: Token[][] = [[]];
  let x = 0;
  words.forEach((text, i) => {
    const w = ctx.measureText(text).width;
    const attach = /^[,.?!;:]/.test(text); // 문장부호는 앞 단어에 붙인다
    const gap = x === 0 || attach ? 0 : space;
    if (x + gap + w > maxW && x > 0) {
      lines.push([]);
      x = 0;
    } else x += gap;
    lines[lines.length - 1].push({ text, i, x, w });
    x += w;
  });
  return lines;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

function initial(name: string) {
  const m = name.match(/^화자 (\d+)$/);
  return m ? m[1] : name.trim().charAt(0).toUpperCase();
}

function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function findActive(us: Utterance[], t: number) {
  let lo = 0;
  let hi = us.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (us[m].start_sec <= t) {
      ans = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return ans;
}
