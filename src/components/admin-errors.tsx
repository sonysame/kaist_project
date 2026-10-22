"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Trash } from "./icons";

type ErrorRow = {
  id: number;
  job_id: string | null;
  filename: string | null;
  step: string;
  message: string;
  skipped: boolean;
  resolved_at: string | null;
  created_at: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });

/** 관리자 페이지의 오류 기록: 처리 중 오류와 건너뛴 단계. 해결(다시 실행)하고, 해결된 기록은 지운다. */
export function AdminErrors() {
  const [rows, setRows] = useState<ErrorRow[] | null>(null);
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/errors", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setReady(data.ready !== false);
        setRows(data.errors ?? []);
      })
      .catch((e) => setMessage(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function fix(row: ErrorRow) {
    setBusy(row.id);
    setMessage(null);
    const r = await fetch(`/api/admin/errors/${row.id}`, { method: "POST" });
    const data = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) setMessage(data.error ?? "해결하지 못했어요.");
    load();
  }

  async function remove(row: ErrorRow) {
    if (!confirm(`이 오류 기록을 지울까요?\n${row.filename ?? "(지운 자료)"} · ${row.step}`)) return;
    const r = await fetch(`/api/admin/errors/${row.id}`, { method: "DELETE" });
    if (!r.ok) setMessage((await r.json().catch(() => ({}))).error ?? "지우지 못했어요.");
    load();
  }

  const open = rows?.filter((r) => !r.resolved_at).length ?? 0;

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold">
        오류 기록{" "}
        {!!open && <span className="ml-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">해결 안 됨 {open}</span>}
      </h2>
      <p className="mb-3 text-xs text-muted">
        &apos;건너뜀&apos;은 처리는 끝났지만 그 단계만 빠진 것이고, &apos;멈춤&apos;은 처리가 멈춘 거예요. 멈춘 처리가 끝까지 되면 저절로 해결 완료로 바뀌어요.
      </p>
      {!ready && (
        <p className="rounded-lg bg-warm-soft px-3 py-2 text-sm">
          오류 기록 표가 아직 없어요. Supabase SQL Editor에서 migrations/007_error_log.sql을 실행해 주세요.
        </p>
      )}
      {message && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{message}</p>}
      {ready && rows && !rows.length && (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">오류가 없어요.</p>
      )}
      {!!rows?.length && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {rows.map((row) => (
            <li key={row.id} className={`flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center ${row.resolved_at ? "opacity-60" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                      row.skipped ? "bg-warm-soft text-warm" : "bg-danger-soft text-danger"
                    }`}
                  >
                    {row.step} {row.skipped ? "건너뜀" : "멈춤"}
                  </span>
                  {row.job_id ? (
                    <Link href={`/jobs/${row.job_id}`} className="min-w-0 truncate font-semibold hover:text-accent">
                      {row.filename ?? "학습 자료"}
                    </Link>
                  ) : (
                    <span className="truncate font-semibold text-muted">{row.filename ?? "학습 자료"} (지움)</span>
                  )}
                  <span className="text-xs text-muted">{when(row.created_at)}</span>
                </div>
                <p className="mt-1 line-clamp-2 break-all text-xs text-muted" title={row.message}>
                  {row.message}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {row.resolved_at ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                    <Check width={13} height={13} /> 해결 완료
                  </span>
                ) : !row.job_id ? null : row.skipped ? (
                  <button
                    onClick={() => fix(row)}
                    disabled={busy !== null}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {busy === row.id ? "다시 실행 중…" : "해결"}
                  </button>
                ) : (
                  <Link href={`/jobs/${row.job_id}`} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                    자료 열어 다시 시도
                  </Link>
                )}
                {(row.resolved_at || !row.job_id) && (
                  <button
                    onClick={() => remove(row)}
                    title="기록 지우기"
                    aria-label="기록 지우기"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:border-danger hover:text-danger"
                  >
                    <Trash width={15} height={15} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
