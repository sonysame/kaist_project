import { Uploader } from "@/components/uploader";
import { RecentJobs } from "@/components/recent-jobs";
import { HowItWorksComic } from "@/components/how-it-works-comic";
import { Sparkles } from "@/components/icons";

export default function Home() {
  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-warm-soft blur-3xl"
        />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
              <Sparkles width={14} height={14} /> AI 화자 분리 · 한국어 해석
            </span>
            <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight sm:text-[56px]">
              Hear it.
              <br />
              Read it.
              <br />
              <span className="bg-gradient-to-r from-accent to-warm bg-clip-text text-transparent">Own it.</span>
            </h1>
          </div>
          <Uploader />
        </div>
      </section>

      <HowItWorksComic />

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">내 학습 자료</h2>
            <p className="mt-1 text-sm text-muted">올린 오디오를 다시 열어 이어서 공부할 수 있어요.</p>
          </div>
        </div>
        <RecentJobs />
      </section>
    </div>
  );
}
