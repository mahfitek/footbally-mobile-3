-- Davet sistemi, ilan ve kadro kuralları için yerel SQL testleri (footbally_test veritabanı).
\set ON_ERROR_STOP 1

create or replace function as_user(p uuid) returns void language plpgsql as $$
begin
  execute 'set role authenticated';
  perform set_config('request.jwt.claim.sub', p::text, false);
end $$;

create or replace function as_anon() returns void language plpgsql as $$
begin
  execute 'set role anon';
  perform set_config('request.jwt.claim.sub', '', false);
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

create or replace function expect_error(p_sql text, p_code text, msg text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ASSERT FAILED: % (no error raised)', msg;
exception when others then
  if sqlerrm not like '%' || p_code || '%' then
    raise exception 'ASSERT FAILED: % (error was: %)', msg, sqlerrm;
  end if;
  raise notice 'PASS: %', msg;
end $$;

create table if not exists test_codes (name text primary key, code text);
create table if not exists test_ids (name text primary key, id uuid);

-- ---------------------------------------------------------------- kurulum (yönetici)
insert into auth.users (id, created_at) values
  ('00000000-0000-0000-0000-00000000000a', now()),               -- A: davet eden
  ('00000000-0000-0000-0000-00000000000b', now()),               -- B: ilk davet
  ('00000000-0000-0000-0000-00000000000c', now() - interval '8 days'), -- O: 7 günden eski
  ('00000000-0000-0000-0000-00000000000d', now()),               -- R: kalıcı banlı
  ('00000000-0000-0000-0000-00000000000e', now()),               -- RR: kısıtlı davet eden
  ('00000000-0000-0000-0000-00000000000f', now()),               -- C: profili kod kullanmadan önce tamamlar
  ('00000000-0000-0000-0000-000000000010', now() - interval '6 days'), -- S: 6 günlük hesap
  ('00000000-0000-0000-0000-000000000011', now()),               -- X: premium görev testi
  ('00000000-0000-0000-0000-000000000012', now());               -- T: takım kadro testi

insert into auth.users (id, created_at)
select ('f0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, now()
  from generate_series(1, 14) as n;

insert into public.profiles (user_id, full_name, position, city, district, foot, age, height, weight)
select id, 'Test Oyuncu', 'Defans', E'\u0130stanbul', E'Kad\u0131k\u00f6y', E'Sa\u011f', 25, 180, 75
  from auth.users;

update public.profiles
   set account_status = 'banned', ban_is_permanent = true, ban_reason = 'test'
 where user_id in ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000e');

-- ---------------------------------------------------------------- 1) kod üretme ve yetkiler
do $$
declare
  a text; a2 text; b text; rr text; o text;
  reg text := '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$';
begin
  perform as_user('00000000-0000-0000-0000-00000000000a');
  a := public.get_or_create_my_referral_code();
  a2 := public.get_or_create_my_referral_code();
  perform as_user('00000000-0000-0000-0000-00000000000b');
  b := public.get_or_create_my_referral_code();
  perform as_user('00000000-0000-0000-0000-00000000000e');
  rr := public.get_or_create_my_referral_code();
  perform as_user('00000000-0000-0000-0000-00000000000c');
  o := public.get_or_create_my_referral_code();
  perform as_admin();
  insert into test_codes values ('a', a), ('b', b), ('rr', rr), ('o', o);
  perform assert_true(a ~ reg, 'kod 8 karakter ve izinli alfabede');
  perform assert_eq(a, a2, 'ikinci çağrı aynı kodu döndürür');
  perform assert_true(a <> b, 'farklı kullanıcılar farklı kod alır');
  perform assert_true(rr ~ reg and o ~ reg, 'tüm kodlar izinli alfabede');
  perform assert_true(a !~ '[01OIL]', 'kodda 0, O, 1, I, L yok');
end $$;

do $$
begin
  perform as_user('00000000-0000-0000-0000-00000000000a');
  perform expect_error('update public.referral_codes set code = ''ZZZZZZZZ''', 'permission denied', 'istemci kodu değiştiremez');
  perform expect_error('select count(*) from public.referrals', 'permission denied', 'istemci referrals tablosunu okuyamaz');
  perform expect_error('insert into public.referrals (referrer_id, referred_id, code) values (auth.uid(), ''00000000-0000-0000-0000-00000000000b'', ''ABCDEFGH'')', 'permission denied', 'istemci davet satırı ekleyemez');
  perform as_anon();
  perform expect_error('select public.redeem_referral_code(''ABCDEFGH'')', 'permission denied', 'anon kod kullanamaz');
  perform expect_error('select public.get_or_create_my_referral_code()', 'permission denied', 'anon kod alamaz');
  perform as_admin();
end $$;

-- ---------------------------------------------------------------- 2) kullanma kuralları (hata durumları)
do $$
declare
  a text; rr text;
