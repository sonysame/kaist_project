import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase-server";
import { isSampleJob } from "./sample";

/** 요청 쿠키에 담긴 로그인 세션으로 Supabase에 접속하는 클라이언트 (사용자 확인용) */
export async function supabaseSession() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // 서버 컴포넌트처럼 쿠키를 쓸 수 없는 곳에서는 proxy.ts가 세션을 새로 고친다
        }
      },
    },
  });
}

/** 로그인한 사용자. 없으면 null */
export async function currentUser(): Promise<User | null> {
  const { data } = await (await supabaseSession()).auth.getUser();
  return data.user ?? null;
}

export const unauthorized = () => Response.json({ error: "로그인이 필요해요." }, { status: 401 });

/** 관리자 이메일 목록: 환경 변수 ADMIN_EMAILS에 쉼표로 적는다 (예: a@gmail.com,b@gmail.com) */
/** 관리자 API 입구: 관리자가 아니면 돌려보낼 응답을, 맞으면 null을 준다 */
export async function requireAdmin() {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (!isAdmin(user)) return Response.json({ error: "관리자만 할 수 있어요." }, { status: 403 });
  return null;
}

export function isAdmin(user: User | null) {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!user?.email && list.includes(user.email.toLowerCase());
}
const notFound = () => Response.json({ error: "작업을 찾을 수 없어요." }, { status: 404 });

/**
 * 로그인했고 이 작업의 주인인지 확인한다. 아니면 돌려줄 오류 응답을, 맞으면 사용자를 준다.
 * 남의 작업은 있는지조차 알 수 없게 "찾을 수 없음"으로 답한다.
 */
export async function requireJobOwner(jobId: string): Promise<{ user: User } | { error: Response }> {
  const user = await currentUser();
  if (!user) return { error: unauthorized() };
  const { data } = await supabaseAdmin().from("jobs").select("user_id").eq("id", jobId).maybeSingle();
  if (!data || data.user_id !== user.id) return { error: notFound() };
  return { user };
}

/** 처리 이어 가기 권한: 주인 또는 관리자 (멈춘 남의 자료를 관리자가 다시 시도할 수 있게) */
export async function requireJobProcessor(jobId: string): Promise<{ user: User } | { error: Response }> {
  const user = await currentUser();
  if (!user) return { error: unauthorized() };
  if (isAdmin(user)) return { user };
  return requireJobOwner(jobId);
}

/** 보기 권한: 내 작업이거나 샘플이면 볼 수 있다 (샘플은 로그인하지 않아도). canEdit은 주인일 때만 true. */
export async function requireJobReader(
  jobId: string,
): Promise<{ user: User | null; canEdit: boolean } | { error: Response }> {
  const user = await currentUser();
  const { data } = await supabaseAdmin().from("jobs").select("user_id").eq("id", jobId).maybeSingle();
  if (!data) return { error: notFound() };
  const owner = !!user && data.user_id === user.id;
  // 관리자는 관리자 페이지에서 누구의 자료든 열어 볼 수 있다 (수정은 주인만)
  if (owner || isSampleJob(jobId) || isAdmin(user)) return { user, canEdit: owner };
  return { error: user ? notFound() : unauthorized() };
}
