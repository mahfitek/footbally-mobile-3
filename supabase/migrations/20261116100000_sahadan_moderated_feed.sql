-- Sahadan okuma RPC'si: engellenen kişilerin ve yönetici tarafından kaldırılmış medyanın gizlendiği akış.
--
-- DURUM: YAZILDI, UYGULANMADI. Bu migration canlıya uygulanmadan önce mobil uygulama güvenli modda çalışır:
-- RPC yokken yalnızca istemci engel listesiyle süzer, medyayı doğrulayamadığı için ana sayfa önizlemesinde
-- medya mesajlarını gizler (lib/sahadan.ts withoutUnverifiedMedia).
--
-- Yalnızca ekleme: yeni fonksiyon. Tablo, politika ve mevcut fonksiyonlar değişmez.
-- Kaldırılmış medya eşleşmesi: media_moderation.owner_user_id = mesaj sahibi, media_ref = tribun_messages.media_url,
-- moderation_status = 'removed_by_admin' (bkz. 20261114120200_profile_ai_video_cv.sql).

create or replace function public.get_sahadan_messages(p_limit integer default 100)
returns table (
  id uuid,
  sender_id uuid,
  content text,
  media_url text,
  media_type text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id, t.sender_id, t.content, t.media_url, t.media_type, t.created_at
    from public.tribun_messages t
   where auth.uid() is not null
     -- Engel: ben engellediysem ya da beni engellediyse mesaj gizlenir.
     and not exists (
       select 1 from public.user_blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = t.sender_id)
           or (b.blocker_id = t.sender_id and b.blocked_id = auth.uid())
     )
     -- Yönetici tarafından kaldırılmış medya içeren mesaj gizlenir.
     and not exists (
       select 1 from public.media_moderation m
        where t.media_url is not null
          and m.owner_user_id = t.sender_id
          and m.media_ref = t.media_url
          and m.moderation_status = 'removed_by_admin'
     )
   order by t.created_at desc
   limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function public.get_sahadan_messages(integer) from public, anon;
grant execute on function public.get_sahadan_messages(integer) to authenticated;
