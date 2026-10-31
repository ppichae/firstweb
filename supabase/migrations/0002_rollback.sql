-- =====================================================================
-- 0002 되돌리기 (문제가 생겼을 때만 실행)
-- 0002가 더한 함수 2개를 지우고, 기록 크기 제한과 버전을 0001 상태로 돌린다.
-- 표와 학습 기록은 지우지 않는다. (주의: 0002 적용 뒤 8KB가 넘는 기록이 들어갔다면 크기 제한을 되돌릴 때 오류가 나며, 그때는 아무것도 바뀌지 않는다)
-- =====================================================================
begin;
drop function if exists public.my_counter_totals();
drop function if exists public.reset_my_room(text);
create or replace function public.app_schema_version() returns int
language sql immutable set search_path = '' as $$ select 1 $$;
alter table public.study_events drop constraint if exists study_events_data_check;
alter table public.study_events add constraint study_events_data_check check (data is null or pg_column_size(data) < 8000);
commit;
