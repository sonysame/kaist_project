import "server-only";
import { supabaseAdmin } from "./supabase-server";

export type GeminiKind = "transcribe" | "translate" | "define" | "analyze" | "correct";

/**
 * 무료 등급 하루 요청 한도 (AI Studio에서 확인한 값). Google이 바꾸면 여기만 고치면 된다.
 * 환경 변수 GEMINI_DAILY_LIMITS="gemini-3.5-transcribe=25,gemini-3.5-flash=20" 처럼 덮어쓸 수도 있다.
 */
const DEFAULT_DAILY_LIMITS: Record<string, number> = {
  "gemini-3.5-transcribe": 25,
  "gemini-3.5-flash-lite": 500,
  "gemini-3.5-flash": 20,
};

export function dailyLimits(): Record<string, number> {
  const out = { ...DEFAULT_DAILY_LIMITS };
  for (const pair of (process.env.GEMINI_DAILY_LIMITS ?? "").split(",")) {
    const [model, n] = pair.split("=").map((s) => s.trim());
    if (model && Number(n) > 0) out[model] = Number(n);
  }
  return out;
}

/** Gemini 하루 한도는 미국 태평양 시간 자정에 초기화된다. 그 시각을 UTC로 */
export function startOfGeminiDay(now = new Date()) {
  // 태평양 시간의 지금 시각(서머타임 포함)을 구해서, 그날 0시까지 되돌린다
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const sinceMidnight = (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000;
  return new Date(now.getTime() - sinceMidnight - now.getMilliseconds());
}

/** 다음 한도 초기화 시각 (내일 태평양 시간 0시) */
export const nextGeminiReset = (now = new Date()) => startOfGeminiDay(new Date(now.getTime() + 24 * 3600_000));

/** 이 모델을 오늘 한도만큼 이미 썼는지 (앱이 직접 센 성공 횟수 기준) */
export async function dailyLimitReached(model: string) {
  const limit = dailyLimits()[model];
  if (!limit) return false;
  const { count, error } = await supabaseAdmin()
    .from("gemini_log")
    .select("id", { count: "exact", head: true })
    .eq("model", model)
    .eq("status", "ok")
    .gte("created_at", startOfGeminiDay().toISOString());
  return !error && (count ?? 0) >= limit;
}

/** 호출 한 번을 기록한다. 기록이 실패해도 본래 작업은 그대로 진행한다. */
export function logGemini(entry: {
  model: string;
  kind: GeminiKind;
  status: "ok" | "rate_limited" | "error";
  inputTokens?: number | null;
  outputTokens?: number | null;
}) {
  return supabaseAdmin()
    .from("gemini_log")
    .insert({
      model: entry.model,
      kind: entry.kind,
      status: entry.status,
      input_tokens: entry.inputTokens ?? null,
      output_tokens: entry.outputTokens ?? null,
    })
    .then(({ error }) => {
      if (error) console.error("Gemini 사용 기록 실패:", error.message);
    });
}