begin
  select code into a from test_codes where name = 'a';
  select code into rr from test_codes where name = 'rr';

  perform as_user('00000000-0000-0000-0000-00000000000a');
  perform expect_error(format('select public.redeem_referral_code(%L)', a), 'referral_own_code', 'kendi kodunu kullanamaz');

  perform as_user('00000000-0000-0000-0000-00000000000d');
  perform expect_error(format('select public.redeem_referral_code(%L)', a), 'account_restricted', 'kısıtlı hesap kod kullanamaz');

  perform as_user('00000000-0000-0000-0000-00000000000c');
  perform expect_error(format('select public.redeem_referral_code(%L)', a), 'referral_account_too_old', '7 günden eski hesap kod kullanamaz');

  perform as_user('00000000-0000-0000-0000-00000000000b');
  perform expect_error(format('select public.redeem_referral_code(%L)', rr), 'referral_invalid_code', 'kısıtlı davet eden kodu geçersiz');
  perform expect_error('select public.redeem_referral_code(''ZZZZZZZZ'')', 'referral_invalid_code', 'bilinmeyen kod geçersiz');
  perform as_admin();
end $$;

-- ---------------------------------------------------------------- 3) sınır: 6 günlük hesap kod kullanabilir
do $$
declare
  a text; r jsonb;
begin
  select code into a from test_codes where name = 'a';
  perform as_user('00000000-0000-0000-0000-000000000010');
  r := public.redeem_referral_code(a);
  perform as_admin();
  perform assert_eq(r->>'status', 'redeemed', '6 günlük hesap kodu kullanabilir (sınır içinde)');
end $$;

-- ---------------------------------------------------------------- 4) B: geçerli kullanım, ikinci kullanım, tamamlanmamış profil
do $$
declare
  a text; v_sub record; v_prof record; v_summary jsonb; v_qual timestamptz;
begin
  select code into a from test_codes where name = 'a';
  perform as_user('00000000-0000-0000-0000-00000000000b');
  perform public.redeem_referral_code(a);
  perform expect_error(format('select public.redeem_referral_code(%L)', a), 'referral_already_used', 'ikinci kullanım engellenir');
  perform as_admin();

  select * into v_sub from public.subscriptions
   where user_id = '00000000-0000-0000-0000-00000000000b' and plan = 'referral';
  perform assert_true(found, 'yeni kullanıcıya referral aboneliği tanımlanır');
  perform assert_eq(v_sub.status, 'active', 'abonelik status=active');
  perform assert_eq(v_sub.amount::int, 0, 'abonelik amount=0');
  perform assert_eq(v_sub.currency, 'TRY', 'abonelik currency=TRY');
  perform assert_true(abs(extract(epoch from (v_sub.expires_at - now()::timestamp)) - 14 * 86400) < 120,
    'yeni kullanıcıya 14 gün Premium');
  select * into v_prof from public.profiles where user_id = '00000000-0000-0000-0000-00000000000b';
  perform assert_true(v_prof.is_premium, 'yeni kullanıcı is_premium=true (subscription trigger)');
  perform assert_true(exists (select 1 from public.notifications
     where user_id = '00000000-0000-0000-0000-00000000000b'
       and body = E'Davet kodun onayland\u0131. 14 g\u00fcnl\u00fck Premium hediyen tan\u0131mland\u0131.'),
    'yeni kullanıcı bildirimi doğru metinle');

  select qualified_at into v_qual from public.referrals where referred_id = '00000000-0000-0000-0000-00000000000b';
  perform assert_true(v_qual is null, 'profil tamamlanmadan davet geçerli sayılmaz');

  perform as_user('00000000-0000-0000-0000-00000000000a');
  v_summary := public.get_my_referral_summary();
  perform as_admin();
  perform assert_eq((v_summary->>'invited_count')::int, 2, 'özet: davet edilen sayısı 2 (B ve S)');
  perform assert_eq((v_summary->>'qualified_count')::int, 0, 'özet: geçerli davet 0 (profil tamamlanmadı)');
