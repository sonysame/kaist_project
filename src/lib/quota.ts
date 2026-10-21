import "server-only";
import { supabaseAdmin } from "./supabase-server";

/** 사용자 한 명이 하루에 올릴 수 있는 오디오 수 (Gemini 무료 한도를 나눠 쓰기 위해) */
export const DAILY_UPLOAD_LIMIT = 3;

/** 한국 시간 기준 오늘 0시를 UTC 시각으로 */
export function startOfTodayKST(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 3600_000);
}

export async function uploadsToday(userId: string) {
  const { count, error } = await supabaseAdmin()
    .from("upload_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfTodayKST().toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function recordUpload(userId: string) {
  const { error } = await supabaseAdmin().from("upload_log").insert({ user_id: userId });
  if (error) throw new Error(error.message);
}
