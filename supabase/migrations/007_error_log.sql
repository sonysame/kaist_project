-- 처리 중에 난 오류와 건너뛴 단계(교정·다시 해석·요약)를 관리자 페이지에서 보려고 남긴다
create table if not exists public.error_log (
  id bigint generated always as identity primary key,
  job_id uuid references public.jobs (id) on delete set null,
  filename text,               -- 자료를 지워도 어떤 파일이었는지 알 수 있게 따로 적어 둔다
  step text not null,          -- 받아 적기 / 해석 / 교정 / 다시 해석 / 요약 / 분석
  message text not null,
  skipped boolean not null default false, -- true면 처리는 계속됐고 그 단계만 빠졌다
  detail jsonb,                -- 다시 실행할 때 필요한 정보 (예: 다시 해석할 문장 ID)
  resolved_at timestamptz,     -- 관리자가 '해결'했거나 멈춘 처리가 끝까지 된 시각
  created_at timestamptz not null default now()
);
create index if not exists error_log_created on public.error_log (created_at desc);
alter table public.error_log enable row level security;