end $$;

-- ---------------------------------------------------------------- 5) B profilini tamamlar -> geçerli (1/7) + çift çağrı
do $$
declare
  v_at1 timestamptz; v_at2 timestamptz; v_n integer;
begin
  perform as_user('00000000-0000-0000-0000-00000000000b');
  v_at1 := public.complete_my_player_profile();
  v_at2 := public.complete_my_player_profile();
  perform as_admin();
  perform assert_eq(v_at1, v_at2, 'profil iki kez tamamlanınca aynı zaman damgası (çift çağrı)');
  perform public.qualify_referral_for_user('00000000-0000-0000-0000-00000000000b');
  perform public.qualify_referral_for_user('00000000-0000-0000-0000-00000000000b');
  select count(*) into v_n from public.referrals
   where referrer_id = '00000000-0000-0000-0000-00000000000a' and qualified_at is not null;
  perform assert_eq(v_n, 1, 'nitelemeyi tekrarlamak sayacı artırmaz');
  perform assert_true(exists (select 1 from public.notifications
     where user_id = '00000000-0000-0000-0000-00000000000a' and body = E'Davet etti\u011fin bir kullan\u0131c\u0131 kat\u0131ld\u0131. (1/7)'),
    'davet edene (1/7) bildirimi');
end $$;

-- ---------------------------------------------------------------- 6) I1..I5: sayaç 6, ödül yok; S profilsiz -> sayılmaz
do $$
declare
  a text; i integer; v_n integer; v_rew integer;
  v_uid uuid;
begin
  select code into a from test_codes where name = 'a';
  for i in 1..5 loop
    v_uid := ('f0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    perform as_user(v_uid);
    perform public.redeem_referral_code(a);
    perform public.complete_my_player_profile();
    perform as_admin();
  end loop;
  select count(*) into v_n from public.referrals
   where referrer_id = '00000000-0000-0000-0000-00000000000a' and qualified_at is not null;
  perform assert_eq(v_n, 6, 'altı geçerli davet (B + I1..I5); S profilsiz olduğu için sayılmaz');
  select count(*) into v_rew from public.subscriptions
   where user_id = '00000000-0000-0000-0000-00000000000a' and plan = 'referral';
  perform assert_eq(v_rew, 0, '6. davette ödül yok');
end $$;

-- ---------------------------------------------------------------- 7) I6: 7. geçerli davet -> 30 gün ödül
do $$
declare
  a text; v_sub record; v_n integer; v_batch integer; v_exp1 timestamp; v_sub_count integer;
