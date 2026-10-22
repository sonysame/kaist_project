"use client";

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { ChunkRange } from "./layout";
import { AUDIO_KBPS, MAX_DURATION_SEC, MAX_PART_SEC, durationText, partCount } from "./audio-limits";

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

export type AudioPart = { name: string; duration: number; blob: Blob };

/**
 * 원본 파일을 16kHz 모노 32kbps MP3로 줄인다. 음성 인식에도, 듣기에도 충분한 품질이다.
 * 3시간 반(파일당 50MB)이 넘으면 가운데쯤 말이 멈춘 곳에서 잘라 1부·2부 두 파일로 만든다.
 * 원본은 메모리에 복사하지 않고 그대로 읽어서(WORKERFS) 큰 파일도 다룰 수 있다.
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
  const dir = "/in";
  await ffmpeg.createDir(dir).catch(() => {});
  await ffmpeg.mount("WORKERFS" as Parameters<FFmpeg["mount"]>[0], { files: [file] }, dir);
  try {
    const input = `${dir}/${file.name}`;
    // 먼저 길이만 읽는다 (출력 없이 실행하면 정보만 찍고 바로 끝난다)
    await ffmpeg.exec(["-i", input]);
    if (!duration) throw new Error("오디오 길이를 읽지 못했어요. 지원하는 오디오 파일인지 확인해 주세요.");
    if (duration > MAX_DURATION_SEC) throw new Error(`${durationText(MAX_DURATION_SEC)}이 넘는 오디오는 올릴 수 없어요.`);

    ffmpeg.on("progress", onProg);
    const code = await ffmpeg.exec(["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", `${AUDIO_KBPS}k`, "full.mp3"]);
    ffmpeg.off("progress", onProg);
    if (code !== 0) throw new Error("오디오를 변환하지 못했어요. 지원하는 오디오 파일인지 확인해 주세요.");
  } finally {
    ffmpeg.off("log", onLog);
    ffmpeg.off("progress", onProg);
    await ffmpeg.unmount(dir).catch(() => {});
  }

  const read = async (name: string) => new Blob([(await ffmpeg.readFile(name)) as BlobPart], { type: "audio/mpeg" });
  if (partCount(duration) === 1) return { duration, parts: [{ name: "full.mp3", duration, blob: await read("full.mp3") }] };

  const cut = await findCut(ffmpeg, duration);
  const ranges = [
    { name: "part_1.mp3", args: ["-t", String(cut)], duration: cut },
    { name: "part_2.mp3", args: ["-ss", String(cut)], duration: duration - cut },
  ];
  const parts: AudioPart[] = [];
  for (const r of ranges) {
    const code = await ffmpeg.exec([...r.args, "-i", "full.mp3", "-c", "copy", "-y", r.name]);
    if (code !== 0) throw new Error("오디오를 둘로 나누지 못했어요.");
    parts.push({ name: r.name, duration: r.duration, blob: await read(r.name) });
  }
  await ffmpeg.deleteFile("full.mp3");
  return { duration, parts };
}

/** 1부·2부를 나눌 곳: 한가운데 앞뒤 2분 안에서 가운데와 가장 가까운 무음. 없으면 한가운데. */
async function findCut(ffmpeg: FFmpeg, duration: number) {
  const mid = duration / 2;
  const from = Math.max(0, mid - 120);
  const silences: number[] = [];
  let start = 0;
  const onLog = ({ message }: { message: string }) => {
    const s = message.match(/silence_start: ([\d.]+)/);
    if (s) start = +s[1];
    const e = message.match(/silence_end: ([\d.]+)/);
    if (e) silences.push(from + (start + +e[1]) / 2);
  };
  ffmpeg.on("log", onLog);
  try {
    await ffmpeg.exec(["-ss", String(from), "-t", "240", "-i", "full.mp3", "-af", "silencedetect=noise=-35dB:d=0.4", "-f", "null", "-"]);
  } finally {
    ffmpeg.off("log", onLog);
  }
  const best = silences.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0] ?? mid;
  // 두 부분 모두 한 파일 한도 안에 들어가게
  return Math.min(MAX_PART_SEC, Math.max(duration - MAX_PART_SEC, best));
}

/** compressAudio가 만든 파일 하나를 서버가 정한 구간대로 자른다. 재인코딩 없이 복사만 해서 빠르다. */
export async function splitAudio(source: string, layout: ChunkRange[]) {
  const ffmpeg = await getFFmpeg();
  const out: Blob[] = [];
  for (const c of layout) {
    const name = `chunk_${c.idx}.mp3`;
    const code = await ffmpeg.exec(["-ss", String(c.start), "-t", String(c.end - c.start), "-i", source, "-c", "copy", "-y", name]);
    if (code !== 0) throw new Error(`구간 ${c.idx + 1}을 자르지 못했어요.`);
    const data = (await ffmpeg.readFile(name)) as Uint8Array;
    await ffmpeg.deleteFile(name);
    out.push(new Blob([data as BlobPart], { type: "audio/mpeg" }));
  }
  await ffmpeg.deleteFile(source);
  return out;
}
