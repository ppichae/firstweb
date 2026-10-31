-- =====================================================================
-- firstweb 회원·학습 기록 데이터베이스 0001 (처음 만들기)
-- 승인된 설계(2026-10-31): 개인 기록은 본인만, 커플에게는 프로필 일부와 학습 요약만 공개.
-- 실행 위치: Supabase 대시보드 → SQL Editor. 테스트용 프로젝트에서 먼저 실행하고, 보안 테스트를 통과한 뒤에만 실제용에 실행한다.
-- 이 파일은 표·보안 규칙·함수만 만든다. 기존 데이터를 지우거나 바꾸지 않는다.
-- =====================================================================

-- 무작위 값·해시 도구 (Supabase에는 보통 이미 있다. 없을 때만 만든다)
create extension if not exists pgcrypto with schema extensions;

-- JSON 값 비교용 정렬 기준: 숫자는 숫자로, 그 밖에는 글자(날짜 YYYY-MM-DD 포함)로 비교한다
create or replace function public.jv_num(v jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric end
$$;

-- 이 스키마 버전 (두 프로젝트가 같은 버전인지 비교할 때 쓴다)
create or replace function public.app_schema_version() returns int
language sql immutable set search_path = '' as $$ select 1 $$;

-- ---------------------------------------------------------------------
-- 1. 프로필 (닉네임·사진·급수·시간대). 급수는 여기에만 있고 커플 연결과 관계없다
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text not null check (char_length(nickname) between 1 and 20),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 200),
  jlpt_level  text not null check (jlpt_level in ('N1', 'N3')),
  time_zone   text not null default 'Asia/Seoul' check (char_length(time_zone) <= 60),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2~4. 커플 연결 (연결 상태는 함수로만 바뀐다)
-- ---------------------------------------------------------------------
create table public.couple_members (
  user_id   uuid primary key references auth.users(id) on delete cascade,   -- 한 사람은 연결 하나만
  couple_id uuid not null,
  joined_at timestamptz not null default now()
);
create index couple_members_couple_idx on public.couple_members (couple_id);

create table public.connection_codes (
  owner      uuid primary key references auth.users(id) on delete cascade,  -- 한 사람당 유효한 코드 하나
  code_hash  text not null unique,                                          -- 코드 원문은 저장하지 않는다
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create table public.connection_requests (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users(id) on delete cascade,     -- 코드를 만든 사람(승인하는 사람)
  requester  uuid not null references auth.users(id) on delete cascade,     -- 코드를 입력한 사람
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (owner <> requester)
);
create unique index connection_requests_one_pending on public.connection_requests (owner) where status = 'pending';

-- 잘못된 코드 입력 횟수 제한용 기록 (본인도 직접 읽거나 지울 수 없다)
create table public.connection_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  success      boolean not null,
  attempted_at timestamptz not null default now()
);
create index connection_attempts_user_idx on public.connection_attempts (user_id, attempted_at);

-- ---------------------------------------------------------------------
-- 11. 가져오기 기록 (다른 표가 이 번호를 가리키므로 먼저 만든다)
-- ---------------------------------------------------------------------
create table public.import_batches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source       text not null check (char_length(source) <= 40),          -- 예: legacy-browser, backup-file
  device_label text check (device_label is null or char_length(device_label) <= 80),
  counts       jsonb check (counts is null or pg_column_size(counts) < 8000),
  status       text not null default 'active' check (status in ('active', 'cancelled')),
  verify       jsonb,
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz
);
create index import_batches_user_idx on public.import_batches (user_id);

-- ---------------------------------------------------------------------
-- 5~6. 학습 상태(현재 값)와 모든 변경 기록
--   learning_state: (방, 영역, 항목, 칸)마다 현재 값과 버전. value가 null이면 '해제/비움'
--   state_ops: 모든 변경 요청(해제·거절·확인 필요·취소 포함). 지우지 않는다
-- ---------------------------------------------------------------------
create table public.learning_state (
  user_id    uuid not null references auth.users(id) on delete cascade,
  room       text not null check (room ~ '^[a-z0-9_-]{1,20}$'),
  area       text not null check (area ~ '^[A-Za-z0-9_-]{1,40}$'),
  item_id    text not null check (char_length(item_id) between 1 and 200),
  field      text not null check (char_length(field) between 1 and 40),
  value      jsonb check (value is null or pg_column_size(value) < 4000),
  version    int not null default 1,
  last_op    uuid,
  updated_at timestamptz not null default now(),
  primary key (user_id, room, area, item_id, field)
);

