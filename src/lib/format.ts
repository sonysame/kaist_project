import type { Utterance } from "./types";

export function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

function srtTime(sec: number) {
  const ms = Math.round(sec * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

export type ExportLang = "en" | "ko" | "both";

const lines = (u: Utterance, lang: ExportLang) =>
  lang === "en" ? [u.text_en] : lang === "ko" ? [u.text_ko ?? ""] : [u.text_en, u.text_ko ?? ""];

export function toText(us: Utterance[], label: (u: Utterance) => string, lang: ExportLang) {
  return us.map((u) => `[${clock(u.start_sec)}] ${label(u)}\n${lines(u, lang).join("\n")}`).join("\n\n");
}

export function toSrt(us: Utterance[], label: (u: Utterance) => string, lang: ExportLang) {
  return us
    .map((u, i) => `${i + 1}\n${srtTime(u.start_sec)} --> ${srtTime(u.end_sec)}\n${label(u)}: ${lines(u, lang).join("\n")}`)
    .join("\n\n");
}

export function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
