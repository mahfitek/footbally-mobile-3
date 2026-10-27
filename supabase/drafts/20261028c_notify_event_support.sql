-- =====================================================================
-- notify-event Edge Function için destek tabloları.
-- DURUM: TASLAK. Canlı Supabase'e UYGULANMADI.
-- Bu dosya supabase/migrations dışındadır; `supabase db push` ile otomatik uygulanmaz.
--
-- Yayın sırası:
--   1) Bu dosya (yalnızca eklemeli: yeni iki tablo).
--   2) supabase/functions/notify-event deploy (ayrı onayla).
--   3) Mobil yayın: lib/notify.ts artık notify-event'i çağırır, eski push yolunu kullanmaz.
--
-- Tablolar yalnızca service_role tarafından okunur/yazılır (Edge Function).
-- anon ve authenticated için hiçbir politika yoktur ve yetki verilmez.
-- =====================================================================

-- Her teslim denemesi için tek satır. Hem idempotency (dedupe_key benzersiz) hem hız sınırı
-- (actor_id + created_at üzerinden son dakika/son saat sayımı) için kullanılır.
create table if not exists public.notification_events (
  id           bigint generated always as identity primary key,
  dedupe_key   text not null unique,
  kind         text not null,
  actor_id     uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null,
  created_at   timestamptz not null default now()
);

create index if not exists notification_events_actor_created_idx
  on public.notification_events (actor_id, created_at desc);

-- Başarısız teslimatlar (in-app ekleme, push, token). Yeniden deneme veya izleme için.
create table if not exists public.notification_failures (
  id           bigint generated always as identity primary key,
  dedupe_key   text,
  recipient_id uuid,
  stage        text not null,
  error        text,
  created_at   timestamptz not null default now()
);

alter table public.notification_events enable row level security;
alter table public.notification_failures enable row level security;

revoke all on public.notification_events from anon, authenticated;
revoke all on public.notification_failures from anon, authenticated;

-- TODO (ayrı karar): notification_events büyür. Örn. 30 günden eski satırları silen bir temizlik işi ekleyin.
-- Hız sınırı yalnızca son saate baktığı için bu silme güvenlidir.

-- =====================================================================
-- AYRI KARAR GEREKTİREN ADIM (uygulanmadı):
-- Canlıda `notify_user(p_user_id uuid, p_title text, p_body text, p_screen text)` RPC'si var.
-- Herhangi bir oturum açmış kullanıcı bunu çağırarak başka birine keyfi bildirim yazabilir.
-- Mobil istemci artık çağırmıyor. Ancak getfootbally.com tarafının kullandığı doğrulanmadan
-- yetkiyi kaldırmayın. Doğrulandıktan sonra aşağıdaki blok uygulanabilir:
--
-- do $$
-- declare r record;
-- begin
--   for r in
--     select p.oid::regprocedure as sig
--     from pg_proc p
--     where p.proname = 'notify_user' and p.pronamespace = 'public'::regnamespace
--   loop
--     execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
--   end loop;
-- end $$;
--
-- GERİ ALMA: ilgili fonksiyon için `grant execute ... to authenticated;` (yalnızca bilinçli kabulle).
-- =====================================================================
