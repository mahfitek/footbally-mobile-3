-- get_my_blocked_users testleri (yalnızca yerel veritabanı).
\set ON_ERROR_STOP 1

create or replace function as_user(p uuid) returns void language plpgsql as $$
begin
  execute 'set role authenticated';
  perform set_config('request.jwt.claim.sub', p::text, false);
end $$;

create or replace function as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

create or replace function assert_true(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'ASSERT FAILED: %', msg; end if;
  raise notice 'PASS: %', msg;
end $$;

create or replace function assert_eq(a anyelement, b anyelement, msg text) returns void language plpgsql as $$
begin
  if a is distinct from b then raise exception 'ASSERT FAILED: % (got % want %)', msg, a, b; end if;
  raise notice 'PASS: %', msg;
end $$;

-- Kullanıcılar: A (engelleyen), B (aktif, takımı var), C (kalıcı yasaklı), D (profili yok), E (takımı arşivli), X (başka engelleyen)
insert into auth.users (id, created_at) values
  ('b1000000-0000-0000-0000-000000000001', now()),
  ('b1000000-0000-0000-0000-000000000002', now()),
  ('b1000000-0000-0000-0000-000000000003', now()),
  ('b1000000-0000-0000-0000-000000000004', now()),
  ('b1000000-0000-0000-0000-000000000005', now()),
  ('b1000000-0000-0000-0000-000000000006', now());

insert into public.profiles (user_id, full_name, avatar_url, account_status, ban_is_permanent) values
  ('b1000000-0000-0000-0000-000000000001', 'Blocker A', null, 'active', false),
  ('b1000000-0000-0000-0000-000000000002', 'Oyuncu B', 'https://example.test/b.png', 'active', false),
  ('b1000000-0000-0000-0000-000000000003', 'Gizli Kisi', 'https://example.test/c.png', 'banned', true),
  ('b1000000-0000-0000-0000-000000000005', 'Oyuncu E', null, 'active', false);
-- D için profil yok (silinmiş hesap).

insert into public.teams (id, owner_id, name, archived_at) values
  ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'Team B', null),
  ('c1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000005', 'Eski Takim', now());

insert into public.user_blocks (blocker_id, blocked_id, created_at) values
  ('b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', '2026-11-01'),
  ('b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003', '2026-11-05'),
  ('b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000004', '2026-11-10'),
  ('b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000005', '2026-11-12'),
  ('b1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000002', '2026-11-02');

-- A yalnızca kendi dört engelini görür, en yenisi önce.
select as_user('b1000000-0000-0000-0000-000000000001');
select assert_eq((select count(*)::int from public.get_my_blocked_users()), 4, 'blocker sees exactly its own 4 blocks');
select assert_eq(
  (select string_agg(user_id::text, ',' order by blocked_at desc) from public.get_my_blocked_users()),
  'b1000000-0000-0000-0000-000000000005,b1000000-0000-0000-0000-000000000004,b1000000-0000-0000-0000-000000000003,b1000000-0000-0000-0000-000000000002',
  'list is newest first');

-- Aktif kullanıcı: ad, avatar ve takım adı görünür.
select assert_eq((select full_name from public.get_my_blocked_users() where user_id = 'b1000000-0000-0000-0000-000000000002'), 'Oyuncu B', 'active user name is shown');
select assert_eq((select avatar_url from public.get_my_blocked_users() where user_id = 'b1000000-0000-0000-0000-000000000002'), 'https://example.test/b.png', 'active user avatar is shown');
select assert_eq((select team_name from public.get_my_blocked_users() where user_id = 'b1000000-0000-0000-0000-000000000002'), 'Team B', 'active user team name is shown');

-- Kalıcı yasaklı hesap: kimlik alanları gizlenir (istemci "Kullanıcı" gösterir).
select assert_true(
  (select full_name is null and avatar_url is null and team_name is null from public.get_my_blocked_users() where user_id = 'b1000000-0000-0000-0000-000000000003'),
  'restricted account exposes no identity fields');

-- Profili olmayan (silinmiş) hesap: yalnızca kimlik ve tarih.
select assert_true(
  (select full_name is null and avatar_url is null and team_name is null and blocked_at is not null from public.get_my_blocked_users() where user_id = 'b1000000-0000-0000-0000-000000000004'),
  'deleted account returns neutral row with date only');

-- Arşivli takım adı gösterilmez; kişi adı gösterilir.
select assert_eq((select full_name from public.get_my_blocked_users() where user_id = 'b1000000-0000-0000-0000-000000000005'), 'Oyuncu E', 'archived-team user name is shown');
select assert_true((select team_name is null from public.get_my_blocked_users() where user_id = 'b1000000-0000-0000-0000-000000000005'), 'archived team name is not shown');

-- X yalnızca kendi engelini (B) görür; A'nın engelleri X'e sızmaz.
select as_user('b1000000-0000-0000-0000-000000000006');
select assert_eq((select count(*)::int from public.get_my_blocked_users()), 1, 'other blocker sees only its own block');
select assert_eq((select user_id::text from public.get_my_blocked_users()), 'b1000000-0000-0000-0000-000000000002', 'other blocker row is B');

-- B'nin hiç engeli yok.
select as_user('b1000000-0000-0000-0000-000000000002');
select assert_eq((select count(*)::int from public.get_my_blocked_users()), 0, 'user who blocked nobody sees no rows');

select as_admin();

-- Yetki: anonim rol çalıştıramaz; oturum açmış kullanıcı çalıştırabilir.
select assert_true(not has_function_privilege('anon', 'public.get_my_blocked_users()', 'EXECUTE'), 'anon cannot execute get_my_blocked_users');
select assert_true(has_function_privilege('authenticated', 'public.get_my_blocked_users()', 'EXECUTE'), 'authenticated can execute get_my_blocked_users');

select 'ALL TESTS PASSED' as result;
