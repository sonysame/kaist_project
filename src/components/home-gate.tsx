"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { GoogleMark } from "./google-mark";

/**
 * 첫 화면에서 로그인한 사람에게만 children(업로드 칸)을 보여 준다.
 * 로그인하지 않았으면 구글로 시작하기 카드를 보여 준다.
 */
export function HomeGate({ children }: { children: ReactNode }) {
  const { user, signIn } = useAuth();
  const [notice, setNotice] = useState<{ text: string; next?: string } | null>(null);

  useEffect(() => {
    // 로그인이 필요한 화면에서 넘어왔으면 안내 (주소의 ?login= 값은 브라우저에서만 읽을 수 있다)
    const q = new URLSearchParams(window.location.search);
    const login = q.get("login");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (login === "1") setNotice({ text: "로그인하면 볼 수 있는 화면이에요.", next: q.get("next") ?? undefined });
    else if (login === "error") setNotice({ text: "로그인하지 못했어요. 다시 시도해 주세요." });
  }, []);

  if (user === undefined) {
    return <div className="h-56 animate-pulse rounded-2xl bg-surface-2" />;
  }
  if (user) return <>{children}</>;

  return (
    <div className="rounded-2xl border-2 border-dashed border-line bg-surface-2/60 p-6 text-center sm:p-8">
      <p className="text-lg font-bold">무료로 시작해 보세요</p>
      <p className="mt-1 text-sm text-muted">구글 계정으로 로그인하면 하루 3개까지 오디오를 올릴 수 있어요.</p>
      {notice && <p className="mt-4 rounded-lg bg-warm-soft px-3 py-2 text-sm">{notice.text}</p>}
      <button
        onClick={() => signIn(notice?.next ?? "/")}
        className="mt-5 inline-flex items-center gap-2.5 rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold shadow-card transition hover:border-accent"
      >
        <GoogleMark className="h-5 w-5" />
        Google로 시작하기
      </button>
    </div>
  );
}
