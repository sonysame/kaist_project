import "server-only";
import { createClient } from "@supabase/supabase-js";

export const BUCKET = "audio";

// 로그인 없이 쓰는 앱이라 DB와 Storage는 모두 서버에서 secret key로만 접근한다.
// 테이블은 RLS가 켜져 있고 정책이 없어서 브라우저의 publishable key로는 읽을 수 없다.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 환경 변수가 없습니다.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
