-- ============================================================================
-- FOOTBALLY — TANITIM (DEMO) VERİSİ
-- ============================================================================
-- Bu script uygulamayı tanıtım/demo için gerçekçi verilerle doldurur.
-- Ödeme entegrasyonu + şirketleşme tamamlandığında bu script'in oluşturduğu
-- HER ŞEYİ supabase/demo_seed_cleanup.sql ile tek seferde geri alabilirsin.
--
-- Bu script TEK SEFERLİK çalıştırılmak üzere yazıldı. Tekrar çalıştırmadan
-- önce demo_seed_cleanup.sql ile temizle, yoksa maç/mesaj/tribün gibi
-- unique-constraint'i olmayan tablolarda yinelenen kayıtlar oluşur.
--
-- ÇALIŞTIRMADAN ÖNCE YAPMAN GEREKEN TEK ŞEY:
-- Supabase Dashboard → Authentication → Users → "Add user" ile aşağıdaki
-- 4 hesabı oluştur ("Auto Confirm User" işaretli olsun), sonra her birinin
-- User UID'sini kopyalayıp bu dosyanın hemen altındaki "declare" bloğuna
-- yapıştır (v_oyuncu1, v_oyuncu2, v_takim, v_saha):
--
--   1) demo.oyuncu1@footbally.app   şifre: Demo2026!Oyuncu1   (Mert Aydın — Forvet)
--   2) demo.oyuncu2@footbally.app   şifre: Demo2026!Oyuncu2   (Emre Şahin — Orta Saha)
--   3) demo.takim@footbally.app     şifre: Demo2026!Takim     (Kartallar FK)
--   4) demo.saha@footbally.app      şifre: Demo2026!Saha      (Halı saha işletmecisi)
--
-- Sonra bu dosyanın TAMAMINI SQL Editor'e yapıştırıp çalıştır.
-- ============================================================================

do $$
declare
  -- === BURAYI DOLDUR: Dashboard'dan aldığın 4 gerçek User UID'yi yapıştır ===
  v_oyuncu1 uuid := 'HERO_OYUNCU1_UID_BURAYA';
  v_oyuncu2 uuid := 'HERO_OYUNCU2_UID_BURAYA';
  v_takim   uuid := 'HERO_TAKIM_UID_BURAYA';
  v_saha    uuid := 'HERO_SAHA_UID_BURAYA';

  -- Aşağısı otomatik, dokunmana gerek yok.
  names text[] := array['Ali Kaya','Burak Demir','Cem Yıldız','Deniz Arslan','Emirhan Koç','Furkan Şen','Gökhan Aydın','Hakan Çelik','İbrahim Doğan','Kerem Aksoy','Levent Yılmaz','Onur Polat','Selim Aktaş','Tolga Er','Yusuf Kaplan'];
  positions text[] := array['Kaleci','Defans','Orta Saha','Kanat','Forvet'];
  cities text[] := array['İstanbul','Ankara','İzmir','Bursa','Antalya','Adana'];
  districts text[] := array['Kadıköy','Çankaya','Bornova','Nilüfer','Muratpaşa','Seyhan'];
  scores int[] := array[42,55,63,71,48,77,58,66,39,82,60,73,52,68,45];
  team_names text[] := array['Yıldızspor','Demir Kale','Sahil Gençlik','Zafer Birlik','Metropol FK','Boztepe FK'];
  i int;
  uid uuid;
  fake_password text := '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX';
