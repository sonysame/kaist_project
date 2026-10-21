import { NextResponse } from "next/server";
import { supabaseSession } from "@/lib/auth";

/** 구글 로그인 후 Supabase가 돌려보내는 주소. 받은 코드를 세션 쿠키로 바꾸고 원래 가려던 곳으로 보낸다. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  // 다른 사이트로 보내지 않도록 우리 사이트 안의 경로만 허용
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const { error } = await (await supabaseSession()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/?login=error", url.origin));
}
