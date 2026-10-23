import { supabaseAdmin } from "@/lib/supabase-server";
import { requireJobReader, unauthorized } from "@/lib/auth";

/** 어디까지 들었는지 저장: { position } (초). 볼 수 있는 자료(내 자료·샘플)면 로그인한 누구나. */
export async function PUT(request: Request, ctx: RouteContext<"/api/jobs/[id]/progress">) {
  const { id } = await ctx.params;
  const auth = await requireJobReader(id);
  if ("error" in auth) return auth.error;
  if (!auth.user) return unauthorized();
  const { position } = (await request.json().catch(() => ({}))) as { position?: number };
  if (typeof position !== "number" || !Number.isFinite(position) || position < 0) {
    return Response.json({ error: "위치가 필요해요." }, { status: 400 });
  }
  const { error } = await supabaseAdmin()
    .from("study_progress")
    .upsert({ user_id: auth.user.id, job_id: id, position_sec: position, updated_at: new Date().toISOString() });
  // 표가 아직 없으면(009 SQL 실행 전) 조용히 넘어간다
  if (error) return Response.json({ ok: false });
  return Response.json({ ok: true });
}

// 창을 닫을 때 navigator.sendBeacon은 POST로만 보낼 수 있어서 같은 처리를 POST로도 받는다
export const POST = PUT;
