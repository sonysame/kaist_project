"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, UploadCloud } from "./icons";

const LINKS = [
  { href: "/", label: "새 파일", icon: UploadCloud, match: (p: string) => p === "/" },
  { href: "/vocab", label: "단어장", icon: BookOpen, match: (p: string) => p.startsWith("/vocab") },
];

/** usePathname은 요청 시점 값이라 레이아웃에서는 Suspense 안에서만 쓴다 */
export function CurrentNavLinks() {
  return <NavLinks path={usePathname()} />;
}

export function NavLinks({ path }: { path: string | null }) {
  return (
    <nav className="ml-auto flex gap-1">
      {LINKS.map(({ href, label, icon: Icon, match }) => {
        const on = path !== null && match(path);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
              on ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Icon width={16} height={16} />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
