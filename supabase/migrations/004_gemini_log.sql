-- 앱이 Gemini를 부를 때마다 한 줄씩 남겨서, 관리자 페이지에서 오늘 모델별 사용량을 보여 준다.
-- (여러 번 실행해도 안전합니다)
create table if not exists public.gemini_log (
  id bigint generated always as identity primary key,
  model text not null,
  kind text not null,          -- transcribe / translate / define / analyze / correct
  status text not null,        -- ok / rate_limited / error
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);
create index if not exists gemini_log_created on public.gemini_log (created_at desc);
alter table public.gemini_log enable row level security;

-- 관리자 페이지에서 바꾸는 앱 설정 (예: 사용할 Gemini 모델). 다시 배포하지 않아도 바로 적용된다.
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