begin

  if v_oyuncu1::text = 'HERO_OYUNCU1_UID_BURAYA' then
    raise exception 'Once dosyanin ustundeki 4 UID placeholderini gercek degerlerle degistir.';
  end if;

  -- ==========================================================================
  -- 1) FİGÜRAN OYUNCULAR (15 adet, hiç giriş yapılmayacak — sadece keşif
  --    ekranlarını (Oyuncular/Scout/Ara) doldurmak için)
  -- ==========================================================================
  for i in 1..15 loop
    uid := ('de000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'demo.figuran' || i || '@footbally.demo', fake_password,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false
    ) on conflict (id) do nothing;

    insert into public.profiles (user_id, full_name, position, city, district, score)
    values (
      uid, names[i], positions[1 + ((i - 1) % 5)], cities[1 + ((i - 1) % 6)],
      districts[1 + ((i - 1) % 6)], scores[i]
    ) on conflict (user_id) do update set
      full_name = excluded.full_name, position = excluded.position,
      city = excluded.city, district = excluded.district, score = excluded.score;
  end loop;

  -- ==========================================================================
  -- 2) FİGÜRAN TAKIM SAHİPLERİ + TAKIMLAR (6 adet — Takımlar/Rakip Bul
  --    ekranlarını doldurmak için)
  -- ==========================================================================
  for i in 1..6 loop
    uid := ('de100000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'demo.takimsahibi' || i || '@footbally.demo', fake_password,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false
    ) on conflict (id) do nothing;

    insert into public.teams (
      owner_id, name, city, district, league, formation,
      playing_style, match_days, needed_positions, founded_year,
      ground_name, description, whatsapp_link, contact_number
    ) values (
      uid, team_names[i], cities[1 + ((i - 1) % 6)], districts[1 + ((i - 1) % 6)],
      (array['Süper Amatör','Amatör','Bölgesel'])[1 + ((i - 1) % 3)],
      (array['4-4-2','4-3-3','3-5-2'])[1 + ((i - 1) % 3)],
      array[(array['Hızlı Geçiş','Fiziksel','Teknik'])[1 + ((i - 1) % 3)]],
      array['Cumartesi','Pazar'],
      array[(array['Kaleci','Defans','Forvet'])[1 + ((i - 1) % 3)]],
      2015 + i, team_names[i] || ' Tesisleri',
      'Her seviyeden oyuncuya açık, rekabetçi bir kadro kuruyoruz.',
      null, null
    );
  end loop;

  -- ==========================================================================
  -- 3) HERO HESAPLARIN PROFİL/TAKIM BİLGİLERİ
  -- ==========================================================================
  insert into public.profiles (user_id, full_name, position, city, district, score, age, height, weight, foot, club)
  values (v_oyuncu1, 'Mert Aydın', 'Forvet', 'İstanbul', 'Kadıköy', 88, 24, 181, 76, 'Sağ Ayak', 'Amatör Ligi')
  on conflict (user_id) do update set full_name = excluded.full_name, position = excluded.position,
    city = excluded.city, district = excluded.district, score = excluded.score, age = excluded.age,
    height = excluded.height, weight = excluded.weight, foot = excluded.foot, club = excluded.club;

  insert into public.profiles (user_id, full_name, position, city, district, score, age, height, weight, foot, club)
  values (v_oyuncu2, 'Emre Şahin', 'Orta Saha', 'İstanbul', 'Beşiktaş', 65, 27, 176, 71, 'Sol Ayak', 'Amatör Ligi')
  on conflict (user_id) do update set full_name = excluded.full_name, position = excluded.position,
    city = excluded.city, district = excluded.district, score = excluded.score, age = excluded.age,
    height = excluded.height, weight = excluded.weight, foot = excluded.foot, club = excluded.club;

  insert into public.profiles (user_id, full_name)
  values (v_takim, 'Kartallar FK Yönetimi')
  on conflict (user_id) do update set full_name = excluded.full_name;

  insert into public.profiles (user_id, full_name)
  values (v_saha, 'Halı Saha Yönetimi')
  on conflict (user_id) do update set full_name = excluded.full_name;

  insert into public.teams (
    owner_id, name, city, district, league, formation,
    playing_style, match_days, needed_positions, founded_year,
    ground_name, description, whatsapp_link, contact_number
  ) values (
    v_takim, 'Kartallar FK', 'İstanbul', 'Kadıköy', 'Süper Amatör', '4-3-3',
    array['Hızlı Geçiş', 'Hücum Ağırlıklı'], array['Cumartesi', 'Pazar'],
    array['Kaleci', 'Stoper'], 2018, 'Kartallar Tesisleri',
    'Her hafta düzenli antrenman yapan, rekabetçi bir amatör takımız. Yeni oyuncu arıyoruz.',
    'https://chat.whatsapp.com/ornekkartallarfk', '0532 000 00 00'
  );

  -- ==========================================================================
  -- 4) MAÇLAR (8 adet — Ana Sayfa / Maç Arayanlar / Ara ekranlarını doldurur)
  -- ==========================================================================
  insert into public.matches (title, date, time, location, city, required_players, type, category, creator_id) values
    ('Hafta Sonu Dostluk Maçı', (current_date + 2)::text, '20:00', 'Kadıköy Halı Saha', 'İstanbul, Kadıköy', 14, '7v7', 'Eğlence', v_oyuncu1),
    ('Rekabetçi 6v6 Turnuva Provası', (current_date + 3)::text, '21:00', 'Zafer Spor Kompleksi', 'İstanbul, Beşiktaş', 12, '6v6', 'Rekabetçi', v_oyuncu2),
    ('Akşam Antrenman Maçı', (current_date + 1)::text, '19:00', 'Sahil Halı Saha', 'İstanbul, Maltepe', 10, '5v5', 'Antrenman', v_takim),
    ('Ankara Amatör Buluşması', (current_date + 4)::text, '18:30', 'Çankaya Halı Saha', 'Ankara, Çankaya', 14, '7v7', 'Eğlence', ('de000000-0000-0000-0000-000000000002')::uuid),
    ('İzmir Sahil Maçı', (current_date + 5)::text, '20:30', 'Bornova Spor Tesisi', 'İzmir, Bornova', 12, '6v6', 'Rekabetçi', ('de000000-0000-0000-0000-000000000005')::uuid),
    ('Bursa Gece Maçı', (current_date + 2)::text, '22:00', 'Nilüfer Halı Saha', 'Bursa, Nilüfer', 10, '5v5', 'Eğlence', ('de000000-0000-0000-0000-000000000008')::uuid),
    ('Antalya Turnuva Hazırlık', (current_date + 6)::text, '17:00', 'Muratpaşa Spor Kompleksi', 'Antalya, Muratpaşa', 14, '7v7', 'Rekabetçi', ('de100000-0000-0000-0000-000000000001')::uuid),
    ('Adana Amatör Ligi Provası', (current_date + 3)::text, '19:30', 'Seyhan Halı Saha', 'Adana, Seyhan', 12, '6v6', 'Antrenman', ('de100000-0000-0000-0000-000000000003')::uuid);

  -- ==========================================================================
  -- 5) İLANLAR / FIRSATLAR (opportunities — Ara ekranındaki "İlanlar" sekmesi)
  -- ==========================================================================
  insert into public.opportunities (id, title, subtitle, location, badge, created_at) values
    ('de300000-0000-0000-0000-000000000001', 'İstanbul Altyapı Forvet Arıyor', 'Amatör kulüp, 20-26 yaş forvet pozisyonu için deneme daveti veriyor', 'İstanbul, Kadıköy', 'Yeni', now() - interval '2 hours'),
    ('de300000-0000-0000-0000-000000000002', 'Ankara Kaleci Denemesi', 'Bölgesel amatör lig takımı kaleci arıyor', 'Ankara, Çankaya', 'Acil', now() - interval '5 hours'),
    ('de300000-0000-0000-0000-000000000003', 'İzmir Genç Yetenek Taraması', '18 yaş altı oyuncular için scout gözlem günü', 'İzmir, Bornova', 'Yeni', now() - interval '1 day'),
    ('de300000-0000-0000-0000-000000000004', 'Bursa Orta Saha Transferi', 'Süper Amatör ekip, deneyimli orta saha oyuncusu arıyor', 'Bursa, Nilüfer', null, now() - interval '2 days'),
    ('de300000-0000-0000-0000-000000000005', 'Antalya Kış Kampı Davetiyesi', 'Kış hazırlık kampına katılacak oyuncular aranıyor', 'Antalya, Muratpaşa', 'Sınırlı Kontenjan', now() - interval '3 days'),
    ('de300000-0000-0000-0000-000000000006', 'Adana Stoper Arayışı', 'Amatör lig ekibi savunma hattını güçlendirmek istiyor', 'Adana, Seyhan', null, now() - interval '4 days')
  on conflict (id) do update set title = excluded.title;

  -- ==========================================================================
  -- 6) MESAJLAR (canlı iki hesap arasında sohbet + figüranlardan gelen mesajlar)
  -- ==========================================================================
  insert into public.messages (sender_id, receiver_id, content, created_at, read) values
    (v_oyuncu1, v_oyuncu2, 'Selam Emre, hafta sonu ki maça geliyor musun?', now() - interval '2 days', true),
    (v_oyuncu2, v_oyuncu1, 'Selam Mert, geliyorum. Saat kaçta buluşuyoruz?', now() - interval '2 days' + interval '5 minutes', true),
    (v_oyuncu1, v_oyuncu2, 'Saat 20:00''de Kadıköy''deki sahada.', now() - interval '2 days' + interval '10 minutes', true),
    (v_oyuncu2, v_oyuncu1, 'Tamamdır, forma rengini de söyle.', now() - interval '1 day', true),
    (v_oyuncu1, v_oyuncu2, 'Beyaz forma giyelim, rakip lacivert giyecek.', now() - interval '1 day' + interval '3 minutes', false),
    (('de000000-0000-0000-0000-000000000004')::uuid, v_oyuncu1, 'Merhaba, profilini gördüm çok iyi görünüyorsun. Takımımıza katılır mısın?', now() - interval '6 hours', false),
    (('de000000-0000-0000-0000-000000000004')::uuid, v_oyuncu1, 'Cumartesi günü bir deneme antrenmanımız var, gelebilir misin?', now() - interval '5 hours', false),
    (v_takim, v_oyuncu1, 'Kartallar FK olarak forvet pozisyonu için seninle görüşmek isteriz.', now() - interval '3 hours', false);

  -- ==========================================================================
  -- 7) BİLDİRİMLER (v_oyuncu1 için)
  -- ==========================================================================
  insert into public.notifications (user_id, icon, message, screen, read, created_at) values
    (v_oyuncu1, 'people-outline', 'Burak Demir sana bağlantı isteği gönderdi.', 'notifications', false, now() - interval '1 hour'),
    (v_oyuncu1, 'trophy-outline', 'Yeni bir rozet kazandın: İyi Seviye!', 'badges', false, now() - interval '3 hours'),
    (v_oyuncu1, 'football-outline', 'Hafta Sonu Dostluk Maçı''na 3 yeni katılımcı eklendi.', 'match', true, now() - interval '1 day'),
    (v_oyuncu1, 'chatbubble-outline', 'Kartallar FK sana mesaj gönderdi.', 'chat', false, now() - interval '3 hours');

  -- ==========================================================================
  -- 8) BAĞLANTILAR (connections)
  -- ==========================================================================
  insert into public.connections (requester_id, target_id, status) values
    (('de000000-0000-0000-0000-000000000002')::uuid, v_oyuncu1, 'pending'),
    (('de000000-0000-0000-0000-000000000006')::uuid, v_oyuncu1, 'pending'),
    (('de000000-0000-0000-0000-000000000010')::uuid, v_oyuncu1, 'accepted'),
    (v_oyuncu1, v_oyuncu2, 'accepted')
  on conflict (requester_id, target_id) do nothing;

  -- ==========================================================================
  -- 9) TRİBÜN (herkese açık sohbet) MESAJLARI
  -- ==========================================================================
  insert into public.tribun_messages (sender_id, content, created_at) values
    (('de000000-0000-0000-0000-000000000003')::uuid, 'Bu hafta sonu İstanbul''da maç arayan var mı?', now() - interval '3 hours'),
    (v_oyuncu1, 'Kadıköy''de cumartesi 20:00''de yer var, katılmak isteyen yazsın.', now() - interval '2 hours 50 minutes'),
    (('de000000-0000-0000-0000-000000000007')::uuid, 'Ben varım, hangi saha?', now() - interval '2 hours 40 minutes'),
    (v_oyuncu1, 'Yıldız Halı Saha, Bağdat Caddesi üzerinde.', now() - interval '2 hours 35 minutes'),
    (('de100000-0000-0000-0000-000000000002')::uuid, 'Yıldızspor olarak rakip arıyoruz, 7v7 uygun olan var mı?', now() - interval '2 hours'),
    (v_oyuncu2, 'Biz Kartallar FK olarak ilgileniriz, DM atıyorum.', now() - interval '1 hour 50 minutes'),
    (('de000000-0000-0000-0000-000000000011')::uuid, 'Ankara''da halı saha önerisi olan var mı, yeni taşındım.', now() - interval '1 hour'),
    (v_takim, 'Kartallar FK olarak yeni sezon kadromuza forvet ve stoper arıyoruz, ilgilenen DM atsın.', now() - interval '40 minutes'),
    (('de000000-0000-0000-0000-000000000013')::uuid, 'Bence bu sezon en iyi gelişen oyuncular arasında Mert Aydın var, tebrikler!', now() - interval '20 minutes'),
    (v_oyuncu1, 'Teşekkürler, herkese iyi maçlar!', now() - interval '10 minutes');

  -- ==========================================================================
  -- 10) HALI SAHALAR + MÜSAİTLİK (v_saha hesabına ait 3 partner saha)
  -- ==========================================================================
  insert into public.venues (id, owner_user_id, name, city, district, address, phone, whatsapp, price_per_hour, description, is_active)
  values
    ('de200000-0000-0000-0000-000000000001', v_saha, 'Yıldız Halı Saha', 'İstanbul', 'Kadıköy', 'Bağdat Cd. No:120, Kadıköy/İstanbul', '05321112233', '905321112233', 600, 'Suni çim zemin, kapalı otopark, kafeterya. 5v5 ve 6v6 saha.', true),
    ('de200000-0000-0000-0000-000000000002', v_saha, 'Zafer Spor Kompleksi', 'İstanbul', 'Beşiktaş', 'Levent Mah. Spor Cd. No:45, Beşiktaş/İstanbul', '05322223344', '905322223344', 750, 'Kapalı saha, iklimlendirme, tribün. 6v6 ve 7v7 maçlara uygun.', true),
    ('de200000-0000-0000-0000-000000000003', v_saha, 'Sahil Halı Saha', 'İstanbul', 'Maltepe', 'Sahil Yolu No:8, Maltepe/İstanbul', '05323334455', '905323334455', 500, 'Deniz manzaralı açık saha, gece aydınlatması mevcut.', true)
  on conflict (id) do update set name = excluded.name;

  insert into public.venue_availability (venue_id, day_of_week, start_time, end_time) values
    ('de200000-0000-0000-0000-000000000001', 0, '20:00', '21:00'),
    ('de200000-0000-0000-0000-000000000001', 0, '21:00', '22:00'),
    ('de200000-0000-0000-0000-000000000001', 0, '22:00', '23:00'),
    ('de200000-0000-0000-0000-000000000001', 2, '19:00', '20:00'),
    ('de200000-0000-0000-0000-000000000001', 2, '20:00', '21:00'),
    ('de200000-0000-0000-0000-000000000001', 4, '21:00', '22:00'),
    ('de200000-0000-0000-0000-000000000001', 4, '22:00', '23:00'),
    ('de200000-0000-0000-0000-000000000002', 1, '18:00', '19:00'),
    ('de200000-0000-0000-0000-000000000002', 1, '19:00', '20:00'),
    ('de200000-0000-0000-0000-000000000002', 1, '20:00', '21:00'),
    ('de200000-0000-0000-0000-000000000002', 3, '20:00', '21:00'),
    ('de200000-0000-0000-0000-000000000002', 3, '21:00', '22:00'),
    ('de200000-0000-0000-0000-000000000002', 5, '10:00', '11:00'),
    ('de200000-0000-0000-0000-000000000002', 5, '11:00', '12:00'),
    ('de200000-0000-0000-0000-000000000003', 6, '16:00', '17:00'),
    ('de200000-0000-0000-0000-000000000003', 6, '17:00', '18:00'),
    ('de200000-0000-0000-0000-000000000003', 6, '18:00', '19:00'),
    ('de200000-0000-0000-0000-000000000003', 6, '19:00', '20:00'),
    ('de200000-0000-0000-0000-000000000003', 3, '22:00', '23:00'),
    ('de200000-0000-0000-0000-000000000003', 4, '18:00', '19:00')
  on conflict (venue_id, day_of_week, start_time) do nothing;

  -- ==========================================================================
  -- 11) TAKİP EDİLEN BÖLGELER (v_oyuncu1 için)
  -- ==========================================================================
  insert into public.followed_regions (user_id, city, district) values
    (v_oyuncu1, 'İstanbul', null),
    (v_oyuncu1, 'Ankara', null)
  on conflict (user_id, city, district) do nothing;

  raise notice 'Demo verisi basariyla eklendi.';
end $$;
