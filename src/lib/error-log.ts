import "server-only";
import { supabaseAdmin } from "./supabase-server";

/** 오류 내용을 사람이 읽을 한 줄로. Gemini 오류는 {"error":{"message":...}} 안의 메시지만 꺼낸다. */
function messageOf(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as { error?: { code?: number; message?: string } };
    if (parsed.error?.message) return `${parsed.error.code ?? ""} ${parsed.error.message}`.trim();
  } catch {
    // JSON이 아니면 그대로 쓴다
  }
  return raw;
}

/**
 * 처리 중 오류를 관리자 페이지에서 볼 수 있게 남긴다. skipped면 그 단계만 빠지고 처리는 계속된 경우다.
 * 기록이 실패해도(표가 아직 없어도) 본래 작업은 그대로 진행한다.
 */
export async function logError(entry: { jobId: string; step: string; error: unknown; skipped?: boolean; detail?: unknown }) {
  console.error(`[${entry.step}]${entry.skipped ? " 건너뜀" : ""}:`, entry.error);
  const db = supabaseAdmin();
  const { data: job } = await db.from("jobs").select("filename").eq("id", entry.jobId).maybeSingle();
  const { error } = await db.from("error_log").insert({
    job_id: entry.jobId,
    filename: job?.filename ?? null,
    step: entry.step,
    message: messageOf(entry.error).slice(0, 1000),
    skipped: !!entry.skipped,
    detail: entry.detail ?? null,
  });
  if (error) console.error("오류 기록 실패:", error.message);
}

/** 처리가 끝까지 됐으면, 그 자료의 '처리 멈춤' 오류는 해결된 것으로 표시한다 */
export async function resolveStoppedErrors(jobId: string) {
  const { error } = await supabaseAdmin()
    .from("error_log")
    .update({ resolved_at: new Date().toISOString() })
    .eq("job_id", jobId)
    .eq("skipped", false)
    .is("resolved_at", null);
  if (error) console.error("오류 해결 표시 실패:", error.message);
}
