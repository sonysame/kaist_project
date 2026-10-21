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

// 1시간 파일 하나에 역할마다 대략 몇 번 부르는지 (20분 구간 3개, 구간마다 번역 약 2번 + 광고·이름 1번, 교정 1번)
const PER_HOUR: Record<Role, { calls: number; note: string }> = {
  transcribe: { calls: 3, note: "20분마다 1번" },
  text: { calls: 7, note: "번역 약 6번 + 광고·이름 1번 (+ 단어를 누를 때마다 1번)" },
  correct: { calls: 1, note: "파일마다 1번" },
};

const kTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

/** 관리자 페이지의 Gemini 부분: 오늘 사용량, 모델 바꾸기, 1시간 파일 예시 */
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

  const usageOf = (model: string) => stats.usage.find((u) => u.model === model);
  const rolesOf = (model: string) => ROLES.filter((r) => stats.models[r] === model).map((r) => roles?.[r].label ?? r);
  const resetKST = new Date(stats.since).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });

  // 1시간 파일 예시: 같은 모델을 여러 역할이 쓰면 합쳐서 계산
  const perModel = new Map<string, number>();
  for (const r of ROLES) perModel.set(stats.models[r], (perModel.get(stats.models[r]) ?? 0) + PER_HOUR[r].calls);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-bold">Gemini 오늘 사용량</h2>
        <p className="mt-1 text-xs text-muted">
          하루 한도는 미국 태평양 시간 자정(한국 시간 {resetKST})에 다시 채워져요. 앱이 직접 센 숫자라 AI Studio 등 앱 밖에서 쓴
          요청은 들어 있지 않아요.
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

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
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

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-bold">1시간짜리 파일 하나에 쓰는 양 (예시)</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {ROLES.map((r) => (
              <li key={r}>
                <p>
                  <span className="font-semibold">{roles?.[r].label ?? r}</span>{" "}
                  <span className="font-mono text-xs text-muted">{stats.models[r]}</span>
                </p>
                <p className="text-muted">
                  약 <b className="text-foreground">{PER_HOUR[r].calls}번</b> · {PER_HOUR[r].note}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">
            {[...perModel].map(([model, calls]) => {
              const limit = stats.usage.find((u) => u.model === model)?.limit ?? usageOf(model)?.limit;
              return (
                <p key={model}>
                  <span className="font-mono">{model}</span>: 1시간 파일당 {calls}번
                  {limit ? ` → 하루 약 ${Math.floor(limit / calls)}개까지` : ""}
                </p>
              );
            })}
            <p className="mt-2">가장 먼저 막히는 모델이 하루에 처리할 수 있는 파일 수를 정해요. 2시간 파일은 약 2배를 써요.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
