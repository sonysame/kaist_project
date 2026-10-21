import { Uploader } from "@/components/uploader";
import { RecentJobs } from "@/components/recent-jobs";
import { HomeGate } from "@/components/home-gate";
import { HowItWorksComic } from "@/components/how-it-works-comic";

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
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-[56px]">
              Hear it.
              <br />
              Read it.
              <br />
              <span className="bg-gradient-to-r from-accent to-warm bg-clip-text text-transparent">Own it.</span>
            </h1>
          </div>
          <HomeGate>
            <Uploader />
          </HomeGate>
        </div>
      </section>

      <HowItWorksComic />

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-bold tracking-tight">내 학습 자료</h2>
        </div>
        {/* 샘플은 로그인하지 않아도 보이고, 로그인하면 내가 올린 자료가 함께 나온다 */}
        <RecentJobs />
      </section>
    </div>
  );
}
