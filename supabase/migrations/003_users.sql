-- 구글 로그인을 붙이면서 학습 자료와 단어장을 사용자별로 나눈다. (여러 번 실행해도 안전합니다)

-- 학습 자료(작업)의 주인
alter table public.jobs add column if not exists user_id uuid references auth.users (id) on delete cascade;
create index if not exists jobs_user_created on public.jobs (user_id, created_at desc);

-- 단어장의 주인. 로그인 전에 브라우저 ID로 저장한 단어는 로그인할 때 계정으로 옮긴다.
alter table public.vocab add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.vocab alter column device_id drop not null;
create unique index if not exists vocab_user_lemma on public.vocab (user_id, lemma);
create index if not exists vocab_user_created on public.vocab (user_id, created_at desc);

-- 하루 업로드 제한용 기록. 작업을 지워도 남아서, 지우고 다시 올리는 식으로 제한을 피할 수 없다.
create table if not exists public.upload_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists upload_log_user_created on public.upload_log (user_id, created_at desc);
alter table public.upload_log enable row level security;

-- 관리자 페이지에서 데이터베이스 사용량을 보여 주기 위한 함수 (서버의 secret key로만 부를 수 있다)
create or replace function public.admin_db_size() returns bigint
language sql security definer set search_path = '' as $$
  select pg_database_size(current_database());
$$;
revoke all on function public.admin_db_size() from public, anon, authenticated;
grant execute on function public.admin_db_size() to service_role;
