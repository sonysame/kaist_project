"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clock, download, toSrt, toText, type ExportLang } from "@/lib/format";
import type { JobDetail, Utterance } from "@/lib/types";
import { AD_LABEL, Avatar, TranscriptRow } from "./transcript-row";
import { WordPopover, type WordTarget } from "./word-popover";
import { Player } from "./player";
import { Theater } from "./theater";
import { ArrowLeft, Clock, Download, Film, Megaphone, Text, Trash, Users } from "./icons";

type RunState =
  | { kind: "idle" }
  | { kind: "running"; label: string }
  | { kind: "waiting"; until: number; message: string }
  | { kind: "failed"; message: string };

type Range = { start: number; end: number };

const RATE_LIMIT_WAIT_MS = 60_000;

export function JobView({ id }: { id: string }) {
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [alwaysKo, setAlwaysKo] = useState(false);
  const [follow, setFollow] = useState(true);
  const [showAds, setShowAds] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [target, setTarget] = useState<WordTarget | null>(null);
  const [theaterOpen, setTheaterOpen] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const runToken = useRef(0);
  const loopRange = useRef<Range | null>(null);
  const stopAt = useRef<number | null>(null); // "이 문장만 듣기"로 재생할 때 멈출 시각
  const scrollToAdPending = useRef(false);

  // 연속된 광고 문장을 하나로 묶은 구간 (목록 표시와 재생 건너뛰기에 씀)
  const adBlocks = useMemo(() => {
    const ranges: (Range & { firstId: number })[] = [];
    for (const u of job?.utterances ?? []) {
      if (!u.is_ad) continue;
      const last = ranges[ranges.length - 1];
      if (last && u.start_sec - last.end < 3) last.end = Math.max(last.end, u.end_sec);
      else ranges.push({ start: u.start_sec, end: u.end_sec, firstId: u.id });
    }
    return ranges;
  }, [job?.utterances]);
  const skipRanges = useRef<Range[]>([]);
  useEffect(() => {
    skipRanges.current = showAds ? [] : adBlocks;
  }, [adBlocks, showAds]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setJob((prev) => (prev?.audio_url && data.audio_url ? { ...data, audio_url: prev.audio_url } : data));
    return data as JobDetail;
  }, [id]);

  useEffect(() => {
    // load는 fetch가 끝난 뒤에만 state를 바꾼다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setLoadError(e.message));
  }, [load]);

  // 처리가 끝날 때까지 서버에 한 단계씩 요청한다. 창을 다시 열면 멈춘 곳부터 이어진다.
  const process = useCallback(async () => {
    const token = ++runToken.current;
    const alive = () => runToken.current === token;
    while (alive()) {
      const current = await load().catch(() => null);
      if (!alive()) return; // 기다리는 동안 다른 루프가 시작됐으면 같은 구간을 두 번 처리하지 않도록 멈춘다
      if (!current || current.status === "done" || current.status === "uploading") break;
      const next = current.chunks.find((c) => c.status !== "translated");
      const label = next
        ? `${next.idx + 1}/${current.chunk_count} 구간 ${next.status === "pending" ? "받아 적는 중" : "해석하는 중"}…`
        : "광고를 찾고 화자 이름을 정하는 중…";
      setRun({ kind: "running", label });

      const res = await fetch(`/api/jobs/${id}/step`, { method: "POST" }).catch(() => null);
      const body = res ? await res.json().catch(() => ({})) : { error: "네트워크 오류가 났어요." };
      if (!alive()) return;
      if (res?.ok) {
        if (body.done) break;
        continue;
      }
      if (res?.status === 429) {
        const until = Date.now() + RATE_LIMIT_WAIT_MS;
        setRun({ kind: "waiting", until, message: body.error });
        await new Promise((r) => setTimeout(r, RATE_LIMIT_WAIT_MS));
        continue;
      }
      setRun({ kind: "failed", message: body.error ?? "처리 중 오류가 났어요." });
      await load().catch(() => null);
      return;
    }
    if (alive()) {
      setRun({ kind: "idle" });
      await load().catch(() => null);
    }
  }, [id, load]);

  // 처리 진행은 주인만 한다 (샘플을 보러 온 사람이 처리를 돌리지 않도록)
  const shouldAutoRun = job?.status === "processing" && job.can_edit;
  useEffect(() => {
    // 서버 처리 루프를 시작하는 외부 동기화라서 effect에서 부른다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (shouldAutoRun) process();
    const tokens = runToken;
    return () => {
      tokens.current++; // 화면을 떠나면 진행 중인 루프를 멈춘다
    };
  }, [shouldAutoRun, process]);

  // 재생 위치를 부드럽게 따라가려고 재생 중에는 매 프레임 시간을 읽는다
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    let frame = 0;
    const tick = () => {
      // 문장 반복: 문장 끝을 지나면 처음으로
      const lr = loopRange.current;
      if (lr && el.currentTime >= lr.end + 0.15) el.currentTime = lr.start;
      // 한 문장만 듣기: 문장 끝에서 멈춘다 (반복 중이면 반복이 우선)
      else if (stopAt.current !== null && el.currentTime >= stopAt.current + 0.1) {
        stopAt.current = null;
        el.pause();
      }
      // 광고를 숨겼으면 재생도 광고 구간을 건너뛴다
      const skip = skipRanges.current.find((r) => el.currentTime >= r.start && el.currentTime < r.end - 0.2);
      if (skip) el.currentTime = skip.end;
      setTime(el.currentTime);
      if (!el.paused) frame = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      setPlaying(true);
      frame = requestAnimationFrame(tick);
    };
    const onPause = () => setPlaying(false);
    const onSeek = () => setTime(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("seeked", onSeek);
    el.addEventListener("loadedmetadata", onMeta);
    if (el.readyState >= 1) onMeta();
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("seeked", onSeek);
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, [job?.audio_url]);

  // 단어장에서 "들으러 가기"로 들어오면 ?t=초 위치로 이동
  useEffect(() => {
    const el = audio.current;
    const t = Number(new URLSearchParams(window.location.search).get("t"));
    if (!el || !t) return;
    const go = () => {
      el.currentTime = t;
      setTime(t);
    };
    if (el.readyState >= 1) go();
    else el.addEventListener("loadedmetadata", go, { once: true });
  }, [job?.audio_url]);

  const scrolledToT = useRef(false);
  useEffect(() => {
    const t = Number(new URLSearchParams(window.location.search).get("t"));
    if (scrolledToT.current || !t || !job?.utterances.length) return;
    const u = job.utterances[findActive(job.utterances, t)];
    if (u) document.getElementById(`u-${u.id}`)?.scrollIntoView({ block: "center" });
    scrolledToT.current = true;
  }, [job?.utterances]);

  const utterances = useMemo(
    () => (job?.utterances ?? []).filter((u) => showAds || !u.is_ad),
    [job?.utterances, showAds],
  );
  const activeIdx = useMemo(() => findActive(utterances, time), [utterances, time]);
  const activeWord = useMemo(() => {
    const u = utterances[activeIdx];
    if (!u || time > u.end_sec + 0.3) return -1;
    let w = -1;
    for (let i = 0; i < u.words.length && u.words[i].s <= time; i++) w = i;
    return w;
  }, [utterances, activeIdx, time]);

  useEffect(() => {
    if (!follow || activeIdx < 0 || audio.current?.paused) return;
    document.getElementById(`u-${utterances[activeIdx]?.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIdx, follow, utterances]);

  // 광고 보기를 켜면 첫 광고로 스크롤
  useEffect(() => {
    if (!scrollToAdPending.current || !showAds) return;
    scrollToAdPending.current = false;
    const first = adBlocks[0];
    if (first) document.getElementById(`u-${first.firstId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [showAds, adBlocks]);

  const names = useCallback((spk: string) => job?.speaker_names[spk] || defaultName(spk), [job?.speaker_names]);
  const label = useCallback((u: Utterance) => (u.is_ad ? AD_LABEL : names(u.speaker)), [names]);

  const seekTo = useCallback((sec: number, play = false) => {
    const el = audio.current;
    if (!el) return;
    stopAt.current = null;
    el.currentTime = Math.max(0, sec);
    setTime(el.currentTime);
    if (play) el.play().catch(() => {});
  }, []);

  const playUtterance = useCallback(
    (u: Utterance) => {
      if (loopRange.current) loopRange.current = { start: u.start_sec, end: u.end_sec };
      seekTo(u.start_sec, true);
    },
    [seekTo],
  );

  const playOnce = useCallback(
    (u: Utterance) => {
      if (loopRange.current) loopRange.current = { start: u.start_sec, end: u.end_sec };
      seekTo(u.start_sec, true);
      stopAt.current = u.end_sec;
    },
    [seekTo],
  );

  function togglePlay() {
    const el = audio.current;
    if (!el) return;
    stopAt.current = null;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  function changeRate(r: number) {
    setRate(r);
    if (audio.current) audio.current.playbackRate = r;
  }

  function changeLoop(on: boolean) {
    setLoop(on);
    const u = utterances[Math.max(0, activeIdx)];
    loopRange.current = on && u ? { start: u.start_sec, end: u.end_sec } : null;
  }

  function changeShowAds(on: boolean) {
    scrollToAdPending.current = on;
    setShowAds(on);
  }

  function jumpToAd(block: Range & { firstId: number }) {
    if (!showAds) changeShowAds(true);
    requestAnimationFrame(() =>
      document.getElementById(`u-${block.firstId}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
    seekTo(block.start);
  }

  const closePopover = useCallback(() => setTarget(null), []);
  const pickWord = useCallback((u: Utterance, wordIdx: number, rect: DOMRect) => setTarget({ u, wordIdx, rect }), []);

  const speakers = useMemo(
    () => [...new Set(utterances.filter((u) => !u.is_ad).map((u) => u.speaker))].sort(bySpeakerNo),
    [utterances],
  );

  async function rename(spk: string, name: string) {
    if (!job) return;
    const trimmed = name.trim();
    if (trimmed === names(spk)) return; // 바꾸지 않고 나간 경우
    const speaker_names = { ...job.speaker_names, [spk]: trimmed };
    // 비우면 기본 이름(화자 N)으로 돌아간다
    if (!trimmed || trimmed === defaultName(spk)) delete speaker_names[spk];
    setJob({ ...job, speaker_names });
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speakerNames: speaker_names }),
    });
  }

  // 모델이 같은 사람을 둘로 나눴을 때 사용자가 직접 합친다
  async function merge(from: string, into: string) {
    if (!confirm(`${names(from)}의 문장을 모두 ${names(into)}(으)로 옮길까요?`)) return;
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merge: { from, into } }),
    });
    await load().catch(() => null);
  }

  async function remove() {
    if (!confirm("이 작업과 오디오를 삭제할까요? 되돌릴 수 없어요.")) return;
    runToken.current++;
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    router.push("/");
  }

  function exportAs(kind: "txt" | "srt", lang: ExportLang) {
    if (!job) return;
    const base = job.filename.replace(/\.[^.]+$/, "");
    const suffix = { en: "영어", ko: "한국어", both: "영어+한국어" }[lang];
    const text = kind === "txt" ? toText(utterances, label, lang) : toSrt(utterances, label, lang);
    download(`${base}_${suffix}.${kind}`, text);
  }

  if (loadError) return <p className="rounded-xl bg-danger-soft p-4 text-danger">{loadError}</p>;
  if (!job) return <JobSkeleton />;

  const finishedChunks = job.chunks.filter((c) => c.status === "translated").length;
  const contentCount = utterances.filter((u) => !u.is_ad).length;

  return (
    <div className="pb-28 lg:pb-0">
      {job.audio_url && <audio ref={audio} src={job.audio_url} preload="metadata" className="hidden" />}

      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent">
        <ArrowLeft width={16} height={16} /> 내 학습 자료
      </Link>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">{job.filename.replace(/\.[^.]+$/, "")}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {job.is_sample && (
              <span className="inline-flex items-center rounded-full bg-warm-soft px-3 py-1 font-semibold text-warm">
                샘플 학습 자료
              </span>
            )}
            <Meta icon={<Clock width={15} height={15} />}>{clock(job.duration_sec)}</Meta>
            <Meta icon={<Users width={15} height={15} />}>화자 {speakers.length}명</Meta>
            <Meta icon={<Text width={15} height={15} />}>문장 {contentCount}개</Meta>
          </div>
        </div>
        {job.can_edit && (
          <button
            onClick={remove}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-muted hover:border-danger hover:text-danger"
            title="삭제"
            aria-label="삭제"
          >
            <Trash width={18} height={18} />
          </button>
        )}
      </div>

      {job.status !== "done" && (
        <div className="mt-6">
          <StatusPanel job={job} run={run} finished={finishedChunks} onRetry={process} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:order-last lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pb-2">
          {job.audio_url && (
            <Player
              time={time}
              duration={duration || job.duration_sec}
              playing={playing}
              rate={rate}
              loop={loop}
              onToggle={togglePlay}
              onSkip={(d) => seekTo(time + d)}
              onSeek={(s) => seekTo(s)}
              onRate={changeRate}
              onLoop={changeLoop}
            />
          )}

          {speakers.length > 0 && (
            <Card title="화자">
              <ul className="space-y-1">
                {speakers.map((s) => (
                  <SpeakerItem
                    key={s}
                    id={s}
                    name={names(s)}
                    count={utterances.filter((u) => !u.is_ad && u.speaker === s).length}
                    others={speakers.filter((o) => o !== s).map((o) => ({ id: o, name: names(o) }))}
                    editable={job.can_edit}
                    onRename={(n) => rename(s, n)}
                    onMerge={(into) => merge(s, into)}
                  />
                ))}
              </ul>
              {job.can_edit && (
                <p className="mt-3 text-xs text-muted">이름을 누르면 바꿀 수 있어요. 같은 사람이 둘로 나뉘었으면 ⋯로 합치세요.</p>
              )}
            </Card>
          )}

          <Card title="보기 설정">
            <div className="space-y-3">
              <Switch checked={alwaysKo} onChange={setAlwaysKo} label="해석 항상 보기" hint="끄면 문장마다 KOR 버튼을 눌러 볼 수 있어요" />
              <Switch checked={follow} onChange={setFollow} label="재생 위치 따라가기" />
              {adBlocks.length > 0 && (
                <Switch
                  checked={showAds}
                  onChange={changeShowAds}
                  label={`광고 보기`}
                  hint={`광고 ${adBlocks.length}곳은 숨기고 재생할 때도 건너뛰어요`}
                />
              )}
            </div>
            {adBlocks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {adBlocks.map((b, i) => (
                  <button
                    key={b.firstId}
                    onClick={() => jumpToAd(b)}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted hover:bg-accent-soft hover:text-accent"
                  >
                    <Megaphone width={12} height={12} />
                    광고 {i + 1} · {clock(b.start)}
                  </button>
                ))}
              </div>
            )}
          </Card>

          <ExportCard
            onExport={exportAs}
            disabled={!utterances.length}
            onTheater={job.audio_url && job.utterances.length ? () => setTheaterOpen(true) : undefined}
          />
        </aside>

        <section className="min-w-0 rounded-3xl border border-line bg-surface p-3 shadow-card sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2 pt-1">
            <h2 className="text-lg font-bold">대본</h2>
            <p className="text-xs text-muted">
              <span className="rounded bg-accent-soft px-1.5 py-0.5 font-semibold text-accent">단어</span>를 누르면 뜻 ·
              KOR 버튼을 누르면 해석
            </p>
          </div>
          <div>
            {utterances.map((u, i) => (
              <TranscriptRow
                key={u.id}
                u={u}
                name={label(u)}
                showSpeaker={i === 0 || groupKey(utterances[i - 1]) !== groupKey(u)}
                active={i === activeIdx}
                activeWord={i === activeIdx ? activeWord : -1}
                alwaysKo={alwaysKo}
                onSeek={playUtterance}
                onPlayOnce={playOnce}
                onWord={pickWord}
              />
            ))}
            {!utterances.length && job.status !== "done" && (
              <p className="py-16 text-center text-muted">첫 구간을 받아 적는 중이에요. 보통 1~2분 걸려요.</p>
            )}
          </div>
        </section>
      </div>

      {theaterOpen && (
        <Theater
          title={job.filename}
          audioRef={audio}
          duration={duration || job.duration_sec}
          playing={playing}
          utterances={job.utterances}
          names={label}
          onToggle={togglePlay}
          onSkip={(d) => seekTo((audio.current?.currentTime ?? 0) + d)}
          onSeek={(s) => seekTo(s)}
          onClose={() => setTheaterOpen(false)}
        />
      )}

      {target && (
        <WordPopover key={`${target.u.id}:${target.wordIdx}`} target={target} jobId={id} onClose={closePopover} />
      )}
    </div>
  );
}

function findActive(us: Utterance[], t: number) {
  let lo = 0;
  let hi = us.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (us[m].start_sec <= t) {
      ans = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return ans;
}

const defaultName = (spk: string) => `화자 ${spk.replace(/^S/, "")}`;
// 광고 문장들은 화자와 상관없이 한 덩어리로 묶어 보여 준다
const groupKey = (u: Utterance) => (u.is_ad ? "ad" : u.speaker);

const bySpeakerNo = (a: string, b: string) => Number(a.slice(1)) - Number(b.slice(1));

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-muted">
      {icon}
      <span className="tabular-nums">{children}</span>
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <p className="mb-3 text-xs font-bold tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

function JobSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-32 animate-pulse rounded bg-surface-2" />
      <div className="h-9 w-2/3 animate-pulse rounded-lg bg-surface-2" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-96 animate-pulse rounded-3xl bg-surface-2" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}

function StatusPanel({
  job,
  run,
  finished,
  onRetry,
}: {
  job: JobDetail;
  run: RunState;
  finished: number;
  onRetry: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run.kind !== "waiting") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [run.kind]);

  const ratio = job.chunk_count ? finished / job.chunk_count : 0;
  const failed = run.kind === "failed" || (job.status === "error" && run.kind === "idle");
  const message = run.kind === "failed" ? run.message : job.error;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      {job.status === "uploading" ? (
        <p className="text-sm">업로드가 끝나지 않은 작업이에요. 처음 화면에서 파일을 다시 올려 주세요.</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-semibold">
              {!failed && <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />}
              {run.kind === "running" && run.label}
              {run.kind === "waiting" &&
                `무료 한도에 걸려 잠시 기다리는 중… ${Math.max(0, Math.ceil((run.until - now) / 1000))}초`}
              {failed && <span className="text-danger">처리가 멈췄어요</span>}
              {run.kind === "idle" && !failed && "준비 중…"}
            </span>
            <span className="tabular-nums text-muted">
              {finished}/{job.chunk_count} 구간
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-warm transition-[width]"
              style={{ width: `${Math.max(3, Math.round(ratio * 100))}%` }}
            />
          </div>
          {failed && (
            <div className="mt-3 flex items-center gap-3">
              <p className="flex-1 text-sm text-danger">{message}</p>
              <button onClick={onRetry} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
                다시 시도
              </button>
            </div>
          )}
          {!failed && <p className="mt-2 text-xs text-muted">먼저 끝난 부분부터 아래에 나타나요. 창을 닫아도 다시 열면 이어서 처리돼요.</p>}
        </>
      )}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer select-none items-start gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent"
      />
    </label>
  );
}

function ExportCard({
  onExport,
  disabled,
  onTheater,
}: {
  onExport: (k: "txt" | "srt", l: ExportLang) => void;
  disabled: boolean;
  onTheater?: () => void;
}) {
  const [lang, setLang] = useState<ExportLang>("both");
  return (
    <Card title="내보내기">
      <div className="flex rounded-full bg-surface-2 p-1 text-xs font-semibold" role="group" aria-label="내보낼 언어">
        {(
          [
            ["both", "영어+한국어"],
            ["en", "영어"],
            ["ko", "한국어"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setLang(v)}
            aria-pressed={lang === v}
            className={`flex-1 rounded-full px-2 py-1.5 transition ${lang === v ? "bg-surface text-accent shadow-card" : "text-muted"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["txt", "srt"] as const).map((k) => (
          <button
            key={k}
            disabled={disabled}
            onClick={() => onExport(k, lang)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line py-2 text-sm font-semibold hover:border-accent hover:text-accent disabled:opacity-40"
          >
            <Download width={15} height={15} />
            {k === "txt" ? "대본 TXT" : "자막 SRT"}
          </button>
        ))}
      </div>
      {onTheater && (
        <button
          onClick={onTheater}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-warm py-2.5 text-sm font-semibold text-white shadow-card hover:opacity-95"
        >
          <Film width={16} height={16} /> 캐릭터로 보기
        </button>
      )}
    </Card>
  );
}

function SpeakerItem({
  id,
  name,
  count,
  others,
  editable,
  onRename,
  onMerge,
}: {
  id: string;
  name: string;
  count: number;
  others: { id: string; name: string }[];
  /** 주인만 이름 바꾸기·합치기를 할 수 있다 */
  editable: boolean;
  onRename: (n: string) => void;
  onMerge: (into: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
      <Avatar id={id} name={name} size={32} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRename(value);
              setEditing(false);
            }}
          >
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => {
                onRename(value);
                setEditing(false);
              }}
              className="w-full rounded-md border border-accent bg-surface px-2 py-0.5 text-sm outline-none"
            />
          </form>
        ) : !editable ? (
          <span className="block truncate text-sm font-semibold">{name}</span>
        ) : (
          <button
            onClick={() => {
              setValue(name);
              setEditing(true);
            }}
            className="block max-w-full truncate text-left text-sm font-semibold hover:text-accent"
            title="이름 바꾸기"
          >
            {name}
          </button>
        )}
        <span className="text-xs tabular-nums text-muted">{count}문장</span>
      </div>
      {editable && others.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && onMerge(e.target.value)}
          className="w-8 cursor-pointer appearance-none rounded-md bg-transparent text-center text-muted hover:bg-surface hover:text-foreground"
          title="다른 화자와 합치기"
          aria-label={`${name}을(를) 다른 화자와 합치기`}
        >
          <option value="">⋯</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}(으)로 합치기
            </option>
          ))}
        </select>
      )}
    </li>
  );
}
