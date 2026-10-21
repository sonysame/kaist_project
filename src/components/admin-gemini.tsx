"use client";

import { useEffect, useState } from "react";

type Role = "transcribe" | "text" | "correct";
type RoleInfo = Record<Role, { label: string; what: string }>;
export type GeminiStats = {
  since: string;
  logReady: boolean;
  models: Record<Role, string>;
  usage: { model: string; calls: number; rateLimited: number; errors: number; inputTokens: number; outputTokens: number; limit: number | null }[];
};

const ROLES: Role[] = ["transcribe", "text", "correct"];

const kTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

/** 관리자 페이지의 Gemini 부분: 오늘 사용량, 모델 바꾸기 */
export function AdminGemini({ stats, onChanged }: { stats: GeminiStats; onChanged: () => void }) {
  const [roles, setRoles] = useState<RoleInfo | null>(null);
  const [options, setOptions] = useState<Record<Role, string[]> | null>(null);
  const [draft, setDraft] = useState<Record<Role, string>>(stats.models);
  const [saving, setSaving] = useState<Role | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/models", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setRoles(data.roles);
        setOptions(data.options);
        setDraft(data.current);
      })
      .catch((e) => setMessage(e.message));
  }, []);

  async function save(role: Role) {
    setSaving(role);
    setMessage(null);
    const r = await fetch("/api/admin/models", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, model: draft[role] }),
    });
    const data = await r.json().catch(() => ({}));
    setSaving(null);
    if (!r.ok) setMessage(data.error ?? "저장하지 못했어요.");
    else {
      setMessage(`${roles?.[role].label ?? role} 모델을 ${draft[role]}(으)로 바꿨어요. 30초 안에 적용돼요.`);
      onChanged();
    }
  }

  const rolesOf = (model: string) => ROLES.filter((r) => stats.models[r] === model).map((r) => roles?.[r].label ?? r);
  const resetKST = new Date(stats.since).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-bold">Gemini 오늘 사용량</h2>
        <p className="mt-1 text-xs text-muted">
          하루 한도는 미국 태평양 시간 자정(한국 시간 {resetKST})에 다시 채워져요.
        </p>
        {!stats.logReady && (
          <p className="mt-3 rounded-lg bg-warm-soft px-3 py-2 text-sm">
            기록 표가 아직 없어요. Supabase SQL Editor에서 migrations/004_gemini_log.sql을 실행해 주세요.
          </p>
        )}
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">모델</th>
                <th className="px-4 py-3 font-semibold">쓰는 곳</th>
                <th className="w-56 px-4 py-3 font-semibold">오늘 요청 / 하루 한도</th>
                <th className="px-4 py-3 text-right font-semibold">한도 초과</th>
                <th className="px-4 py-3 text-right font-semibold">토큰 (입력·출력)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stats.usage.map((u) => {
                const pct = u.limit ? Math.min(100, (u.calls / u.limit) * 100) : 0;
                return (
                  <tr key={u.model}>
                    <td className="px-4 py-3 font-mono text-xs">{u.model}</td>
                    <td className="px-4 py-3 text-muted">{rolesOf(u.model).join(", ") || "(지금은 안 씀)"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                          <div
                            className={`h-full rounded-full ${pct > 85 ? "bg-danger" : pct > 60 ? "bg-warm" : "bg-accent"}`}
                            style={{ width: `${Math.max(u.calls ? 2 : 0, pct)}%` }}
                          />
                        </div>
                        <span className="w-16 text-right tabular-nums">
                          {u.calls}/{u.limit ?? "?"}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${u.rateLimited ? "font-semibold text-danger" : "text-muted"}`}>
                      {u.rateLimited}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {kTokens(u.inputTokens)} · {kTokens(u.outputTokens)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="max-w-2xl rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-bold">모델 설정</h2>
          <p className="mt-1 text-xs text-muted">바꾸면 다시 배포하지 않아도 30초 안에 적용돼요. 목록은 지금 API 키로 쓸 수 있는 모델이에요.</p>
          <div className="mt-4 space-y-4">
            {ROLES.map((r) => (
              <div key={r}>
                <p className="text-sm font-semibold">{roles?.[r].label ?? r}</p>
                <p className="text-xs text-muted">{roles?.[r].what}</p>
                <div className="mt-1.5 flex gap-2">
                  <select
                    value={draft[r]}
                    onChange={(e) => setDraft((d) => ({ ...d, [r]: e.target.value }))}
                    disabled={!options}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-xs"
                  >
                    {(options?.[r] ?? [draft[r]]).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => save(r)}
                    disabled={!options || draft[r] === stats.models[r] || saving === r}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {saving === r ? "저장 중…" : "적용"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {message && <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm">{message}</p>}
        </div>
      </section>
    </div>
  );
}
