-- ============================================================================
-- FOOTBALLY — TANITIM (DEMO) VERİSİNİ TEMİZLEME
-- ============================================================================
-- supabase/demo_seed.sql ile eklenen HER ŞEYİ geri alır. Ödeme entegrasyonu
-- ve şirketleşme tamamlanıp uygulama gerçek kullanıcılara açılmaya hazır
-- olduğunda bu script'i çalıştır.
--
-- ÇALIŞTIRMADAN ÖNCE: demo_seed.sql'de kullandığın 4 hero UID'yi (v_oyuncu1,
-- v_oyuncu2, v_takim, v_saha) aşağıdaki declare bloğuna aynı şekilde yapıştır.
-- Bu script hero HESAPLARIN KENDİSİNİ (auth.users) SİLMEZ, sadece onlara ait
-- seed edilmiş verileri (profil, takım, maç, mesaj, bildirim, saha vb.) siler
-- — hesapları tamamen silmek istersen Dashboard'dan Authentication → Users
-- üzerinden elle sil.
-- ============================================================================

do $$
declare
  v_oyuncu1 uuid := 'HERO_OYUNCU1_UID_BURAYA';
  v_oyuncu2 uuid := 'HERO_OYUNCU2_UID_BURAYA';
  v_takim   uuid := 'HERO_TAKIM_UID_BURAYA';
  v_saha    uuid := 'HERO_SAHA_UID_BURAYA';
begin
  if v_oyuncu1::text = 'HERO_OYUNCU1_UID_BURAYA' then
    raise exception 'Once dosyanin ustundeki 4 UID placeholderini gercek degerlerle degistir.';
  end if;

  -- Hero hesaplara ait seed edilmiş veriler
  delete from public.venue_availability where venue_id in (
    'de200000-0000-0000-0000-000000000001',
    'de200000-0000-0000-0000-000000000002',
    'de200000-0000-0000-0000-000000000003'
  );
  delete from public.venues where id like 'de200000-%' or owner_user_id = v_saha;
  delete from public.followed_regions where user_id = v_oyuncu1;
  delete from public.connections where v_oyuncu1 in (requester_id, target_id) or v_oyuncu2 in (requester_id, target_id);
  delete from public.tribun_messages where sender_id in (v_oyuncu1, v_oyuncu2, v_takim);
  delete from public.notifications where user_id = v_oyuncu1;
  delete from public.messages where v_oyuncu1 in (sender_id, receiver_id) or v_oyuncu2 in (sender_id, receiver_id);
  delete from public.matches where creator_id in (v_oyuncu1, v_oyuncu2, v_takim);
  delete from public.teams where owner_id = v_takim;
  delete from public.profiles where user_id in (v_oyuncu1, v_oyuncu2, v_takim, v_saha);

  -- Figüran hesaplara ait her şey (dependent tablolar önce)
  delete from public.venue_availability where venue_id in (select id from public.venues where owner_user_id::text like 'de%');
  delete from public.venues where owner_user_id::text like 'de%';
  delete from public.followed_regions where user_id::text like 'de%';
  delete from public.connections where requester_id::text like 'de%' or target_id::text like 'de%';
  delete from public.tribun_messages where sender_id::text like 'de%';
  delete from public.notifications where user_id::text like 'de%';
  delete from public.messages where sender_id::text like 'de%' or receiver_id::text like 'de%';
  delete from public.matches where creator_id::text like 'de%';
  delete from public.teams where owner_id::text like 'de%';
  delete from public.opportunities where id::text like 'de300000-%';
  delete from public.profiles where user_id::text like 'de%';

  -- Figüran auth kullanıcıları (hero hesaplar HARİÇ — onlar silinmiyor)
  delete from auth.users where id::text like 'de000000-%' or id::text like 'de100000-%';

  raise notice 'Demo verisi tamamen temizlendi.';
end $$;