create table public.state_ops (
  op_id           uuid primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  room            text not null,
  area            text not null,
  item_id         text not null,
  field           text not null,
  kind            text not null check (kind in ('set', 'min', 'max')),
  value           jsonb check (value is null or pg_column_size(value) < 4000),
  base_version    int,
  status          text not null check (status in ('applied', 'rejected', 'pending_review', 'cancelled')),
  prev_value      jsonb,
  prev_version    int,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  device_id       text check (device_id is null or char_length(device_id) <= 80),
  client_at       timestamptz,
  received_at     timestamptz not null default now()
);
create index state_ops_field_idx on public.state_ops (user_id, room, area, item_id, field, received_at);
create index state_ops_batch_idx on public.state_ops (import_batch_id) where import_batch_id is not null;
create index state_ops_review_idx on public.state_ops (user_id) where status = 'pending_review';

-- ---------------------------------------------------------------------
-- 7. 학습 이벤트: 문제 풀이·시험 결과·늘어난 횟수(오답 횟수, 공부 시간 등)
--   event_id(고유 번호)가 같으면 다시 저장되지 않는다 → 재전송해도 중복 없음
--   source_key: 가져온 기록의 내용 식별자. 같은 계정에 두 번 들어가지 않는다
-- ---------------------------------------------------------------------
create table public.study_events (
  event_id        uuid primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  room            text not null check (room ~ '^[a-z0-9_-]{1,20}$'),
  kind            text not null check (kind ~ '^[a-z_]{1,30}$'),      -- attempt, mock, test, delta …
  area            text check (area is null or area ~ '^[A-Za-z0-9_-]{1,40}$'),
  item_id         text check (item_id is null or char_length(item_id) <= 200),
  field           text check (field is null or char_length(field) <= 40),
  delta           numeric check (delta is null or abs(delta) <= 1000000),
  occurred_at     timestamptz not null,
  day             date,                                              -- 공부한 날(프로필 시간대 기준)
  data            jsonb check (data is null or pg_column_size(data) < 8000),
  import_batch_id uuid references public.import_batches(id) on delete cascade,
  source_key      text check (source_key is null or char_length(source_key) <= 300),
  device_id       text check (device_id is null or char_length(device_id) <= 80),
  received_at     timestamptz not null default now(),
  unique (user_id, source_key)
);
create index study_events_user_idx on public.study_events (user_id, room, kind);
create index study_events_batch_idx on public.study_events (import_batch_id) where import_batch_id is not null;

-- ---------------------------------------------------------------------
-- 8. 예전 응원 메시지 원본 (본인만 본다. 고치지 않는다)
-- ---------------------------------------------------------------------
create table public.legacy_cheers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  room            text not null check (room ~ '^[a-z0-9_-]{1,20}$'),
  body            text not null check (char_length(body) between 1 and 500),
  written_at      timestamptz not null,
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  source_key      text not null check (char_length(source_key) <= 300),
  unique (user_id, source_key)
);

-- ---------------------------------------------------------------------
-- 9. 새 응원 메시지 (연결된 두 사람 사이에서만). 예전 메시지를 보낼 때는 복사본만 만든다
-- ---------------------------------------------------------------------
create table public.encouragement_messages (
  id                 uuid primary key default gen_random_uuid(),
  couple_id          uuid not null,
  sender             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  receiver           uuid not null references auth.users(id) on delete cascade,
  body               text not null check (char_length(body) between 1 and 500),
  legacy_cheer_id    uuid references public.legacy_cheers(id) on delete set null,
  original_at        timestamptz,
  created_at         timestamptz not null default now(),
  read_at            timestamptz,
  hidden_by_receiver boolean not null default false,
  check (sender <> receiver)
);
create index encouragement_messages_couple_idx on public.encouragement_messages (couple_id, created_at);

