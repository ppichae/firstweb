-- =====================================================================
-- firstweb 보안·기능 자동 테스트 (0001_init.sql 적용 후 SQL Editor에서 실행)
-- 가짜 계정 3개(가=A, 나=B, 다=C)를 만들어 보안 규칙(RLS)과 함수를 실제 데이터베이스에서 확인한다.
-- 마지막에 일부러 'ALL_TESTS_PASSED' 오류를 내서, 테스트 중 만든 계정·기록·도구를 모두 되돌린다(아무것도 남지 않는다).
-- 실패하면 'TEST FAILED: …' 오류에 실패한 항목 이름이 나온다. 이때도 모두 되돌려진다.
-- =====================================================================
begin;

create schema rls_test;
grant usage on schema rls_test to anon, authenticated;

create function rls_test.as_user(u uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function rls_test.as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;
create function rls_test.ok(c boolean, name text) returns void language plpgsql as $$
begin if c is not true then raise exception 'TEST FAILED: %', name; end if; end $$;
-- 실행하면 거절(권한 없음·보안 규칙 위반·허용되지 않은 값)되어야 한다
create function rls_test.denied(q text, name text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception
    when insufficient_privilege or check_violation then return;
    when others then raise exception 'TEST FAILED (뜻밖의 오류 %): %', sqlerrm, name;
  end;
  raise exception 'TEST FAILED (거절되지 않음): %', name;
end $$;
-- 실행하면 함수가 거절 오류(요청 없음·이미 연결됨·중복 등)를 내야 한다
create function rls_test.raises(q text, name text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then return;
  end;
  raise exception 'TEST FAILED (거절되지 않음): %', name;
end $$;
-- 실행했을 때 바뀐(또는 읽힌) 줄 수
create function rls_test.rows(q text) returns int language plpgsql as $$
declare n int;
begin execute q; get diagnostics n = row_count; return n; end $$;
create function rls_test.cnt(q text) returns bigint language plpgsql as $$
declare n bigint;
begin execute 'select count(*) from (' || q || ') x' into n; return n; end $$;
grant execute on all functions in schema rls_test to anon, authenticated;

-- 가짜 계정 (테스트가 끝나면 사라진다)
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'a@rls-test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'b@rls-test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000c', 'c@rls-test.invalid', 'authenticated', 'authenticated');

do $test$
declare
  A constant uuid := '00000000-0000-4000-8000-00000000000a';
  B constant uuid := '00000000-0000-4000-8000-00000000000b';
  C constant uuid := '00000000-0000-4000-8000-00000000000c';
  code text; code2 text; r jsonb; req uuid; batch uuid; n bigint; v jsonb; i int;
begin
  perform rls_test.ok(public.app_schema_version() >= 1, '스키마 버전 1 이상');

  -- ===== 1. 로그인하지 않은 사람: 모두 막힘 =====
  perform rls_test.as_anon();
  perform rls_test.denied('select * from public.profiles', '비로그인 프로필 읽기');
  perform rls_test.denied('select * from public.learning_state', '비로그인 학습 상태 읽기');
  perform rls_test.denied('select * from public.study_events', '비로그인 학습 이벤트 읽기');
  perform rls_test.denied('select * from public.state_ops', '비로그인 변경 기록 읽기');
  perform rls_test.denied('select * from public.shared_summaries', '비로그인 요약 읽기');
  perform rls_test.denied('select * from public.encouragement_messages', '비로그인 메시지 읽기');
  perform rls_test.denied('select * from public.couple_members', '비로그인 커플 읽기');
  perform rls_test.denied('select * from public.legacy_cheers', '비로그인 예전 메시지 읽기');
  perform rls_test.denied('select * from public.import_batches', '비로그인 가져오기 기록 읽기');
  perform rls_test.denied('select public.create_connection_code()', '비로그인 코드 만들기');
  perform rls_test.denied('select public.get_partner_profile()', '비로그인 상대 프로필');

  -- ===== 2. 가(A): 내 기록 만들기 =====
  perform rls_test.as_user(A);
  insert into public.profiles (id, nickname, jlpt_level) values (A, '가', 'N1');
  perform rls_test.denied(format('insert into public.profiles (id, nickname, jlpt_level) values (%L, %L, %L)', B, 'x', 'N1'), '남의 ID로 프로필 만들기');
  r := public.apply_state_ops(jsonb_build_array(
    jsonb_build_object('op_id', gen_random_uuid(), 'room', 'n1', 'area', 'words', 'item_id', 'v001', 'field', 'fav', 'kind', 'set', 'value', true, 'base_version', 0)));
  perform rls_test.ok(r->0->>'status' = 'applied', '내 즐겨찾기 저장');
  insert into public.study_events (event_id, room, kind, area, occurred_at, data) values (gen_random_uuid(), 'n1', 'attempt', 'vocab', now(), '{"qid":"q1","correct":false}');
  perform rls_test.denied(format('insert into public.study_events (event_id, user_id, room, kind, occurred_at) values (gen_random_uuid(), %L, %L, %L, now())', B, 'n1', 'attempt'), '남의 ID로 학습 이벤트 넣기');
  insert into public.shared_summaries (data) values ('{"v":1,"streak":3,"totalMinutes":120}');
  perform rls_test.denied('update public.shared_summaries set data = ''{"wrongNotes":[1,2]}''', '요약에 허용되지 않은 칸(오답) 넣기');

  -- ===== 3. 나(B): 연결 전에는 가의 어떤 기록도 못 봄·못 바꿈·못 지움 =====
  perform rls_test.as_user(B);
  insert into public.profiles (id, nickname, jlpt_level) values (B, '나', 'N1');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.profiles where id = %L', A)) = 0, '연결 전 가 프로필 안 보임');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.learning_state where user_id = %L', A)) = 0, '가 학습 상태(즐겨찾기) 안 보임');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.state_ops where user_id = %L', A)) = 0, '가 변경 기록 안 보임');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.study_events where user_id = %L', A)) = 0, '가 문제 풀이(오답) 안 보임');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.shared_summaries where user_id = %L', A)) = 0, '연결 전 가 요약 안 보임');
  perform rls_test.ok(rls_test.cnt('select * from public.get_partner_profile()') = 0, '연결 전 상대 프로필 없음');
  perform rls_test.ok(rls_test.rows(format('update public.profiles set nickname = %L where id = %L', '해킹', A)) = 0, '가 프로필 수정 안 됨');
  perform rls_test.denied(format('delete from public.study_events where user_id = %L', A), '가 학습 이벤트 삭제');
  perform rls_test.denied(format('update public.learning_state set value = %L where user_id = %L', 'false', A), '가 학습 상태 수정');
  perform rls_test.denied(format('delete from public.learning_state where user_id = %L', A), '가 학습 상태 삭제');
  perform rls_test.denied(format('insert into public.couple_members (user_id, couple_id) values (%L, gen_random_uuid())', B), '커플 표에 직접 넣기');
  perform rls_test.denied(format('insert into public.connection_requests (owner, requester) values (%L, %L)', A, B), '연결 요청 표에 직접 넣기');
  perform rls_test.denied('select code_hash from public.connection_codes', '코드 해시 읽기');
  perform rls_test.as_user(A);
  perform rls_test.ok(rls_test.cnt('select 1 from public.study_events') = 1 and rls_test.cnt('select 1 from public.learning_state') = 1
                      and (select nickname from public.profiles where id = A) = '가', '나의 시도 뒤에도 가 기록 그대로');

  -- ===== 4. 연결 코드: 자기 자신·틀린 코드·재사용·거절·승인 =====
  code := public.create_connection_code();
  perform rls_test.ok(length(code) = 8, '코드 8글자');
  perform rls_test.ok(public.request_connection(code)->>'status' = 'self_connection', '내 코드로 나와 연결 안 됨');
  perform rls_test.as_user(B);
  perform rls_test.ok(public.request_connection('WRONGCOD')->>'status' = 'invalid_code', '틀린 코드 거절');
  r := public.request_connection(code);
  perform rls_test.ok(r->>'status' = 'requested', '가 코드로 요청');
  req := (r->>'request_id')::uuid;
  perform rls_test.ok(rls_test.cnt('select 1 from public.couple_members') = 0, '승인 전에는 연결 안 됨');
  perform rls_test.ok(public.request_connection(code)->>'status' = 'invalid_code', '같은 코드 다시 쓰기 거절');
  perform rls_test.as_user(C);
  perform rls_test.raises(format('select public.respond_connection(%L, true)', req), '남의 요청을 다(C)가 승인');
  perform rls_test.as_user(A);
  perform rls_test.ok(public.respond_connection(req, false) = 'rejected', '가가 거절');
  perform rls_test.ok(rls_test.cnt('select 1 from public.couple_members') = 0, '거절 뒤 연결 없음');
  code2 := public.create_connection_code();
  perform rls_test.as_user(B);
  req := (public.request_connection(code2)->>'request_id')::uuid;
  perform rls_test.as_user(A);
  perform rls_test.ok(public.respond_connection(req, true) = 'approved', '가가 승인');
  perform rls_test.ok(rls_test.cnt('select 1 from public.couple_members') = 2, '연결 완료(2명)');

  -- 다(C): 5번 틀리면 6번째는 막힘, 이미 연결된 사람과는 연결 안 됨
  perform rls_test.as_user(C);
  for i in 1..5 loop perform public.request_connection('BADCODE' || i); end loop;
  perform rls_test.ok(public.request_connection('BADCODE6')->>'status' = 'too_many_attempts', '6번째 시도 막힘');
  perform rls_test.as_user(B);
  perform rls_test.raises('select public.create_connection_code()', '이미 연결된 사람은 새 코드 못 만듦');

  -- ===== 5. 연결 뒤: 상대에게는 프로필 일부와 요약만 =====
  perform rls_test.ok((select nickname from public.get_partner_profile()) = '가', '상대 닉네임 보임');
  perform rls_test.ok((select jlpt_level from public.get_partner_profile()) = 'N1', '둘 다 N1이어도 연결');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.shared_summaries where user_id = %L', A)) = 1, '연결 뒤 상대 요약 보임');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.profiles where id = %L', A)) = 0, '상대 프로필 표 직접 읽기는 여전히 막힘');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.learning_state where user_id = %L', A)) = 0, '연결 뒤에도 상대 즐겨찾기 안 보임');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.study_events where user_id = %L', A)) = 0, '연결 뒤에도 상대 문제 풀이 안 보임');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.state_ops where user_id = %L', A)) = 0, '연결 뒤에도 상대 변경 기록 안 보임');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.import_batches where user_id = %L', A)) = 0, '상대 가져오기 기록 안 보임');
  perform rls_test.ok(rls_test.rows(format('update public.shared_summaries set data = %L where user_id = %L', '{"v":9}', A)) = 0, '상대 요약 수정 안 됨');
  insert into public.encouragement_messages (couple_id, receiver, body) values (public.my_couple_id(), A, '오늘도 화이팅');
  perform rls_test.denied(format('insert into public.encouragement_messages (couple_id, receiver, body) values (public.my_couple_id(), %L, %L)', C, 'x'), '연결 안 된 사람에게 메시지');
  perform rls_test.as_user(A);
  perform rls_test.ok(rls_test.cnt('select 1 from public.encouragement_messages') = 1, '받은 메시지 보임');
  perform rls_test.ok(rls_test.rows('update public.encouragement_messages set read_at = now()') = 1, '받은 사람이 읽음 표시');
  perform rls_test.denied('update public.encouragement_messages set body = ''바꿈''', '메시지 내용 수정');
  update public.profiles set jlpt_level = 'N3' where id = A;
  perform rls_test.as_user(B);
  perform rls_test.ok((select jlpt_level from public.get_partner_profile()) = 'N3', '급수를 바꿔도 연결 유지(N1-N3)');
  perform rls_test.as_user(C);
  perform rls_test.ok(rls_test.cnt('select 1 from public.encouragement_messages') = 0, '다른 사람 메시지 안 보임');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.shared_summaries where user_id = %L', A)) = 0, '연결 안 된 다는 요약 못 봄');

  -- ===== 6. 연결 해제: 바로 접근 차단 =====
  perform rls_test.as_user(B);
  perform rls_test.ok(public.unlink_couple() = 'unlinked', '나가 연결 해제');
  perform rls_test.ok(rls_test.cnt('select * from public.get_partner_profile()') = 0, '해제 뒤 상대 프로필 안 보임');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.shared_summaries where user_id = %L', A)) = 0, '해제 뒤 상대 요약 안 보임');
  perform rls_test.ok(rls_test.cnt('select 1 from public.encouragement_messages') = 0, '해제 뒤 메시지 안 보임');
  perform rls_test.denied(format('insert into public.encouragement_messages (couple_id, receiver, body) values (gen_random_uuid(), %L, %L)', A, 'x'), '해제 뒤 메시지 보내기');

  -- ===== 7. 충돌: 다른 기기가 먼저 바꾸면 덮어쓰지 않고 '확인 필요' =====
  perform rls_test.as_user(A);
  r := public.apply_state_ops(jsonb_build_array(jsonb_build_object('op_id', gen_random_uuid(), 'room', 'n1', 'area', 'words', 'item_id', 'v001', 'field', 'fav', 'kind', 'set', 'value', false, 'base_version', 1)));
  perform rls_test.ok(r->0->>'status' = 'applied' and (r->0->>'version')::int = 2, '컴퓨터: 즐겨찾기 해제(버전 1→2)');
  r := public.apply_state_ops(jsonb_build_array(jsonb_build_object('op_id', gen_random_uuid(), 'room', 'n1', 'area', 'words', 'item_id', 'v001', 'field', 'fav', 'kind', 'set', 'value', true, 'base_version', 1)));
  perform rls_test.ok(r->0->>'status' = 'pending_review' and r->0->'value' = 'false'::jsonb, '휴대폰의 옛 변경은 확인 필요, 해제 유지');
  v := jsonb_build_array(jsonb_build_object('op_id', '11111111-1111-4111-8111-111111111111', 'room', 'n1', 'area', 'words', 'item_id', 'v002', 'field', 'status', 'kind', 'set', 'value', 'known', 'base_version', 0));
  perform public.apply_state_ops(v);
  r := public.apply_state_ops(v);
  perform rls_test.ok(r->0->>'duplicate' = 'true' and rls_test.cnt('select 1 from public.state_ops where op_id = ''11111111-1111-4111-8111-111111111111''') = 1, '같은 변경 재전송은 한 번만');

  -- ===== 8. 가져오기와 취소: 가져온 것만 빠지고 나머지는 그대로 =====
  for i in 1..4 loop insert into public.study_events (event_id, room, kind, area, occurred_at) values (gen_random_uuid(), 'n1', 'attempt', 'vocab', now()); end loop;  -- 기존 5개(앞의 1개 포함)
  insert into public.study_events (event_id, room, kind, area, item_id, field, delta, occurred_at) values (gen_random_uuid(), 'n1', 'delta', 'words', 'v009', 'wrong', 1, now());
  perform public.apply_state_ops(jsonb_build_array(
    jsonb_build_object('op_id', gen_random_uuid(), 'room', 'n1', 'area', 'words', 'item_id', 'v003', 'field', 'status', 'kind', 'set', 'value', 'unknown', 'base_version', 0),
    jsonb_build_object('op_id', gen_random_uuid(), 'room', 'n1', 'area', 'kanji', 'item_id', '阻', 'field', 'seen', 'kind', 'min', 'value', '2026-10-20')));
  insert into public.import_batches (source) values ('legacy-browser') returning id into batch;
  for i in 1..10 loop
    insert into public.study_events (event_id, room, kind, area, occurred_at, import_batch_id, source_key)
    values (gen_random_uuid(), 'n1', 'attempt', 'vocab', now(), batch, 'n1:attempt:' || i);
  end loop;
  insert into public.study_events (event_id, room, kind, area, item_id, field, delta, occurred_at, import_batch_id, source_key)
  values (gen_random_uuid(), 'n1', 'delta', 'words', 'v009', 'wrong', 3, now(), batch, 'n1:wrong:v009');
  perform rls_test.raises(format('insert into public.study_events (event_id, room, kind, occurred_at, import_batch_id, source_key) values (gen_random_uuid(), %L, %L, now(), %L, %L)', 'n1', 'attempt', batch, 'n1:attempt:1'), '같은 기록 다시 가져오기(중복)');
  r := public.apply_state_ops(jsonb_build_array(
    jsonb_build_object('op_id', gen_random_uuid(), 'room', 'n1', 'area', 'words', 'item_id', 'v004', 'field', 'fav', 'kind', 'set', 'value', true, 'import_batch_id', batch),
    jsonb_build_object('op_id', gen_random_uuid(), 'room', 'n1', 'area', 'words', 'item_id', 'v003', 'field', 'status', 'kind', 'set', 'value', 'known', 'import_batch_id', batch),
    jsonb_build_object('op_id', gen_random_uuid(), 'room', 'n1', 'area', 'words', 'item_id', 'v005', 'field', 'fav', 'kind', 'set', 'value', true, 'import_batch_id', batch),
    jsonb_build_object('op_id', gen_random_uuid(), 'room', 'n1', 'area', 'kanji', 'item_id', '阻', 'field', 'seen', 'kind', 'min', 'value', '2026-10-01', 'import_batch_id', batch)));
  perform rls_test.ok(r->0->>'status' = 'applied', '빈 칸에는 가져온 값 반영');
  perform rls_test.ok(r->1->>'status' = 'pending_review', '이미 값이 있는 칸은 가져오기로 덮어쓰지 않음');
  perform rls_test.ok(r->3->'value' = '"2026-10-01"'::jsonb, '처음 본 날짜는 더 이른 가져온 날짜');
  -- 가져온 뒤 새로 공부: 문제 3개, 오답 +2, 가져온 즐겨찾기(v005)를 직접 해제
  for i in 1..3 loop insert into public.study_events (event_id, room, kind, area, occurred_at) values (gen_random_uuid(), 'n1', 'attempt', 'vocab', now()); end loop;
  insert into public.study_events (event_id, room, kind, area, item_id, field, delta, occurred_at) values (gen_random_uuid(), 'n1', 'delta', 'words', 'v009', 'wrong', 2, now());
  perform public.apply_state_ops(jsonb_build_array(jsonb_build_object('op_id', gen_random_uuid(), 'room', 'n1', 'area', 'words', 'item_id', 'v005', 'field', 'fav', 'kind', 'set', 'value', false, 'base_version', 1)));
  perform rls_test.ok(rls_test.cnt('select 1 from public.study_events where kind = ''attempt''') = 18, '취소 전 문제 풀이 18개(5+10+3)');
  perform rls_test.ok((select sum(delta) from public.study_events where item_id = 'v009' and field = 'wrong') = 6, '취소 전 오답 횟수 6(1+3+2)');
  r := public.cancel_import(batch);
  perform rls_test.ok(rls_test.cnt('select 1 from public.study_events where kind = ''attempt''') = 8, '취소 뒤 문제 풀이 8개(가져온 10개만 빠짐)');
  perform rls_test.ok((select sum(delta) from public.study_events where item_id = 'v009' and field = 'wrong') = 3, '취소 뒤 오답 횟수 3(가져온 3만 빠짐)');
  perform rls_test.ok((select value from public.learning_state where item_id = 'v004' and field = 'fav') is null, '가져온 즐겨찾기는 다시 빈 칸');
  perform rls_test.ok((select value from public.learning_state where item_id = 'v005' and field = 'fav') = 'false'::jsonb, '가져온 뒤 직접 바꾼 값은 그대로');
  perform rls_test.ok((select value from public.learning_state where item_id = 'v003' and field = 'status') = '"unknown"'::jsonb, '원래 값(unknown) 그대로');
  perform rls_test.ok((select value from public.learning_state where item_id = '阻' and field = 'seen') = '"2026-10-20"'::jsonb, '처음 본 날짜는 남은 기록으로 다시 계산');
  perform rls_test.ok(rls_test.cnt(format('select 1 from public.study_events where import_batch_id = %L', batch)) = 0, '취소 뒤 가져오기 번호가 붙은 기록 0개');
  perform rls_test.ok((public.cancel_import(batch))->>'already' = 'true', '두 번 취소해도 문제없음');
  perform rls_test.denied(format('insert into public.study_events (event_id, room, kind, occurred_at, import_batch_id) values (gen_random_uuid(), %L, %L, now(), %L)', 'n1', 'attempt', batch), '취소된 가져오기 번호로 넣기');

  -- ===== 9. 내 데이터 지우기는 내 것만 =====
  perform rls_test.as_user(C);
  perform public.delete_my_learning_data();
  perform rls_test.as_user(A);
  perform rls_test.ok(rls_test.cnt('select 1 from public.study_events where kind = ''attempt''') = 8, '다가 자기 데이터를 지워도 가 기록 그대로');

  execute 'reset role';
  raise exception 'ALL_TESTS_PASSED — 모든 테스트 통과. 테스트로 만든 계정과 기록은 모두 되돌려졌어요.';
end
$test$;

rollback;
