"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Quota = { used: number; limit: number; isAdmin: boolean };
type AuthState = {
  /** undefined: 아직 확인 중, null: 로그인 안 함 */
  user: User | null | undefined;
  quota: Quota | null;
  refreshQuota: () => Promise<void>;
  signIn: (next?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider 안에서만 쓸 수 있어요.");
  return ctx;
}

/** 로그인 상태와 오늘 업로드 횟수를 화면 전체에서 함께 쓴다 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [quota, setQuota] = useState<Quota | null>(null);

  const refreshQuota = useCallback(async () => {
    const r = await fetch("/api/quota", { cache: "no-store" }).catch(() => null);
    setQuota(r?.ok ? await r.json() : null);
  }, []);

  useEffect(() => {
    const auth = supabaseBrowser().auth;
    auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // 로그인 상태가 바뀌면 그 사람의 업로드 횟수를 다시 읽는다 (fetch가 끝난 뒤에만 state를 바꿈)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) refreshQuota();
    else if (user === null) setQuota(null);
  }, [user, refreshQuota]);

  const signIn = useCallback(async (next?: string) => {
    const target = next && next.startsWith("/") ? next : window.location.pathname;
    await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}` },
    });
  }, []);

  const router = useRouter();
  const signOut = useCallback(async () => {
    await supabaseBrowser().auth.signOut();
    router.push("/");
    router.refresh();
  }, [router]);

  return <AuthContext value={{ user, quota, refreshQuota, signIn, signOut }}>{children}</AuthContext>;
}