-- ---------------------------------------------------------------------
-- 10. 상대에게 보여 줄 학습 요약 (허용된 칸만 저장할 수 있다)
-- ---------------------------------------------------------------------
create or replace function public.summary_keys_ok(d jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(d) = 'object' and not exists (
    select 1 from jsonb_object_keys(d) k
    where k not in ('v', 'rooms', 'totalMinutes', 'lastStudyDay', 'streak', 'goal', 'updatedAt'))
$$;

create table public.shared_summaries (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null check (pg_column_size(data) < 8000 and public.summary_keys_ok(data)),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 보조 함수: 내 커플 번호와 상대 계정 (보안 규칙 안에서 쓴다)
-- =====================================================================
create or replace function public.my_couple_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select couple_id from public.couple_members where user_id = auth.uid()
$$;

create or replace function public.partner_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.user_id from public.couple_members m
  where m.couple_id = (select c.couple_id from public.couple_members c where c.user_id = auth.uid())
    and m.user_id <> auth.uid()
$$;

-- =====================================================================
-- 보안 규칙 (RLS): 모든 표에서 켠다. 규칙에 맞지 않으면 보이지도, 바뀌지도 않는다
-- =====================================================================
alter table public.profiles               enable row level security;
alter table public.couple_members         enable row level security;
alter table public.connection_codes       enable row level security;
alter table public.connection_requests    enable row level security;
alter table public.connection_attempts    enable row level security;
alter table public.import_batches         enable row level security;
alter table public.learning_state         enable row level security;
alter table public.state_ops              enable row level security;
alter table public.study_events           enable row level security;
alter table public.legacy_cheers          enable row level security;
alter table public.encouragement_messages enable row level security;
alter table public.shared_summaries       enable row level security;

-- 로그인하지 않은 사람(anon)에게는 어떤 표도 열지 않는다. 로그인한 사람에게도 필요한 동작만 연다
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

-- 프로필: 본인 것만 읽고 만들고 고친다 (상대는 get_partner_profile 함수로 닉네임·사진·급수만 본다)
grant select, insert, update on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 커플 연결: 나와 상대의 연결 줄만 읽는다. 직접 만들거나 지울 수 없다(함수로만)
grant select on public.couple_members to authenticated;
create policy couple_members_select on public.couple_members for select to authenticated
  using (couple_id = public.my_couple_id());

-- 연결 코드·요청: 관련된 본인 줄만 읽는다. 직접 바꿀 수 없다(함수로만)
grant select (owner, expires_at, used_at, created_at) on public.connection_codes to authenticated;
create policy connection_codes_select_own on public.connection_codes for select to authenticated
  using (owner = (select auth.uid()));
grant select on public.connection_requests to authenticated;
create policy connection_requests_select_mine on public.connection_requests for select to authenticated
  using (owner = (select auth.uid()) or requester = (select auth.uid()));
-- connection_attempts: 권한을 주지 않는다 (함수만 쓴다)

-- 가져오기 기록: 본인 것만 읽고 만든다. 취소는 함수로만
grant select, insert on public.import_batches to authenticated;
create policy import_batches_select_own on public.import_batches for select to authenticated using (user_id = (select auth.uid()));
create policy import_batches_insert_own on public.import_batches for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'active');

-- 학습 상태·변경 기록: 본인 것만 읽는다. 쓰기는 버전 확인 함수(apply_state_ops)로만
grant select on public.learning_state to authenticated;
create policy learning_state_select_own on public.learning_state for select to authenticated using (user_id = (select auth.uid()));
grant select on public.state_ops to authenticated;
create policy state_ops_select_own on public.state_ops for select to authenticated using (user_id = (select auth.uid()));

-- 학습 이벤트: 본인 것만 읽고 새로 넣는다. 고칠 수 없다. 가져오기 번호는 내 '진행 중' 가져오기만
grant select, insert on public.study_events to authenticated;
create policy study_events_select_own on public.study_events for select to authenticated using (user_id = (select auth.uid()));
create policy study_events_insert_own on public.study_events for insert to authenticated
  with check (user_id = (select auth.uid()) and (import_batch_id is null or exists (
    select 1 from public.import_batches b where b.id = import_batch_id and b.user_id = (select auth.uid()) and b.status = 'active')));

-- 예전 응원 메시지 원본: 본인만 읽고 가져온다. 고칠 수 없다
grant select, insert on public.legacy_cheers to authenticated;
create policy legacy_cheers_select_own on public.legacy_cheers for select to authenticated using (user_id = (select auth.uid()));
create policy legacy_cheers_insert_own on public.legacy_cheers for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.import_batches b where b.id = import_batch_id and b.user_id = (select auth.uid()) and b.status = 'active'));

