import { supabaseAdmin } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/auth";

/** 관리자 페이지: 최근 오류 기록 (해결 안 된 것 먼저) */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { data, error } = await supabaseAdmin()
    .from("error_log")
    .select("id, job_id, filename, step, message, skipped, resolved_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  // 표가 아직 없으면(007 SQL 실행 전) 빈 목록과 안내를 준다
  if (error) return Response.json({ ready: false, errors: [] });
  const errors = [...(data ?? [])].sort((a, b) => Number(!!a.resolved_at) - Number(!!b.resolved_at));
  return Response.json({ ready: true, errors });
}
