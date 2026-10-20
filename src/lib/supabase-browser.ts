import { createClient } from "@supabase/supabase-js";

// 브라우저에서는 서버가 발급한 서명 URL로 파일을 올릴 때만 쓴다.
export function supabaseBrowser() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}