begin
  select code into a from test_codes where name = 'a';
  perform as_user('f0000000-0000-0000-0000-000000000006');
  perform public.redeem_referral_code(a);
  perform public.complete_my_player_profile();
  perform as_admin();

  select count(*) into v_sub_count from public.subscriptions
   where user_id = '00000000-0000-0000-0000-00000000000a' and plan = 'referral';
  perform assert_eq(v_sub_count, 1, '7. geçerli davette 1 referral aboneliği');
  select * into v_sub from public.subscriptions
   where user_id = '00000000-0000-0000-0000-00000000000a' and plan = 'referral';
  perform assert_true(abs(extract(epoch from (v_sub.expires_at - now()::timestamp)) - 30 * 86400) < 120,
    'davet edene 30 gün Premium');
  perform assert_eq(v_sub.amount::int, 0, 'davet ödülü amount=0');
  perform assert_true(exists (select 1 from public.notifications
     where user_id = '00000000-0000-0000-0000-00000000000a' and body = E'7 ki\u015fi davet ettin. 1 ayl\u0131k Premium hediyen tan\u0131mland\u0131.'),
    'davet ödülü bildirimi (7 kişi)');
  perform assert_true(exists (select 1 from public.notifications
     where user_id = '00000000-0000-0000-0000-00000000000a' and body = E'Davet etti\u011fin bir kullan\u0131c\u0131 kat\u0131ld\u0131. (7/7)'),
    'yedinci davette (7/7) bildirimi');
  select referrer_rewarded_batch into v_batch from public.referrals
   where referred_id = 'f0000000-0000-0000-0000-000000000006';
  perform assert_eq(v_batch, 1, 'yedinci davet 1. grup olarak işaretlendi');
  perform assert_eq(
    (select referrer_rewarded_batch from public.referrals where referred_id = '00000000-0000-0000-0000-00000000000b'),
    null::int, 'önceki davetler grup işaretlenmez');
end $$;

-- ---------------------------------------------------------------- 8) I7..I13: 14. davet -> ikinci 30 gün (üst üste)
do $$
declare
  a text; i integer; v_uid uuid; v_first timestamp; v_exp2 timestamp; v_n integer;
begin
  select code into a from test_codes where name = 'a';
  select expires_at into v_first from public.subscriptions
   where user_id = '00000000-0000-0000-0000-00000000000a' and plan = 'referral' order by created_at limit 1;
  for i in 7..13 loop
    v_uid := ('f0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    perform as_user(v_uid);
    perform public.redeem_referral_code(a);
    perform public.complete_my_player_profile();
    perform as_admin();
  end loop;

  select count(*) into v_n from public.subscriptions
   where user_id = '00000000-0000-0000-0000-00000000000a' and plan = 'referral';
  perform assert_eq(v_n, 2, '14. davette ikinci 30 günlük grup ödülü');
  select expires_at into v_exp2 from (
    select expires_at from public.subscriptions
     where user_id = '00000000-0000-0000-0000-00000000000a' and plan = 'referral'
     order by created_at desc limit 1) q;
  perform assert_true(abs(extract(epoch from (v_exp2 - v_first)) - 30 * 86400) < 2,
    'ikinci ödül birincinin bitişine eklenir (üst üste)');
  perform assert_eq(
    (select count(*)::int from public.referrals where referrer_id = '00000000-0000-0000-0000-00000000000a' and referrer_rewarded_batch is not null),
    2, 'iki grup işaretli');
end $$;

-- ---------------------------------------------------------------- 9) I14 (15. davet): ilerleme 1/7, ödül yok; çift çağrı güvenli
do $$
declare
  a text; v_summary jsonb; v_rewards integer; v_before integer; v_after integer;
begin
  select code into a from test_codes where name = 'a';
  perform as_user('f0000000-0000-0000-0000-000000000014');
  perform public.redeem_referral_code(a);
  perform public.complete_my_player_profile();
  perform as_admin();

  perform as_user('00000000-0000-0000-0000-00000000000a');
  v_summary := public.get_my_referral_summary();
  perform as_admin();
  perform assert_eq((v_summary->>'qualified_count')::int, 15, 'özet: geçerli davet 15');
  perform assert_eq((v_summary->>'progress')::int, 1, 'özet: 15. davette ilerleme 1 (15 mod 7)');
  perform assert_eq((v_summary->>'reward_months_total')::int, 2, 'özet: toplam 2 ay ödül');
  perform assert_eq((v_summary->>'invited_count')::int, 16, 'özet: toplam davet sayısı 16 (S dahil)');

  select count(*) into v_before from public.subscriptions
   where user_id = '00000000-0000-0000-0000-00000000000a' and plan = 'referral';
  perform public.qualify_referral_for_user('f0000000-0000-0000-0000-000000000014');
  perform public.qualify_referral_for_user('f0000000-0000-0000-0000-000000000014');
  select count(*) into v_after from public.subscriptions
   where user_id = '00000000-0000-0000-0000-00000000000a' and plan = 'referral';
  perform assert_eq(v_after, v_before, 'çift nitelemede ek ödül yok');
  perform expect_error(
    'update public.referrals set referrer_rewarded_batch = 1 where referred_id = ''f0000000-0000-0000-0000-000000000014''',
    'referrals_referrer_batch_key', 'aynı grup ikinci kez işaretlenemez (benzersiz indeks)');
