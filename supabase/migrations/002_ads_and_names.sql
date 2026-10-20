-- 이미 schema.sql을 실행한 프로젝트에 한 번 더 실행하세요. (여러 번 실행해도 안전합니다)
alter table public.utterances add column if not exists is_ad boolean not null default false;
alter table public.jobs add column if not exists analyzed boolean not null default false;
