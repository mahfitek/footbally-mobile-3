-- Başvuru reddetme ve iki yönlü engel kuralları için yerel testler (yalnızca yerel veritabanı).
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

create table if not exists blk_ids (name text primary key, id text);

-- ---------------------------------------------------------------- kurulum (yönetici)
insert into auth.users (id, created_at) values
  ('a1000000-0000-0000-0000-000000000001', now()),
  ('a1000000-0000-0000-0000-000000000002', now()),
  ('a1000000-0000-0000-0000-000000000003', now()),
  ('a1000000-0000-0000-0000-000000000009', now());

insert into public.profiles (user_id, full_name, position, city, district, foot, age, height, weight)
select id, 'Test', 'Defans', 'Istanbul', 'Kadikoy', 'Sag', 25, 180, 75 from auth.users
 where id::text like 'a1000000-%';
update public.profiles set account_status = 'banned', ban_is_permanent = true
 where user_id = 'a1000000-0000-0000-0000-000000000009';

insert into public.teams (id, owner_id, name) values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'T1'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'T2'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'T3');

-- Maçlar: M1 (U1 kurar), M2 (T2, U2 kurar), M3 (T1 takımı, U3 kurar: U1 takım sahibi), M5 (banlı B9 kurar), M6 (U1 kurar)
insert into public.matches (title, date, time, location, city, district, type, required_players, creator_id, team_id) values
  ('M1', current_date + 5, '20:00', 'Saha', 'I', 'K', '7v7', 5, 'a1000000-0000-0000-0000-000000000001', null),
  ('M2', current_date + 5, '20:00', 'Saha', 'I', 'K', '7v7', 5, 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002'),
  ('M3', current_date + 5, '20:00', 'Saha', 'I', 'K', '7v7', 5, 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001'),
  ('M5', current_date + 5, '20:00', 'Saha', 'I', 'K', '7v7', 5, 'a1000000-0000-0000-0000-000000000009', null),
  ('M6', current_date + 5, '20:00', 'Saha', 'I', 'K', '7v7', 5, 'a1000000-0000-0000-0000-000000000001', null);

insert into public.posts (id, user_id, caption) values
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'U1 gonderisi'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'U2 gonderisi'),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'U3 gonderisi');

-- Engelden ÖNCE yapılmış etkileşimler (silinmemeli).
insert into public.post_likes (post_id, user_id) values ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');
insert into public.follows (follower_id, followed_id) values ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001');
insert into public.conversations (id, participant_a, participant_b) values (900001, 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');
insert into public.messages (conversation_id, sender_user_id, body) values (900001, 'a1000000-0000-0000-0000-000000000002', 'engel oncesi');
insert into public.scout_conversations (id, scout_user_id, target_type, target_id) values (900001, 'a1000000-0000-0000-0000-000000000002', 'player', 'a1000000-0000-0000-0000-000000000001');
insert into public.scout_messages (conversation_id, sender_user_id, body) values (900001, 'a1000000-0000-0000-0000-000000000002', 'engel oncesi');

-- ---------------------------------------------------------------- A) başvuru reddetme (engel yokken)
-- U2, M1'e başvurur; U3 da başvurur.
insert into public.match_applications (match_id, user_id, status)
select m.id, 'a1000000-0000-0000-0000-000000000002', 'applied' from public.matches m where m.title = 'M1';
insert into public.match_applications (match_id, user_id, status)
select m.id, 'a1000000-0000-0000-0000-000000000003', 'applied' from public.matches m where m.title = 'M1';
-- U2, M4 benzeri takım ilanı M3'e (takım sahibi U1) başvurur.
insert into public.match_applications (match_id, user_id, status)
select m.id, 'a1000000-0000-0000-0000-000000000002', 'applied' from public.matches m where m.title = 'M3';

do $$
declare
  v_app_u2 bigint; v_app_u3 bigint; v_app_m3 bigint; v_m1 bigint; v_m3 bigint; v_res text; v_n integer; v_status text;
