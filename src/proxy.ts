import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SAMPLE_JOB_ID } from "@/lib/sample";

/**
 * 모든 페이지 요청에서 로그인 세션을 새로 고치고(쿠키 갱신),
 * 로그인하지 않은 사람이 학습 자료·단어장 화면에 오면 첫 화면으로 보낸다.
 * API는 각 핸들러에서 사용자를 다시 확인한다.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // 샘플 학습 자료는 로그인하지 않아도 볼 수 있다
  const isSample = path === `/jobs/${SAMPLE_JOB_ID}`;
  const needsLogin = !isSample && (path.startsWith("/jobs") || path.startsWith("/vocab") || path.startsWith("/admin"));
  if (needsLogin && !data.user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = `?login=1&next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // 정적 파일과 이미지, ffmpeg 파일은 건너뛴다
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ffmpeg/|.*\\.(?:png|jpg|jpeg|svg|webp|js|wasm)$).*)"],
};