end $$;

-- ---------------------------------------------------------------- 10) S: profilsiz davet sonradan tamamlanınca sayılır
do $$
declare v_n integer;
begin
  perform as_user('00000000-0000-0000-0000-000000000010');
  perform public.complete_my_player_profile();
  perform as_admin();
  select count(*) into v_n from public.referrals
   where referrer_id = '00000000-0000-0000-0000-00000000000a' and qualified_at is not null;
  perform assert_eq(v_n, 16, 'profilini sonradan tamamlayan davet de sayılır (16)');
end $$;

-- ---------------------------------------------------------------- 11) C: profili önce tamamlanmış -> kod kullanımında hemen geçerli
do $$
declare
  a text; v_n integer;
begin
  select code into a from test_codes where name = 'a';
  perform as_user('00000000-0000-0000-0000-00000000000f');
  perform public.complete_my_player_profile();
  perform public.redeem_referral_code(a);
  perform as_admin();
  select count(*) into v_n from public.referrals
   where referrer_id = '00000000-0000-0000-0000-00000000000a' and qualified_at is not null;
  perform assert_eq(v_n, 17, 'profili önce tamamlanmış kullanıcı kodu kullanınca hemen geçerli');
end $$;

-- ---------------------------------------------------------------- 12) Premium görevi: referral aboneliği sayılmaz
do $$
declare
  v_uid uuid := '00000000-0000-0000-0000-000000000011';
  v_done boolean;
begin
  insert into public.subscriptions (user_id, plan, status, expires_at, amount, currency)
  values (v_uid, 'referral', 'active', now() + interval '10 days', 0, 'TRY');
  select (t->>'done')::boolean into v_done
    from jsonb_array_elements(public.compute_profile_task_breakdown(v_uid)) t
   where t->>'id' = 'premium';
  perform assert_eq(v_done, false, 'referral aboneliği Premium görevini tamamlamaz');

  insert into public.subscriptions (user_id, plan, status, expires_at, amount, currency)
  values (v_uid, 'reward', 'active', now() + interval '10 days', 0, 'TRY');
  select (t->>'done')::boolean into v_done
    from jsonb_array_elements(public.compute_profile_task_breakdown(v_uid)) t
   where t->>'id' = 'premium';
  perform assert_eq(v_done, false, 'reward aboneliği Premium görevini tamamlamaz (değişmedi)');

  insert into public.subscriptions (user_id, plan, status, expires_at, amount, currency)
  values (v_uid, 'monthly', 'active', now() + interval '10 days', 299, 'TRY');
  select (t->>'done')::boolean into v_done
    from jsonb_array_elements(public.compute_profile_task_breakdown(v_uid)) t
   where t->>'id' = 'premium';
  perform assert_eq(v_done, true, 'ücretli abonelik Premium görevini tamamlar');
end $$;

-- ---------------------------------------------------------------- 13) Kadro ve ilan kuralları
do $$
declare
  v_team uuid := '10000000-0000-0000-0000-000000000001';
  v_owner uuid := '00000000-0000-0000-0000-000000000012';
  v_member uuid := '00000000-0000-0000-0000-00000000000b';
  v_outsider uuid := '00000000-0000-0000-0000-000000000011';
  v_id bigint;
  v_type text;
  v_fmt smallint;