begin
  select id into v_app_u2 from public.match_applications where user_id = 'a1000000-0000-0000-0000-000000000002' and match_id = (select id from public.matches where title = 'M1');
  select id into v_app_u3 from public.match_applications where user_id = 'a1000000-0000-0000-0000-000000000003' and match_id = (select id from public.matches where title = 'M1');
  select id into v_app_m3 from public.match_applications where user_id = 'a1000000-0000-0000-0000-000000000002' and match_id = (select id from public.matches where title = 'M3');
  insert into blk_ids values ('app_u2', v_app_u2::text), ('app_u3', v_app_u3::text), ('app_m3', v_app_m3::text)
    on conflict (name) do update set id = excluded.id;

  -- R1: ilan sahibi (U1) reddeder.
  perform as_user('a1000000-0000-0000-0000-000000000001');
  v_res := public.reject_match_application(v_app_u2);
  perform as_admin();
  perform assert_eq(v_res, 'rejected', 'ilan sahibi basvuruyu reddedebilir');
  select status into v_status from public.match_applications where id = v_app_u2;
  perform assert_eq(v_status, 'rejected', 'reddedilen basvuru durumu rejected');
  select count(*) into v_n from public.notifications where user_id = 'a1000000-0000-0000-0000-000000000002' and title = E'Ba\u015fvurun reddedildi';
  perform assert_eq(v_n, 1, 'basvurana tek bildirim eklenir');

  -- R2: ikinci çağrı aynı sonuç, ikinci bildirim yok.
  perform as_user('a1000000-0000-0000-0000-000000000001');
  v_res := public.reject_match_application(v_app_u2);
  perform as_admin();
  perform assert_eq(v_res, 'already_rejected', 'cift cagri hata vermez, already_rejected doner');
  select count(*) into v_n from public.notifications where user_id = 'a1000000-0000-0000-0000-000000000002' and title = E'Ba\u015fvurun reddedildi';
  perform assert_eq(v_n, 1, 'cift cagri ikinci bildirim uretmez');

  -- R3: ilan sahibi olmayan (U2) reddedemez.
  perform as_user('a1000000-0000-0000-0000-000000000002');
  perform expect_error(format('select public.reject_match_application(%s)', v_app_u3), 'not_match_owner', 'sahibi olmayan reddedemez');
  perform as_admin();

  -- R4: takım sahibi (U1, M3 ilanının takımı T1) reddedebilir; ilan oluşturan U3.
  perform as_user('a1000000-0000-0000-0000-000000000001');
  v_res := public.reject_match_application(v_app_m3);
  perform as_admin();
  perform assert_eq(v_res, 'rejected', 'takim sahibi ilan sahibi degilken de reddedebilir');

  -- R5: reddedilen başvuran kendi başvurusunu silemez.
  perform as_user('a1000000-0000-0000-0000-000000000002');
  perform expect_error(format('delete from public.match_applications where id = %s', v_app_u2), 'application_rejected', 'reddedilen basvuru silinemez');
  perform as_admin();

  -- R6: reddedilen başvuran aynı ilana yeniden başvuramaz.
  perform expect_error(
    'insert into public.match_applications (match_id, user_id, status) select m.id, ''a1000000-0000-0000-0000-000000000002'', ''applied'' from public.matches m where m.title = ''M1''',
    'application_rejected', 'reddedilen kullanici ayni ilana yeniden basvuramaz');

  -- R7: yalnızca başvurunun sahibi (U1) değilse ve pending olan U3 başvurusu duruyor.
  select status into v_status from public.match_applications where id = v_app_u3;
  perform assert_eq(v_status, 'applied', 'diger basvurular etkilenmez');

  -- R8: opportunity başvurusu (match_id yok) reddedilemez.
  insert into public.match_applications (match_id, user_id, status, opportunity_id) values (null, 'a1000000-0000-0000-0000-000000000003', 'applied', 'opp-1') returning id into v_m1;
  perform as_user('a1000000-0000-0000-0000-000000000001');
  perform expect_error(format('select public.reject_match_application(%s)', v_m1), 'application_not_match', 'ilansiz basvuru reddedilemez');
  perform as_admin();

  -- R9: olmayan başvuru.
  perform as_user('a1000000-0000-0000-0000-000000000001');
  perform expect_error('select public.reject_match_application(999999999)', 'application_not_found', 'olmayan basvuru bulunamaz');
  perform as_admin();
end $$;

-- R10: kısıtlı (banlı) ilan sahibi reddedemez. B9, M5'e U3 başvurusu varken.
insert into public.match_applications (match_id, user_id, status)
select m.id, 'a1000000-0000-0000-0000-000000000003', 'applied' from public.matches m where m.title = 'M5';
do $$
declare v_app bigint;
begin
  select id into v_app from public.match_applications where match_id = (select id from public.matches where title = 'M5');
  perform as_user('a1000000-0000-0000-0000-000000000009');
  perform expect_error(format('select public.reject_match_application(%s)', v_app), 'account_restricted', 'kisitli hesap reddedemez');
  perform as_admin();
end $$;

-- ---------------------------------------------------------------- B) iki yönlü engel
-- U1 engelledi U2'yi. Önceki etkileşimler yerinde kalmalı.
insert into public.user_blocks (blocker_id, blocked_id) values ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');

