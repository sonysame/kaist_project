import { Uploader } from "@/components/uploader";
import { RecentJobs } from "@/components/recent-jobs";
import { BookOpen, Languages, Sparkles, Users } from "@/components/icons";

const STEPS = [
  { icon: Users, title: "화자별 대본", body: "누가 말했는지 나눠서 영어로 받아 적어요." },
  { icon: Languages, title: "마우스만 올리면 해석", body: "문장에 마우스를 올리면 한국어 뜻이 떠요." },
  { icon: BookOpen, title: "나만의 단어장", body: "모르는 단어를 누르면 문맥에 맞는 뜻과 함께 저장돼요." },
];

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

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <div key={title} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon />
              </span>
              <span className="text-xs font-bold text-muted">STEP {i + 1}</span>
            </div>
            <h3 className="mt-3 font-bold">{title}</h3>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>

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