begin
  insert into public.teams (id, owner_id, name) values (v_team, v_owner, 'Test Takım');
  insert into public.team_members (team_id, user_id, role, position) values
    (v_team, v_owner, 'owner', 'Kaleci'),
    (v_team, v_member, 'player', 'Defans');

  -- eski satır davranışı: listing_type varsayılanı 'players', format null
  insert into public.matches (title, date, time, location, city, district, type, required_players, creator_id)
  values ('Eski ilan', current_date, '20:00', 'Saha', E'\u0130stanbul', E'Kad\u0131k\u00f6y', '7v7', 14, v_owner)
  returning id into v_id;
  select listing_type, match_format into v_type, v_fmt from public.matches where id = v_id;
  perform assert_eq(v_type, 'players', 'varsayılan listing_type = players (eski davranış)');
  perform assert_true(v_fmt is null, 'eski satırda match_format null');

  -- takım kadrosu, üyeler: geçerli
  insert into public.matches (title, date, time, location, city, district, type, required_players, creator_id, team_id, listing_type, match_format, formation, lineup)
  values ('Takım ilanı', current_date, '20:00', 'Saha', E'\u0130stanbul', E'Kad\u0131k\u00f6y', '7v7', 6, v_owner, v_team, 'opponent', 7, '2-3-1',
          jsonb_build_array(jsonb_build_object('slot', 'GK', 'user_id', v_owner, 'name', 'K'),
                            jsonb_build_object('slot', 'DEF1', 'user_id', v_member, 'name', 'D')));

  perform expect_error(
    format($q$insert into public.matches (title, date, time, location, city, district, type, required_players, creator_id, team_id, lineup)
           values ('x', current_date, '20:00', 'S', 'İ', 'K', '7v7', 1, %L, %L, %L)$q$,
           v_owner, v_team, jsonb_build_array(jsonb_build_object('slot','X','user_id', v_outsider, 'name','Y'))::text),
    'lineup_not_team_member', 'takım dışı oyuncu kadroya yazılamaz');

  perform expect_error(
    format($q$insert into public.matches (title, date, time, location, city, district, type, required_players, creator_id, lineup)
           values ('x', current_date, '20:00', 'S', 'İ', 'K', '7v7', 1, %L, %L)$q$,
           v_owner, jsonb_build_array(jsonb_build_object('slot','X','user_id', v_member, 'name','Y'))::text),
    'lineup_requires_team', 'takımsız ilanda kadro yazılamaz');

  perform expect_error(
    format($q$insert into public.matches (title, date, time, location, city, district, type, required_players, creator_id, team_id, lineup)
           values ('x', current_date, '20:00', 'S', 'İ', 'K', '7v7', 1, %L, %L, %L)$q$,
           v_owner, v_team, jsonb_build_array(jsonb_build_object('slot','A','user_id', v_member, 'name','Y'), jsonb_build_object('slot','B','user_id', v_member, 'name','Y'))::text),
    'lineup_duplicate_player', 'aynı oyuncu iki slota yazılamaz');

  perform expect_error(
    'insert into public.matches (title, date, time, location, city, district, type, required_players, creator_id, listing_type) values (''x'', current_date, ''20:00'', ''S'', ''İ'', ''K'', ''7v7'', 1, ''00000000-0000-0000-0000-00000000000a'', ''bogus'')',
    'matches_listing_type_check', 'geçersiz listing_type reddedilir');
  perform expect_error(
    'insert into public.matches (title, date, time, location, city, district, type, required_players, creator_id, match_format) values (''x'', current_date, ''20:00'', ''S'', ''İ'', ''K'', ''7v7'', 1, ''00000000-0000-0000-0000-00000000000a'', 4)',
    'matches_match_format_check', 'match_format 4 reddedilir');
  perform expect_error(
    'insert into public.matches (title, date, time, location, city, district, type, required_players, creator_id, formation) values (''x'', current_date, ''20:00'', ''S'', ''İ'', ''K'', ''7v7'', 1, ''00000000-0000-0000-0000-00000000000a'', ''abc'')',
    'matches_formation_check', 'geçersiz diziliş metni reddedilir');
end $$;

select 'ALL TESTS PASSED' as result;
