import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Noto_Sans_KR } from "next/font/google";
import { Headphones } from "@/components/icons";
import { Suspense } from "react";
import { CurrentNavLinks, NavLinks } from "@/components/nav-links";
import { AuthProvider } from "@/components/auth-provider";
import { AccountMenu } from "@/components/account-menu";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const notoKr = Noto_Sans_KR({ variable: "--font-noto-kr", weight: ["400", "500", "700", "900"], preload: false });

export const metadata: Metadata = {
  title: "ListenUp · 진짜 영어로 듣기 공부",
  description: "영어 오디오를 화자별 대본으로 바꾸고, 한국어 해석과 단어장으로 공부해요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} ${notoKr.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <AuthProvider>
        <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-warm text-white shadow-card">
                <Headphones width={18} height={18} />
              </span>
              <span className="leading-tight">
                <span className="block text-[17px] font-black tracking-tight">ListenUp</span>
                <span className="hidden text-[11px] font-medium text-muted sm:block">진짜 영어로 듣기 공부</span>
              </span>
            </Link>
            {/* 현재 주소로 메뉴를 강조하는 부분만 요청 시점에 그린다 */}
            <Suspense fallback={<NavLinks path={null} />}>
              <CurrentNavLinks />
            </Suspense>
            <AccountMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          화자 분리·번역은 Google Gemini 무료 모델로 처리돼요
        </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
