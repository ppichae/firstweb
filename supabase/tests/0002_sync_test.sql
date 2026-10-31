-- =====================================================================
-- 0002 함수 테스트 (0002_sync.sql 적용 후 SQL Editor에서 실행)
-- 가짜 계정 2개로 '횟수 합계'와 '학습실 기록 지우기'가 본인 것만 다루는지 확인한다.
-- 끝에 일부러 'ALL_TESTS_PASSED' 오류를 내서 모두 되돌린다(아무것도 남지 않는다).
-- =====================================================================
begin;

create schema rls_test2;
grant usage on schema rls_test2 to anon, authenticated;
create function rls_test2.as_user(u uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function rls_test2.ok(c boolean, name text) returns void language plpgsql as $$
begin if c is not true then raise exception 'TEST FAILED: %', name; end if; end $$;
create function rls_test2.denied(q text, name text) returns void language plpgsql as $$
begin
  begin execute q; exception when insufficient_privilege then return; when others then raise exception 'TEST FAILED (뜻밖의 오류 %): %', sqlerrm, name; end;
  raise exception 'TEST FAILED (거절되지 않음): %', name;
end $$;
grant execute on all functions in schema rls_test2 to anon, authenticated;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000a2', 'a2@rls-test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'b2@rls-test.invalid', 'authenticated', 'authenticated');

do $test$
declare
  A constant uuid := '00000000-0000-4000-8000-0000000000a2';
  B constant uuid := '00000000-0000-4000-8000-0000000000b2';
  r jsonb;
begin
  perform rls_test2.ok(public.app_schema_version() = 2, '스키마 버전 2');

  execute 'set local role anon';
  perform rls_test2.denied('select * from public.my_counter_totals()', '비로그인 횟수 합계');
  perform rls_test2.denied('select public.reset_my_room(''n1'')', '비로그인 학습실 지우기');

  perform rls_test2.as_user(A);
  insert into public.study_events (event_id, room, kind, area, item_id, field, delta, occurred_at) values
    (gen_random_uuid(), 'n1', 'delta', 'words', 'v1', 'wrong', 2, now()),
    (gen_random_uuid(), 'n1', 'delta', 'words', 'v1', 'wrong', 3, now()),
    (gen_random_uuid(), 'n3', 'delta', 'activity', '2026-10-31', 'seconds', 45, now());
  insert into public.study_events (event_id, room, kind, area, occurred_at) values (gen_random_uuid(), 'n1', 'attempt', 'vocab', now());
  perform public.apply_state_ops(jsonb_build_array(jsonb_build_object('op_id', gen_random_uuid(), 'room', 'n1', 'area', 'words', 'item_id', 'v1', 'field', 'fav', 'kind', 'set', 'value', true, 'base_version', 0)));
  perform rls_test2.ok((select total from public.my_counter_totals() where room = 'n1' and item_id = 'v1' and field = 'wrong') = 5, '오답 횟수 합계 5');
  perform rls_test2.ok((select count(*) from public.my_counter_totals()) = 2, '내 합계 2줄');

  perform rls_test2.as_user(B);
  insert into public.study_events (event_id, room, kind, area, item_id, field, delta, occurred_at) values (gen_random_uuid(), 'n1', 'delta', 'words', 'v1', 'wrong', 7, now());
  perform rls_test2.ok((select total from public.my_counter_totals() where item_id = 'v1') = 7, '나의 합계에는 가 기록이 섞이지 않음');
  r := public.reset_my_room('n1');
  perform rls_test2.ok((r->>'events_deleted')::int = 1, '나가 지우면 자기 기록 1개만 지워짐');

  perform rls_test2.as_user(A);
  perform rls_test2.ok((select total from public.my_counter_totals() where room = 'n1' and item_id = 'v1') = 5, '나가 지워도 가 기록 그대로');
  r := public.reset_my_room('n1');
  perform rls_test2.ok((select count(*) from public.study_events where room = 'n1') = 0 and (select count(*) from public.learning_state where room = 'n1') = 0, '가 n1 기록 지움');
  perform rls_test2.ok((select count(*) from public.study_events where room = 'n3') = 1, '다른 학습실(n3) 기록은 그대로');

  execute 'reset role';
  raise exception 'ALL_TESTS_PASSED — 0002 테스트 통과. 테스트로 만든 계정과 기록은 모두 되돌려졌어요.';
end
$test$;

rollback;
