"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { ChunkRange } from "@/lib/layout";
import { Check, FileAudio, UploadCloud } from "./icons";
import { useAuth } from "./auth-provider";

type Stage =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "compressing"; ratio: number }
  | { kind: "uploading"; done: number; total: number }
  | { kind: "error"; message: string };

type CreateResponse = {
  id: string;
  layout: ChunkRange[];
  full: { path: string; token: string };
  chunks: { path: string; token: string }[];
};

export function Uploader() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const busy = stage.kind === "loading" || stage.kind === "compressing" || stage.kind === "uploading";
  const { quota, refreshQuota } = useAuth();
  const limitReached = quota ? quota.used >= quota.limit : false;

  async function start(file: File) {
    if (busy) return;
    // 압축에 1분쯤 걸리니, 오늘 한도를 다 썼으면 시작하기 전에 막는다 (서버도 한 번 더 확인)
    if (limitReached) {
      setStage({ kind: "error", message: `오늘은 ${quota!.limit}개까지 올릴 수 있어요. 내일 다시 올려 주세요.` });
      return;
    }
    try {
      setStage({ kind: "loading" });
      const { compressAudio, splitAudio } = await import("@/lib/audio-client");
      const { parts } = await compressAudio(file, (ratio) => setStage({ kind: "compressing", ratio }));

      // 3시간 반이 넘으면 1부·2부 두 학습 자료로 올린다 (업로드 횟수는 1번)
      const dot = file.name.lastIndexOf(".");
      const nameOf = (i: number) =>
        parts.length === 1 ? file.name : dot > 0 ? `${file.name.slice(0, dot)} (${i + 1}부)${file.name.slice(dot)}` : `${file.name} (${i + 1}부)`;
      const storage = supabaseBrowser().storage.from("audio");
      const ids: string[] = [];
      let done = 0;
      let total = 0;
      for (const [i, part] of parts.entries()) {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: nameOf(i), durationSec: part.duration, previousPartId: ids[i - 1] }),
        });
        const job = (await res.json()) as CreateResponse & { error?: string };
        if (!res.ok) throw new Error(job.error ?? "작업을 만들지 못했어요.");
        if (i === 0) refreshQuota(); // 헤더의 "오늘 업로드 1/3" 갱신
        ids.push(job.id);

        const chunks = await splitAudio(part.name, job.layout);
        const uploads = [{ ...job.full, blob: part.blob }, ...job.chunks.map((c, k) => ({ ...c, blob: chunks[k] }))];
        total += uploads.length;
        setStage({ kind: "uploading", done, total });
        for (const u of uploads) {
          const { error } = await storage.uploadToSignedUrl(u.path, u.token, u.blob, { contentType: "audio/mpeg" });
          if (error) throw new Error(`업로드에 실패했어요: ${error.message}`);
          setStage({ kind: "uploading", done: ++done, total });
        }
        await fetch(`/api/jobs/${job.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploaded: true }),
        });
      }
      router.push(`/jobs/${ids[0]}`);
    } catch (err) {
      setStage({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) start(file);
      }}
      className={`relative rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
        dragging ? "border-accent bg-accent-soft" : "border-line bg-surface-2/60"
      }`}
    >
      <input
        ref={input}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) start(file);
          e.target.value = "";
        }}
      />

      {busy ? (
        <Progress stage={stage} />
      ) : (
        <>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface text-accent shadow-card">
            <UploadCloud width={26} height={26} />
          </span>
          <p className="mt-4 font-bold">영어 오디오 파일을 끌어 놓으세요</p>
          <p className="mt-1 text-sm text-muted">MP3, M4A, WAV, 영상 파일도 돼요 · 최대 약 3시간</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={limitReached}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileAudio width={18} height={18} />
            파일 선택
          </button>
          {quota && (
            <p className={`mt-3 text-xs ${limitReached ? "font-semibold text-danger" : "text-muted"}`}>
              {limitReached
                ? `오늘 업로드 ${quota.used}/${quota.limit} · 내일(한국 시간 0시) 다시 올릴 수 있어요`
                : `오늘 업로드 ${quota.used}/${quota.limit}`}
            </p>
          )}
          {stage.kind === "error" && (
            <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{stage.message}</p>
          )}
        </>
      )}
    </div>
  );
}

const STEPS = ["변환 도구 준비", "음성 압축", "업로드"] as const;

function Progress({ stage }: { stage: Stage }) {
  const current = stage.kind === "loading" ? 0 : stage.kind === "compressing" ? 1 : 2;
  let ratio = 0.03;
  if (stage.kind === "compressing") ratio = 0.05 + stage.ratio * 0.65;
  if (stage.kind === "uploading") ratio = 0.7 + (stage.done / stage.total) * 0.3;
  const detail =
    stage.kind === "compressing"
      ? `${Math.round(stage.ratio * 100)}%`
      : stage.kind === "uploading"
        ? `${stage.done}/${stage.total}`
        : "";

  return (
    <div className="mx-auto max-w-sm text-left">
      <ol className="space-y-3">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-3 text-sm">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                i < current
                  ? "bg-success text-white"
                  : i === current
                    ? "bg-accent text-white"
                    : "bg-surface text-muted ring-1 ring-line"
              }`}
            >
              {i < current ? <Check width={14} height={14} /> : i + 1}
            </span>
            <span className={i === current ? "font-semibold" : i < current ? "text-muted" : "text-muted"}>{label}</span>
            {i === current && detail && <span className="ml-auto tabular-nums text-muted">{detail}</span>}
          </li>
        ))}
      </ol>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-warm transition-[width]"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-muted">브라우저에서 처리하고 있어요. 이 창을 닫지 말아 주세요.</p>
    </div>
  );
}
