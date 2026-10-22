-- 3시간 반이 넘는 오디오는 1부·2부 학습 자료 두 개로 나눠 올린다. 1부가 2부를 가리킨다.
alter table public.jobs add column if not exists next_part_id uuid references public.jobs (id) on delete set null;

-- 학습 자료 화면 맨 위에 보여 줄 한국어 3~5줄 요약 (문장 배열)
alter table public.jobs add column if not exists summary jsonb;
