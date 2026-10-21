"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clock } from "@/lib/format";
import { AdminGemini, type GeminiStats } from "./admin-gemini";

type Stats = {
  gemini: GeminiStats;
  totals: {
    users: number;
    jobs: number;
    audioHours: number;
    vocab: number;
    uploadsToday: number;
    status: Record<string, number>;
  };
  storage: { files: number; bytes: number; limit: number };
  database: { bytes: number | null; limit: number };
  users: {
    id: string;
    email: string;
    name: string;
    avatar: string | null;
    createdAt: string;
    lastSignInAt: string | null;
    jobs: number;
    uploadsToday: number;
    vocab: number;
    admin: boolean;
  }[];
  recentJobs: { id: string; filename: string; status: string; durationSec: number; createdAt: string; owner: string }[];
};

const STATUS_LABEL: Record<string, string> = { done: "완료", processing: "처리 중", error: "멈춤", uploading: "업로드 중" };

const mb = (b: number) => (b / 1024 ** 2).toFixed(1);
const dateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setStats(data);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="rounded-xl bg-danger-soft p-4 text-sm text-danger">{error}</p>;
  if (!stats)
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );

  const t = stats.totals;
  return (
    <div className="space-y-8">
      {/* Gemini 사용량 · 모델 설정 · 1시간 파일 예시 */}
      <AdminGemini stats={stats.gemini} onChanged={load} />

      {/* 요약 숫자 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="사용자" value={`${t.users}명`} />
        <Tile label="올라간 학습 자료" value={`${t.jobs}개`} sub={`오디오 ${t.audioHours.toFixed(1)}시간`} />
        <Tile label="오늘 업로드" value={`${t.uploadsToday}개`} sub="한국 시간 0시 기준" />
        <Tile label="저장된 단어" value={`${t.vocab}개`} />
      </div>

      {/* 저장 공간 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Usage
          title="파일 저장 공간 (Storage)"
          used={stats.storage.bytes}
          limit={stats.storage.limit}
          detail={`오디오 파일 ${stats.storage.files}개 · ${mb(stats.storage.bytes)}MB / ${mb(stats.storage.limit)}MB`}
        />
        <Usage
          title="데이터베이스"
          used={stats.database.bytes ?? 0}
          limit={stats.database.limit}
          detail={
            stats.database.bytes === null
              ? "크기를 읽지 못했어요 (migrations/003_users.sql 실행 필요)"
              : `${mb(stats.database.bytes)}MB / ${mb(stats.database.limit)}MB`
          }
        />
      </div>

      {/* 처리 상태 */}
      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(t.status).map(([k, v]) => (
          <span key={k} className="rounded-full border border-line bg-surface px-3 py-1">
            {STATUS_LABEL[k] ?? k} <b className="tabular-nums">{v}</b>
          </span>
        ))}
      </div>

      {/* 사용자 목록 */}
      <section>
        <h2 className="mb-3 text-lg font-bold">사용자 목록</h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">사용자</th>
                <th className="px-4 py-3 font-semibold">가입</th>
                <th className="px-4 py-3 font-semibold">마지막 로그인</th>
                <th className="px-4 py-3 text-right font-semibold">학습 자료</th>
                <th className="px-4 py-3 text-right font-semibold">오늘 업로드</th>
                <th className="px-4 py-3 text-right font-semibold">단어</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stats.users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-white">
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {u.name || "(이름 없음)"}
                          {u.admin && <span className="ml-1.5 rounded bg-accent-soft px-1.5 text-[10px] font-bold text-accent">관리자</span>}
                        </p>
                        <p className="truncate text-xs text-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{dateTime(u.createdAt)}</td>
                  <td className="px-4 py-3 text-muted">{dateTime(u.lastSignInAt)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.jobs}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.uploadsToday}/3</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.vocab}</td>
                </tr>
              ))}
              {!stats.users.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    아직 가입한 사용자가 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 최근 학습 자료 */}
      <section>
        <h2 className="mb-3 text-lg font-bold">최근 올라온 학습 자료</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {stats.recentJobs.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <Link href={`/jobs/${j.id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-accent">
                {j.filename}
              </Link>
              <span className="text-muted">{j.owner}</span>
              <span className="tabular-nums text-muted">{clock(j.durationSec)}</span>
              <span className="w-16 text-right text-muted">{STATUS_LABEL[j.status] ?? j.status}</span>
              <span className="w-28 text-right text-muted">{dateTime(j.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Usage({ title, used, limit, detail }: { title: string; used: number; limit: number; detail: string }) {
  const pct = Math.min(100, (used / limit) * 100);
  const color = pct > 85 ? "bg-danger" : pct > 60 ? "bg-warm" : "bg-accent";
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-sm font-black tabular-nums">{pct.toFixed(1)}%</p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(1, pct)}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">{detail} (무료 플랜 기준)</p>
    </div>
  );
}
