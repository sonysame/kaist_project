"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clock } from "@/lib/format";
import type { Job } from "@/lib/types";
import { Clock, FileAudio } from "./icons";

const STATUS: Record<Job["status"], { label: string; cls: string }> = {
  uploading: { label: "업로드 중", cls: "bg-surface-2 text-muted" },
  processing: { label: "처리 중", cls: "bg-accent-soft text-accent" },
  done: { label: "학습 가능", cls: "bg-success-soft text-success" },
  error: { label: "멈춤", cls: "bg-danger-soft text-danger" },
};

export function RecentJobs() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jobs")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setJobs(data);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="rounded-xl bg-danger-soft p-4 text-sm text-danger">목록을 불러오지 못했어요: {error}</p>;
  if (!jobs)
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  if (!jobs.length)
    return (
      <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
        아직 올린 오디오가 없어요. 위에서 첫 파일을 올려 보세요.
      </div>
    );

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((j) => {
        const s = STATUS[j.status];
        return (
          <li key={j.id}>
            <Link
              href={`/jobs/${j.id}`}
              className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-accent"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <FileAudio />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5">
                    {j.is_sample && (
                      <span className="shrink-0 rounded-full bg-warm-soft px-2 py-0.5 text-[11px] font-bold text-warm">샘플</span>
                    )}
                    <span className="truncate font-semibold group-hover:text-accent">
                      {j.is_sample ? "Acquired 팟캐스트 · Tencent 편" : j.filename}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{new Date(j.created_at).toLocaleDateString("ko-KR")}</p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between pt-5 text-sm">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <Clock width={15} height={15} />
                  <span className="tabular-nums">{clock(j.duration_sec)}</span>
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
