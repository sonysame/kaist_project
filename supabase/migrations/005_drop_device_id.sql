-- 단어장은 이제 계정(user_id)으로만 나눈다. 로그인 전 브라우저별 익명 ID(device_id)는 쓰지 않는다.
-- 칸을 지우면 그 칸에 걸린 색인(vocab_device)과 중복 규칙(device_id, lemma)도 함께 지워진다.
alter table public.vocab drop column if exists device_id;

-- 모든 단어가 계정에 묶여 있으니 계정 없는 단어는 생기지 않게 한다
alter table public.vocab alter column user_id set not null;
