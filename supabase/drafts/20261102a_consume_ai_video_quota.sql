-- TASLAK, UYGULANMADI. Canlı veritabanına yalnızca kullanıcı onayından sonra uygulanır.
-- Resmî migration web repoda tutulur (footbally-unified-account/supabase/migrations); bu dosya referans içindir.
--
-- Amaç: analyze-video saatlik limitini atomik yapmak (check-then-insert yarışını kapatmak).
-- Yeni tablo açılmaz; ai_video_jobs kullanılır.
--
-- Akış:
--   1) Kullanıcı başına transaction-level advisory lock alınır (eşzamanlı istekler sıraya girer).
--   2) Son p_window içindeki, 'failed' olmayan satırlar sayılır.
--   3) Sayı p_limit'e ulaşmışsa NULL döner (çağıran 'limit' yanıtı verir).
--   4) Değilse 'reserved' durumunda satır eklenir ve id döner. Edge function analiz sonunda
--      satırı 'completed' yapar; geçersiz görüntü veya hata durumunda 'failed' yapar (limite sayılmaz).
--
-- Notlar:
--   - created_at 'timestamp without time zone' ve mevcut kodda UTC duvar saati olarak yazılıyor.
--     Bu yüzden hem ekleme hem karşılaştırma (now() at time zone 'utc') ile yapılır.
--   - Edge function çökerse 'reserved' satır kalabilir; en fazla p_window kadar limite sayılır, sonra düşer.

create or replace function public.consume_ai_video_quota(
  p_limit integer default 3,
  p_window interval default interval '1 hour'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_now timestamp := (now() at time zone 'utc');
  v_count integer;
  v_job uuid;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select count(*) into v_count
    from public.ai_video_jobs
   where user_id = v_user
     and created_at >= v_now - p_window
     and status is distinct from 'failed';

  if v_count >= p_limit then
    return null;
  end if;

  insert into public.ai_video_jobs (user_id, status, created_at, updated_at)
  values (v_user, 'reserved', v_now, v_now)
  returning id into v_job;

  return v_job;
end;
$$;

revoke all on function public.consume_ai_video_quota(integer, interval) from public, anon;
grant execute on function public.consume_ai_video_quota(integer, interval) to authenticated;
