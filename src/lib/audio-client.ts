"use client";

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { ChunkRange } from "./layout";

const CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
// scripts/copy-ffmpeg.mjs가 public/ffmpeg 에 복사해 둔 파일 (번들러를 거치지 않음)
const FFMPEG_MODULE = "/ffmpeg/index.js";

let loading: Promise<FFmpeg> | null = null;

async function toBlobURL(url: string, type: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("오디오 변환 도구를 내려받지 못했어요. 인터넷 연결을 확인해 주세요.");
  return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type }));
}

function getFFmpeg() {
  loading ??= (async () => {
    const mod = (await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ FFMPEG_MODULE)) as typeof import("@ffmpeg/ffmpeg");
    const ffmpeg = new mod.FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    return ffmpeg;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

/**
 * 원본 파일을 16kHz 모노 32kbps MP3로 줄인다. 음성 인식에는 충분한 품질이고
 * 2시간 녹음도 30MB 정도라 Supabase 무료 플랜의 파일 한도(50MB) 안에 들어간다.
 */
export async function compressAudio(file: File, onProgress: (ratio: number) => void) {
  const ffmpeg = await getFFmpeg();
  let duration = 0;
  const onLog = ({ message }: { message: string }) => {
    const m = message.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (m) duration = +m[1] * 3600 + +m[2] * 60 + +m[3];
  };
  const onProg = ({ progress }: { progress: number }) => onProgress(Math.max(0, Math.min(1, progress)));
  ffmpeg.on("log", onLog);
  ffmpeg.on("progress", onProg);
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() || "audio";
    await ffmpeg.writeFile(`input.${ext}`, new Uint8Array(await file.arrayBuffer()));
    const code = await ffmpeg.exec(["-i", `input.${ext}`, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "-y", "full.mp3"]);
    await ffmpeg.deleteFile(`input.${ext}`);
    if (code !== 0) throw new Error("오디오를 변환하지 못했어요. 지원하는 오디오 파일인지 확인해 주세요.");
    if (!duration) throw new Error("오디오 길이를 읽지 못했어요.");
    const data = (await ffmpeg.readFile("full.mp3")) as Uint8Array;
    return { duration, full: new Blob([data as BlobPart], { type: "audio/mpeg" }) };
  } finally {
    ffmpeg.off("log", onLog);
    ffmpeg.off("progress", onProg);
  }
}

/** compressAudio로 만든 파일을 서버가 정한 구간대로 자른다. 재인코딩 없이 복사만 해서 빠르다. */
export async function splitAudio(layout: ChunkRange[]) {
  const ffmpeg = await getFFmpeg();
  const out: Blob[] = [];
  for (const c of layout) {
    const name = `chunk_${c.idx}.mp3`;
    const code = await ffmpeg.exec(["-ss", String(c.start), "-t", String(c.end - c.start), "-i", "full.mp3", "-c", "copy", "-y", name]);
    if (code !== 0) throw new Error(`구간 ${c.idx + 1}을 자르지 못했어요.`);
    const data = (await ffmpeg.readFile(name)) as Uint8Array;
    await ffmpeg.deleteFile(name);
    out.push(new Blob([data as BlobPart], { type: "audio/mpeg" }));
  }
  await ffmpeg.deleteFile("full.mp3");
  return out;
}
