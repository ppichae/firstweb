-- =====================================================================
-- firstweb 데이터베이스 0002: 학습 기록 동기화에 필요한 함수 2개 (표는 바꾸지 않는다)
--   1) my_counter_totals: 내 '늘어난 횟수' 기록(오답 횟수·공부 시간 등)을 항목별로 합쳐서 돌려준다
--   2) reset_my_room: '기록 관리 → 기록 지우기'를 계정에서도 할 수 있게, 내 학습실 하나의 기록만 지운다
-- 테스트용 프로젝트에서 먼저 실행하고, 테스트를 통과한 뒤에만 실제용에 실행한다. 기존 데이터를 지우거나 바꾸지 않는다.
-- =====================================================================

create or replace function public.app_schema_version() returns int
language sql immutable set search_path = '' as $$ select 2 $$;

-- 내 횟수 합계 (본인 것만. security invoker라 보안 규칙(RLS)이 그대로 적용된다)
create or replace function public.my_counter_totals()
returns table (room text, area text, item_id text, field text, total numeric)
language sql stable security invoker set search_path = '' as $$
  select e.room, e.area, e.item_id, e.field, sum(e.delta)
  from public.study_events e
  where e.user_id = (select auth.uid()) and e.kind = 'delta'
  group by e.room, e.area, e.item_id, e.field
$$;

-- 내 학습실 하나(n1 또는 n3)의 학습 기록 지우기. 다른 사람·다른 학습실·프로필·파트너 연결·메시지는 건드리지 않는다
create or replace function public.reset_my_room(p_room text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  ev int; st int;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_room !~ '^[a-z0-9_-]{1,20}$' then raise exception 'BAD_ROOM'; end if;
  delete from public.study_events where user_id = me and room = p_room;
  get diagnostics ev = row_count;
  delete from public.learning_state where user_id = me and room = p_room;
  get diagnostics st = row_count;
  update public.state_ops set status = 'rejected' where user_id = me and room = p_room and status = 'pending_review';
  return jsonb_build_object('events_deleted', ev, 'fields_deleted', st);
end $$;

-- 모의고사 결과처럼 문제 목록이 들어 있는 기록은 8KB를 넘을 수 있어서, 한 기록의 크기 제한을 64KB로 넓힌다
alter table public.study_events drop constraint if exists study_events_data_check;
alter table public.study_events add constraint study_events_data_check check (data is null or pg_column_size(data) < 64000);

revoke execute on function public.my_counter_totals(), public.reset_my_room(text) from public, anon;
grant execute on function public.my_counter_totals(), public.reset_my_room(text) to authenticated;