do $$
declare v_n integer;
begin
  -- Mevcut satırlar korunur
  select count(*) into v_n from public.post_likes where user_id = 'a1000000-0000-0000-0000-000000000002';
  perform assert_eq(v_n, 1, 'engelden once yapilan begeni silinmez');
  select count(*) into v_n from public.follows where follower_id = 'a1000000-0000-0000-0000-000000000002';
  perform assert_eq(v_n, 1, 'engelden once yapilan takip silinmez');
  select count(*) into v_n from public.messages where conversation_id = 900001;
  perform assert_eq(v_n, 1, 'engelden once yapilan mesaj silinmez');
end $$;

-- begeni (iki yon) + kontrol
do $$
begin
  perform expect_error('insert into public.post_likes (post_id, user_id) values (''c1000000-0000-0000-0000-000000000001'', ''a1000000-0000-0000-0000-000000000002'') on conflict do nothing', 'blocked_interaction', 'engelli kullanici begeni yapamaz (U2 -> U1 gonderi)');
  perform expect_error('insert into public.post_likes (post_id, user_id) values (''c1000000-0000-0000-0000-000000000002'', ''a1000000-0000-0000-0000-000000000001'')', 'blocked_interaction', 'engelleyen de begeni yapamaz (U1 -> U2 gonderi)');
  insert into public.post_likes (post_id, user_id) values ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003');
  raise notice 'PASS: engel yokken (U3) begeni normal calisir';
end $$;

-- yorum
do $$
begin
  perform expect_error('insert into public.post_comments (post_id, user_id, content) values (''c1000000-0000-0000-0000-000000000001'', ''a1000000-0000-0000-0000-000000000002'', ''x'')', 'blocked_interaction', 'engelli kullanici yorum yazamaz');
  perform expect_error('insert into public.post_comments (post_id, user_id, content) values (''c1000000-0000-0000-0000-000000000002'', ''a1000000-0000-0000-0000-000000000001'', ''x'')', 'blocked_interaction', 'engelleyen de yorum yazamaz');
  insert into public.post_comments (post_id, user_id, content) values ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'ok');
  raise notice 'PASS: engel yokken yorum normal calisir';
end $$;

-- takip
do $$
begin
  perform expect_error('insert into public.follows (follower_id, followed_id) values (''a1000000-0000-0000-0000-000000000002'', ''a1000000-0000-0000-0000-000000000001'')', 'blocked_interaction', 'engelli kullanici takip edemez (U2 -> U1)');
  perform expect_error('insert into public.follows (follower_id, followed_id) values (''a1000000-0000-0000-0000-000000000001'', ''a1000000-0000-0000-0000-000000000002'')', 'blocked_interaction', 'engelleyen de takip edemez (U1 -> U2)');
  insert into public.follows (follower_id, followed_id) values ('a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001');
  raise notice 'PASS: engel yokken takip normal calisir';
end $$;

-- bağlantı isteği
do $$
begin
  perform expect_error('insert into public.connections (requester_id, target_id) values (''a1000000-0000-0000-0000-000000000002'', ''a1000000-0000-0000-0000-000000000001'')', 'blocked_interaction', 'engelli kullanici baglanti isteyemez');
  perform expect_error('insert into public.connections (requester_id, target_id) values (''a1000000-0000-0000-0000-000000000001'', ''a1000000-0000-0000-0000-000000000002'')', 'blocked_interaction', 'engelleyen de baglanti isteyemez');
  insert into public.connections (requester_id, target_id) values ('a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001');
  raise notice 'PASS: engel yokken baglanti istegi normal calisir';
end $$;

-- meydan okuma (takım sahipleri)
do $$
begin
  perform expect_error('insert into public.match_challenges (challenger_team_id, opponent_team_id, status) values (''b1000000-0000-0000-0000-000000000002'', ''b1000000-0000-0000-0000-000000000001'', ''pending'')', 'blocked_interaction', 'engelli takimlar meydan okuyamaz (T2 -> T1)');
  perform expect_error('insert into public.match_challenges (challenger_team_id, opponent_team_id, status) values (''b1000000-0000-0000-0000-000000000001'', ''b1000000-0000-0000-0000-000000000002'', ''pending'')', 'blocked_interaction', 'engelleyenin takimi da meydan okuyamaz (T1 -> T2)');
  insert into public.match_challenges (challenger_team_id, opponent_team_id, status) values ('b1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'pending');
  raise notice 'PASS: engel yokken meydan okuma normal calisir';
end $$;

-- takım daveti
do $$
begin
  perform expect_error('insert into public.team_invitations (team_id, user_id, status) values (''b1000000-0000-0000-0000-000000000001'', ''a1000000-0000-0000-0000-000000000002'', ''pending'')', 'blocked_interaction', 'engelli kullanici takima davet edilemez (T1 <- U2)');
  perform expect_error('insert into public.team_invitations (team_id, user_id, status) values (''b1000000-0000-0000-0000-000000000002'', ''a1000000-0000-0000-0000-000000000001'', ''pending'')', 'blocked_interaction', 'engelleyen de takima davet edemez (T2 <- U1)');
  insert into public.team_invitations (team_id, user_id, status) values ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'pending');
  raise notice 'PASS: engel yokken takim daveti normal calisir';
