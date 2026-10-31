-- =====================================================================
-- 두 프로젝트(테스트용·실제용)의 데이터베이스 설정이 같은지 비교하는 '설정 요약값'
-- 표·칸·보안 규칙(RLS)·정책·함수 내용·권한을 정해진 순서로 모아 하나의 요약값(md5)으로 만든다.
-- 두 프로젝트의 SQL Editor에서 각각 실행해서 나온 값(fingerprint)이 같으면 설정이 같다. 데이터는 읽지도 바꾸지도 않는다.
-- =====================================================================
with parts as (
  select 'col:' || table_name || '.' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, '') as line
  from information_schema.columns where table_schema = 'public'
  union all
  select 'rls:' || c.relname || ':' || c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
  union all
  select 'pol:' || tablename || ':' || policyname || ':' || cmd || ':' || array_to_string(roles, ',') || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '')
  from pg_policies where schemaname = 'public'
  union all
  select 'fn:' || p.proname || ':' || p.prosecdef || ':' || md5(pg_get_functiondef(p.oid))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  union all
  select 'grant:' || table_name || ':' || grantee || ':' || privilege_type
  from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated')
  union all
  select 'colgrant:' || table_name || '.' || column_name || ':' || grantee || ':' || privilege_type
  from information_schema.column_privileges where table_schema = 'public' and grantee in ('anon', 'authenticated')
  union all
  select 'fngrant:' || routine_name || ':' || grantee
  from information_schema.role_routine_grants where routine_schema = 'public' and grantee in ('anon', 'authenticated')
  union all
  select 'idx:' || indexname || ':' || indexdef from pg_indexes where schemaname = 'public'
)
select (select public.app_schema_version()) as schema_version,
       count(*) as items,
       md5(string_agg(line, E'\n' order by line)) as fingerprint
from parts;