-- 응원 메시지: 지금 연결된 두 사람 사이에서만. 받은 사람은 읽음·숨김만 바꿀 수 있고, 보낸 사람은 지울 수 있다
grant select, insert, delete on public.encouragement_messages to authenticated;
grant update (read_at, hidden_by_receiver) on public.encouragement_messages to authenticated;
create policy messages_select on public.encouragement_messages for select to authenticated
  using (couple_id = public.my_couple_id() and ((select auth.uid()) in (sender, receiver)));
create policy messages_insert on public.encouragement_messages for insert to authenticated
  with check (sender = (select auth.uid()) and receiver = public.partner_id() and couple_id = public.my_couple_id()
    and (legacy_cheer_id is null or exists (select 1 from public.legacy_cheers l where l.id = legacy_cheer_id and l.user_id = (select auth.uid()))));
create policy messages_update_receiver on public.encouragement_messages for update to authenticated
  using (receiver = (select auth.uid()) and couple_id = public.my_couple_id())
  with check (receiver = (select auth.uid()) and couple_id = public.my_couple_id());
create policy messages_delete_sender on public.encouragement_messages for delete to authenticated
  using (sender = (select auth.uid()) and couple_id = public.my_couple_id());

-- 학습 요약: 본인 것은 쓰고 읽는다. 연결된 상대 것은 읽기만
grant select, insert, update on public.shared_summaries to authenticated;
create policy summaries_select on public.shared_summaries for select to authenticated
  using (user_id = (select auth.uid()) or user_id = public.partner_id());
create policy summaries_insert_own on public.shared_summaries for insert to authenticated with check (user_id = (select auth.uid()));
create policy summaries_update_own on public.shared_summaries for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- =====================================================================
-- 함수 (서버에서 한 번에 처리한다. security definer: 보안 규칙 대신 함수 안의 확인으로 지킨다)
-- =====================================================================

-- 상대 프로필: 닉네임·사진·급수만 (연결된 경우에만)
create or replace function public.get_partner_profile()
returns table (nickname text, avatar_path text, jlpt_level text)
language sql stable security definer set search_path = '' as $$
  select p.nickname, p.avatar_path, p.jlpt_level from public.profiles p where p.id = public.partner_id()
$$;

-- 연결 코드 만들기: 8글자(헷갈리는 0·O·1·I 제외), 10분 유효, 해시만 저장
create or replace function public.create_connection_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
  i int;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if exists (select 1 from public.couple_members where user_id = me) then raise exception 'ALREADY_CONNECTED'; end if;
  for i in 0..7 loop code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1); end loop;
  insert into public.connection_codes (owner, code_hash, expires_at, used_at, created_at)
  values (me, encode(extensions.digest(code, 'sha256'), 'hex'), now() + interval '10 minutes', null, now())
  on conflict (owner) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, used_at = null, created_at = now();
  return code;
end $$;