end $$;

-- yeni sohbet ve mesaj (mevcut mesaj engeli, hata kodu blocked_user)
do $$
begin
  perform expect_error('insert into public.conversations (participant_a, participant_b) values (''a1000000-0000-0000-0000-000000000002'', ''a1000000-0000-0000-0000-000000000001'')', 'blocked_interaction', 'engelli kullanici yeni sohbet baslatamaz');
  perform expect_error('insert into public.conversations (participant_a, participant_b) values (''a1000000-0000-0000-0000-000000000001'', ''a1000000-0000-0000-0000-000000000002'')', 'blocked_interaction', 'engelleyen de yeni sohbet baslatamaz');
  insert into public.conversations (participant_a, participant_b) values ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003');
  raise notice 'PASS: engel yokken sohbet normal baslar';
  perform expect_error('insert into public.messages (conversation_id, sender_user_id, body) values (900001, ''a1000000-0000-0000-0000-000000000002'', ''yeni'')', 'blocked_user', 'mevcut mesaj engeli korunur (blocked_user)');
end $$;

-- scout konuşması (hedef oyuncu ya da takım sahibi) ve scout mesajı
do $$
begin
  perform expect_error('insert into public.scout_conversations (scout_user_id, target_type, target_id) values (''a1000000-0000-0000-0000-000000000002'', ''player'', ''a1000000-0000-0000-0000-000000000001'')', 'blocked_interaction', 'engelli scout oyuncuya ulasamaz');
  perform expect_error('insert into public.scout_conversations (scout_user_id, target_type, target_id) values (''a1000000-0000-0000-0000-000000000001'', ''team'', ''b1000000-0000-0000-0000-000000000002'')', 'blocked_interaction', 'engelleyen scout takimin sahibine ulasamaz');
  insert into public.scout_conversations (scout_user_id, target_type, target_id) values ('a1000000-0000-0000-0000-000000000003', 'player', 'a1000000-0000-0000-0000-000000000001');
  raise notice 'PASS: engel yokken scout konusmasi normal acilir';
  perform expect_error('insert into public.scout_messages (conversation_id, sender_user_id, body) values (900001, ''a1000000-0000-0000-0000-000000000002'', ''yeni'')', 'blocked_interaction', 'engelli scout konusmasina mesaj yazamaz');
end $$;

-- başvuru (iki yön): U2 -> M6 (sahibi U1); U1 -> M2 (sahibi U2)
do $$
begin
  perform expect_error('insert into public.match_applications (match_id, user_id, status) select m.id, ''a1000000-0000-0000-0000-000000000002'', ''applied'' from public.matches m where m.title = ''M6''', 'blocked_interaction', 'engelli kullanici ilana basvuramaz');
  perform expect_error('insert into public.match_applications (match_id, user_id, status) select m.id, ''a1000000-0000-0000-0000-000000000001'', ''applied'' from public.matches m where m.title = ''M2''', 'blocked_interaction', 'engelleyen de karsi tarafin takim ilanina basvuramaz');
  insert into public.match_applications (match_id, user_id, status) select m.id, 'a1000000-0000-0000-0000-000000000003', 'applied' from public.matches m where m.title = 'M6';
  raise notice 'PASS: engel yokken basvuru normal calisir';
end $$;

-- ---------------------------------------------------------------- C) sunucu yardımcısı
select assert_true(public.users_blocked_either_way('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002'), 'yardimci: U1-U2 yonsuz engel dogru');
select assert_true(public.users_blocked_either_way('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001'), 'yardimci: ters yon de dogru');
select assert_true(not public.users_blocked_either_way('a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001'), 'yardimci: engelsiz cift false');
select assert_true(not public.users_blocked_either_way(null, 'a1000000-0000-0000-0000-000000000001'), 'yardimci: null false');

select 'ALL TESTS PASSED' as result;
