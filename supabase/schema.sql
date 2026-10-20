-- Supabase 대시보드 > SQL Editor 에 붙여 넣고 한 번 실행하세요.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  duration_sec double precision not null,
  chunk_count int not null,
  status text not null default 'uploading' check (status in ('uploading', 'processing', 'done', 'error')),
  error text,
  speaker_names jsonb not null default '{}'::jsonb,
  next_speaker_no int not null default 1,
  created_at timestamptz not null default now()
);

-- 20분 단위 구간. words/speaker_map은 다음 구간의 화자를 맞출 때 쓴다.
create table if not exists public.chunks (
  job_id uuid not null references public.jobs (id) on delete cascade,
  idx int not null,
  start_sec double precision not null,
  end_sec double precision not null,
  status text not null default 'pending' check (status in ('pending', 'transcribed', 'translated')),
  words jsonb,
  speaker_map jsonb,
  keep_until double precision,
  error text,
  primary key (job_id, idx)
);

create table if not exists public.utterances (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs (id) on delete cascade,
  chunk_idx int not null,
  speaker text not null,
  start_sec double precision not null,
  end_sec double precision not null,
  text_en text not null,
  text_ko text,
  words jsonb not null default '[]'::jsonb -- [{ "t": 단어, "s": 시작초, "e": 끝초 }]
);
create index if not exists utterances_job_start on public.utterances (job_id, start_sec);

-- 단어장. 로그인이 없어서 브라우저마다 만든 익명 ID(device_id)로 구분한다.
create table if not exists public.vocab (
  id bigint generated always as identity primary key,
  device_id text not null,
  word text not null,
  lemma text not null,
  part_of_speech text,
  meaning_ko text not null,
  sentence_en text not null,
  sentence_ko text,
  job_id uuid references public.jobs (id) on delete set null,
  start_sec double precision,
  created_at timestamptz not null default now(),
  unique (device_id, lemma)
);
create index if not exists vocab_device on public.vocab (device_id, created_at desc);

-- 전사가 끝난 뒤 대본 전체를 읽고 광고를 표시하고 화자 이름을 추측한다
alter table public.utterances add column if not exists is_ad boolean not null default false;
alter table public.jobs add column if not exists analyzed boolean not null default false;

-- 로그인 없는 앱이라 모든 접근은 서버(secret key)에서만 한다. 정책 없이 RLS만 켜 두면 브라우저 키로는 접근할 수 없다.
alter table public.jobs enable row level security;
alter table public.chunks enable row level security;
alter table public.utterances enable row level security;
alter table public.vocab enable row level security;

-- 오디오 저장용 비공개 버킷 (무료 플랜의 파일당 최대 크기 50MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', false, 52428800, array['audio/mpeg'])
on conflict (id) do nothing;