-- 코드 입력(연결 요청): 1시간에 5번 틀리면 막힘. 자기 자신·이미 연결된 사람·만료/사용된 코드는 거절
-- 결과는 {status, request_id}로 돌려준다. 오류로 멈추면 '틀린 횟수' 기록까지 취소되므로, 거절도 정상 결과로 돌려준다
create or replace function public.request_connection(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c record;
  req uuid;
begin
  if me is null then return jsonb_build_object('status', 'not_signed_in'); end if;
  if (select count(*) from public.connection_attempts
      where user_id = me and not success and attempted_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('status', 'too_many_attempts');
  end if;
  if exists (select 1 from public.couple_members where user_id = me) then
    return jsonb_build_object('status', 'already_connected');
  end if;
  select * into c from public.connection_codes
  where code_hash = encode(extensions.digest(upper(trim(coalesce(p_code, ''))), 'sha256'), 'hex')
    and used_at is null and expires_at > now()
  for update;
  if not found then
    insert into public.connection_attempts (user_id, success) values (me, false);
    return jsonb_build_object('status', 'invalid_code');      -- 틀렸거나 만료·사용된 코드
  end if;
  if c.owner = me then
    insert into public.connection_attempts (user_id, success) values (me, false);
    return jsonb_build_object('status', 'self_connection');
  end if;
  if exists (select 1 from public.couple_members where user_id = c.owner) then
    return jsonb_build_object('status', 'owner_already_connected');
  end if;
  update public.connection_requests set status = 'expired', decided_at = now()
  where owner = c.owner and status = 'pending' and created_at < now() - interval '1 day';
  if exists (select 1 from public.connection_requests where owner = c.owner and status = 'pending') then
    return jsonb_build_object('status', 'owner_has_pending_request');
  end if;
  update public.connection_codes set used_at = now() where owner = c.owner;   -- 코드는 한 번만 쓸 수 있다
  insert into public.connection_requests (owner, requester) values (c.owner, me) returning id into req;
  insert into public.connection_attempts (user_id, success) values (me, true);
  return jsonb_build_object('status', 'requested', 'request_id', req);
end $$;

-- 요청 승인/거절: 코드를 만든 사람만. 승인하면 두 사람이 한 번에 연결된다
create or replace function public.respond_connection(p_request uuid, p_accept boolean) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r record;
  cid uuid;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into r from public.connection_requests where id = p_request and owner = me for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.status <> 'pending' then raise exception 'REQUEST_NOT_PENDING'; end if;
  if r.created_at < now() - interval '1 day' then
    update public.connection_requests set status = 'expired', decided_at = now() where id = r.id;
    return 'expired';
  end if;
  if not p_accept then
    update public.connection_requests set status = 'rejected', decided_at = now() where id = r.id;
    return 'rejected';
  end if;
  if exists (select 1 from public.couple_members where user_id in (r.owner, r.requester)) then
    raise exception 'ALREADY_CONNECTED';
  end if;
  cid := gen_random_uuid();
  insert into public.couple_members (user_id, couple_id) values (r.owner, cid), (r.requester, cid);
  update public.connection_requests set status = 'approved', decided_at = now() where id = r.id;
  return 'approved';
end $$;

-- 요청 취소: 요청한 사람만
create or replace function public.cancel_connection_request(p_request uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  update public.connection_requests set status = 'cancelled', decided_at = now()
  where id = p_request and requester = auth.uid() and status = 'pending';
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  return 'cancelled';
end $$;

-- 연결 해제: 두 사람 중 누구나. 두 줄을 함께 지우므로 상대의 접근 권한이 바로 사라진다
create or replace function public.unlink_couple() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  select couple_id into cid from public.couple_members where user_id = auth.uid();
  if cid is null then return 'not_connected'; end if;
  delete from public.couple_members where couple_id = cid;
  return 'unlinked';
end $$;

-- 학습 상태 변경 적용: 버전 확인. 다른 기기가 먼저 바꿨고 값이 다르면 덮어쓰지 않고 '확인 필요'로 남긴다
-- ops: [{op_id, room, area, item_id, field, kind('set'|'min'|'max'), value, base_version, import_batch_id, device_id, client_at}]
create or replace function public.apply_state_ops(ops jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  o jsonb;
  s record;
  st text;
  newv jsonb;
  out jsonb := '[]'::jsonb;
  existing record;
  batch uuid;
  bv int;
  had boolean;          -- 이 칸에 이미 값(줄)이 있었는가
  older boolean;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if jsonb_typeof(ops) <> 'array' or jsonb_array_length(ops) > 500 then raise exception 'BAD_OPS'; end if;
  for o in select * from jsonb_array_elements(ops) loop
    -- 같은 변경을 다시 보내면 처음 결과를 그대로 돌려준다 (중복 반영 없음)
    select op_id, status, user_id into existing from public.state_ops where op_id = (o->>'op_id')::uuid;
    if found then
      if existing.user_id <> me then raise exception 'BAD_OP_ID'; end if;
      out := out || jsonb_build_object('op_id', o->>'op_id', 'status', existing.status, 'duplicate', true);
      continue;
    end if;
    batch := nullif(o->>'import_batch_id', '')::uuid;
    if batch is not null and not exists (select 1 from public.import_batches where id = batch and user_id = me and status = 'active') then
      raise exception 'BAD_IMPORT_BATCH';
    end if;
    if (o->>'kind') not in ('set', 'min', 'max') then raise exception 'BAD_KIND'; end if;
    if (o->>'room') !~ '^[a-z0-9_-]{1,20}$' or (o->>'area') !~ '^[A-Za-z0-9_-]{1,40}$' then raise exception 'BAD_KEY'; end if;
    bv := nullif(o->>'base_version', '')::int;

    select * into s from public.learning_state
    where user_id = me and room = o->>'room' and area = o->>'area' and item_id = o->>'item_id' and field = o->>'field'
    for update;
    had := found;

    newv := o->'value';
    if newv = 'null'::jsonb then newv := null; end if;

    if (o->>'kind') = 'set' then
      if not had then
        st := 'applied';
      elsif s.value is not distinct from newv then
        st := 'applied';                                -- 이미 같은 값: 충돌 아님
      elsif batch is not null then
        st := 'pending_review';                         -- 가져오기는 이미 값이 있는 칸을 덮어쓰지 않는다
      elsif bv is not null and bv = s.version then
        st := 'applied';
      else
        st := 'pending_review';                         -- 다른 기기가 먼저 바꿈 → 사용자가 고른다
      end if;
    else
      -- min/max: 순서와 상관없이 가장 이른·늦은(작은·큰) 값
      if had and s.value is not null and newv is not null then
        older := case when public.jv_num(s.value) is not null and public.jv_num(newv) is not null
                      then public.jv_num(s.value) <= public.jv_num(newv)
                      else (s.value #>> '{}') <= (newv #>> '{}') end;
        if (o->>'kind') = 'min' then
          newv := case when older then s.value else newv end;
        else
          newv := case when older then newv else s.value end;
        end if;
      elsif had and newv is null then
        newv := s.value;
      end if;
      st := 'applied';
    end if;

    insert into public.state_ops (op_id, user_id, room, area, item_id, field, kind, value, base_version, status,
                                  prev_value, prev_version, import_batch_id, device_id, client_at)
    values ((o->>'op_id')::uuid, me, o->>'room', o->>'area', o->>'item_id', o->>'field', o->>'kind', o->'value', bv, st,
            case when had then s.value end, case when had then s.version end, batch,
            left(o->>'device_id', 80), nullif(o->>'client_at', '')::timestamptz);

    if st = 'applied' and (not had or s.value is distinct from newv) then
      insert into public.learning_state (user_id, room, area, item_id, field, value, version, last_op, updated_at)
      values (me, o->>'room', o->>'area', o->>'item_id', o->>'field', newv, 1, (o->>'op_id')::uuid, now())
      on conflict (user_id, room, area, item_id, field)
      do update set value = excluded.value, version = public.learning_state.version + 1, last_op = excluded.last_op, updated_at = now();
    end if;

    select version, value into s from public.learning_state
    where user_id = me and room = o->>'room' and area = o->>'area' and item_id = o->>'item_id' and field = o->>'field';
    out := out || jsonb_build_object('op_id', o->>'op_id', 'status', st, 'version', s.version, 'value', s.value);
  end loop;
  return out;
end $$;

-- '확인 필요' 항목 고르기: 이 변경을 쓸지(true) 버릴지(false)
create or replace function public.resolve_state_conflict(p_op uuid, p_accept boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  o record;
  s record;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into o from public.state_ops where op_id = p_op and user_id = me and status = 'pending_review' for update;
  if not found then raise exception 'OP_NOT_FOUND'; end if;
  if not p_accept then
    update public.state_ops set status = 'rejected' where op_id = p_op;
    return jsonb_build_object('status', 'rejected');
  end if;
  select * into s from public.learning_state
  where user_id = me and room = o.room and area = o.area and item_id = o.item_id and field = o.field for update;
  insert into public.learning_state (user_id, room, area, item_id, field, value, version, last_op, updated_at)
  values (me, o.room, o.area, o.item_id, o.field, case when o.value = 'null'::jsonb then null else o.value end, 1, o.op_id, now())
  on conflict (user_id, room, area, item_id, field)
  do update set value = excluded.value, version = public.learning_state.version + 1, last_op = excluded.last_op, updated_at = now();
  update public.state_ops set status = 'applied', prev_value = s.value, prev_version = s.version where op_id = p_op;
  return jsonb_build_object('status', 'applied');
end $$;

-- 가져오기 취소: 이 가져오기 번호가 붙은 것만 되돌린다. 가져온 뒤 새로 생긴 기록·바꾼 값은 그대로 둔다
create or replace function public.cancel_import(p_batch uuid, p_delete_sent_copies boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  b record;
  o record;
  before jsonb;
  ev int; lc int; ops int; reverted int := 0; kept int := 0; recalced int := 0;
  copies int;
  newv jsonb;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into b from public.import_batches where id = p_batch and user_id = me for update;
  if not found then raise exception 'BATCH_NOT_FOUND'; end if;
  if b.status <> 'active' then return jsonb_build_object('status', b.status, 'already', true); end if;

  select count(*) into copies from public.encouragement_messages m
  join public.legacy_cheers l on l.id = m.legacy_cheer_id where l.import_batch_id = p_batch;
  if copies > 0 and not p_delete_sent_copies then raise exception 'SENT_COPIES_EXIST'; end if;

  select count(*) into ev from public.study_events where import_batch_id = p_batch;
  select count(*) into lc from public.legacy_cheers where import_batch_id = p_batch;
  select count(*) into ops from public.state_ops where import_batch_id = p_batch and status = 'applied';
  before := jsonb_build_object('events', ev, 'legacy_cheers', lc, 'applied_ops', ops);

  if copies > 0 then
    delete from public.encouragement_messages m using public.legacy_cheers l
    where l.id = m.legacy_cheer_id and l.import_batch_id = p_batch;
  end if;
  delete from public.study_events where import_batch_id = p_batch;
  delete from public.legacy_cheers where import_batch_id = p_batch;

  -- 선택형(set): 지금 값이 이 가져오기에서 온 경우에만 이전 값으로. 그 뒤에 바꿨으면 그대로
  for o in select * from public.state_ops where import_batch_id = p_batch and status = 'applied' and kind = 'set' loop
    if exists (select 1 from public.learning_state where user_id = me and last_op = o.op_id) then
      update public.learning_state set value = o.prev_value, version = version + 1, last_op = null, updated_at = now()
      where user_id = me and last_op = o.op_id;
      reverted := reverted + 1;
    else
      kept := kept + 1;
    end if;
  end loop;
  update public.state_ops set status = 'cancelled' where import_batch_id = p_batch and status in ('applied', 'pending_review');

  -- 가장 이른·늦은 값(min/max): 남은 변경 기록으로 다시 계산
  for o in select distinct room, area, item_id, field, kind from public.state_ops
           where import_batch_id = p_batch and kind in ('min', 'max') loop
    select case when o.kind = 'min'
                then (array_agg(value order by public.jv_num(value) asc nulls last, value #>> '{}' asc))[1]
                else (array_agg(value order by public.jv_num(value) desc nulls last, value #>> '{}' desc))[1] end
    into newv
    from public.state_ops
    where user_id = me and room = o.room and area = o.area and item_id = o.item_id and field = o.field
      and kind = o.kind and status = 'applied' and value is not null and value <> 'null'::jsonb;
    update public.learning_state set value = newv, version = version + 1, last_op = null, updated_at = now()
    where user_id = me and room = o.room and area = o.area and item_id = o.item_id and field = o.field;
    recalced := recalced + 1;
  end loop;

  update public.import_batches set status = 'cancelled', cancelled_at = now(),
    verify = jsonb_build_object('before', before, 'reverted_fields', reverted, 'kept_changed_after_import', kept,
                                'recalculated_fields', recalced, 'sent_copies_deleted', copies,
                                'events_left', (select count(*) from public.study_events where import_batch_id = p_batch),
                                'legacy_left', (select count(*) from public.legacy_cheers where import_batch_id = p_batch))
  where id = p_batch;
  return (select verify from public.import_batches where id = p_batch);
end $$;

-- 내 학습 데이터 모두 지우기 (계정 자체는 대시보드에서 지운다). 내 기록만 지운다
create or replace function public.delete_my_learning_data() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  delete from public.study_events where user_id = me;
  delete from public.state_ops where user_id = me;
  delete from public.learning_state where user_id = me;
  delete from public.legacy_cheers where user_id = me;
  delete from public.import_batches where user_id = me;
  delete from public.shared_summaries where user_id = me;
  return 'deleted';
end $$;

-- 함수 실행 권한: 로그인한 사람만 (로그인하지 않은 사람·모든 사람에게서 뺀다)
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.app_schema_version(), public.jv_num(jsonb), public.summary_keys_ok(jsonb), public.my_couple_id(), public.partner_id(),
  public.get_partner_profile(), public.create_connection_code(), public.request_connection(text),
  public.respond_connection(uuid, boolean), public.cancel_connection_request(uuid), public.unlink_couple(),
  public.apply_state_ops(jsonb), public.resolve_state_conflict(uuid, boolean),
  public.cancel_import(uuid, boolean), public.delete_my_learning_data()
to authenticated;
-- 앞으로 새로 만드는 함수도 기본으로는 아무에게도 열지 않는다
alter default privileges in schema public revoke execute on functions from public, anon;
