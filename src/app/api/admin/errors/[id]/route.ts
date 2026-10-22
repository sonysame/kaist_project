import { supabaseAdmin } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/auth";
import { RateLimitError } from "@/lib/gemini";
import { correctJob, retranslate, summarizeJob } from "@/lib/finish-steps";

// 교정은 긴 대본이면 1분 넘게 걸릴 수 있다
export const maxDuration = 300;

/** 건너뛴 단계를 다시 실행해서 해결한다. 멈춘 처리는 자료 화면의 '다시 시도'로 이어 가야 해서 여기서는 못 한다. */
export async function POST(_request: Request, ctx: RouteContext<"/api/admin/errors/[id]">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  const { data: row } = await db.from("error_log").select("*").eq("id", id).maybeSingle();
  if (!row) return Response.json({ error: "오류 기록을 찾을 수 없어요." }, { status: 404 });
  if (row.resolved_at) return Response.json({ ok: true, resolved_at: row.resolved_at });
  if (!row.job_id) return Response.json({ error: "학습 자료가 지워져서 다시 실행할 수 없어요. 기록만 지워 주세요." }, { status: 400 });
  if (!row.skipped) {
    return Response.json({ error: "멈춘 처리는 학습 자료 화면에서 '다시 시도'를 눌러 이어 가 주세요." }, { status: 400 });
  }

  try {
    if (row.step === "교정") await correctJob(row.job_id);
    else if (row.step === "요약") await summarizeJob(row.job_id);
    else if (row.step === "다시 해석") await retranslate((row.detail as { ids?: number[] } | null)?.ids ?? []);
    else return Response.json({ error: `'${row.step}' 단계는 다시 실행할 수 없어요.` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `아직 안 돼요: ${message}` }, { status: err instanceof RateLimitError ? 429 : 500 });
  }

  const resolved_at = new Date().toISOString();
  await db.from("error_log").update({ resolved_at }).eq("id", id);
  return Response.json({ ok: true, resolved_at });
}

/** 오류 기록 지우기 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/errors/[id]">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const { error } = await supabaseAdmin().from("error_log").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
