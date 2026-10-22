-- 두 화면(예: 주인과 관리자, 1부 화면과 2부 화면)이 같은 자료를 동시에 처리하지 않도록 잠근다.
-- 한 단계를 처리하는 동안 이 시각까지 다른 요청은 기다린다 (서버가 강제로 끊겨도 5분 뒤엔 풀린다).
alter table public.jobs add column if not exists step_lock_until timestamptz;
