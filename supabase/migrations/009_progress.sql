-- 학습 자료마다 계정별로 어디까지 들었는지 기억한다 (다시 열면 그 자리부터 이어 듣기, 기기가 달라도)
create table if not exists public.study_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  position_sec double precision not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, job_id)
);
alter table public.study_progress enable row level security;
