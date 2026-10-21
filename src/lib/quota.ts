import "server-only";
import { supabaseAdmin } from "./supabase-server";

/** 사용자 한 명이 하루에 올릴 수 있는 오디오 수의 기본값 (Gemini 무료 한도를 나눠 쓰기 위해). 관리자 페이지에서 바꿀 수 있다. */
export const DEFAULT_UPLOAD_LIMIT = 3;
export const MAX_UPLOAD_LIMIT = 100;
const LIMIT_KEY = "upload.daily_limit";

// 모델 설정처럼 30초 동안 기억해 둔다 (models.ts)
let limitCache: { at: number; value: number } | null = null;

/** 지금 하루 업로드 한도: 관리자 페이지 설정(DB) → 기본값 */
export async function getUploadLimit() {
  if (limitCache && Date.now() - limitCache.at < 30_000) return limitCache.value;
  const { data, error } = await supabaseAdmin().from("app_settings").select("value").eq("key", LIMIT_KEY).maybeSingle();
  const n = Number(data?.value);
  const value = !error && Number.isInteger(n) && n >= 0 ? n : DEFAULT_UPLOAD_LIMIT;
  limitCache = { at: Date.now(), value };
  return value;
}

export async function setUploadLimit(limit: number) {
  const { error } = await supabaseAdmin()
    .from("app_settings")
    .upsert({ key: LIMIT_KEY, value: String(limit), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  limitCache = null;
}

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
