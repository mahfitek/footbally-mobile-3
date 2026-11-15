-- Premium'a geç görevi: davet ödülü (plan='referral') aboneliği de sayılmaz.
--
-- Bu dosya YALNIZCA compute_profile_task_breakdown fonksiyonunu yeniden tanımlar.
-- Gövde, 2026-11-15 tarihinde canlı veritabanından alındı (repodaki 20261114120100 dosyası canlıdan farklı,
-- canlı gövde esas alındı). Tek değişiklik premium koşulundadır:
--   lower(plan) <> 'reward'  ->  lower(plan) not in ('reward', 'referral')
-- Puanlar lib/profileTasks.ts ile birlikte güncel tutulur (countsAsPaidPremium).

create or replace function public.compute_profile_task_breakdown(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  p public.profiles%rowtype;
begin
  select * into p from public.profiles where user_id = p_user_id;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_array(
    jsonb_build_object('id', 'name',     'points', 5, 'done', nullif(btrim(p.full_name), '') is not null),
    jsonb_build_object('id', 'position', 'points', 5, 'done', nullif(btrim(p."position"), '') is not null),
    jsonb_build_object('id', 'age',      'points', 3, 'done', p.age is not null),
    jsonb_build_object('id', 'height',   'points', 3, 'done', p.height is not null),
    jsonb_build_object('id', 'weight',   'points', 2, 'done', p.weight is not null),
    jsonb_build_object('id', 'city',     'points', 3, 'done', nullif(btrim(p.city), '') is not null),
    jsonb_build_object('id', 'district', 'points', 2, 'done', nullif(btrim(p.district), '') is not null),
    jsonb_build_object('id', 'foot',     'points', 2, 'done', nullif(btrim(p.foot), '') is not null),
    jsonb_build_object('id', 'photo',    'points', 5, 'done', nullif(btrim(p.avatar_url), '') is not null),
    -- Başvurular: olumsuz durumlar (reddedildi, iptal, geri çekildi) sayılmaz.
    jsonb_build_object('id', 'match',    'points', 8, 'done', exists (
        select 1 from public.match_applications m
         where m.user_id = p_user_id and m.match_id is not null
           and lower(coalesce(m.status, '')) not in ('rejected', 'cancelled', 'canceled', 'withdrawn', 'declined'))),
    jsonb_build_object('id', 'apply',    'points', 5, 'done', exists (
        select 1 from public.match_applications m
         where m.user_id = p_user_id and m.opportunity_id is not null
           and lower(coalesce(m.status, '')) not in ('rejected', 'cancelled', 'canceled', 'withdrawn', 'declined'))),
    -- "Premium'a geç": ücretli abonelik, Apple aboneliği ya da yönetici hediyesi (plan='admin').
    -- Rozet ödülü (plan='reward') ve davet ödülü (plan='referral') aboneliği sayılmaz.
    jsonb_build_object('id', 'premium',  'points', 7, 'done', exists (
        select 1 from public.subscriptions s
         where s.user_id = p_user_id
           and lower(s.status) = 'active'
           and (s.expires_at is null or s.expires_at > now())
           and lower(coalesce(s.plan, '')) not in ('reward', 'referral')
           and (coalesce(s.amount, 0) > 0 or s.payment_provider = 'apple' or lower(coalesce(s.plan, '')) = 'admin'))),
    jsonb_build_object('id', 'aiCv',     'points', 15, 'done', nullif(btrim(p.ai_cv_text), '') is not null),
    jsonb_build_object('id', 'aiAnalysis', 'points', 15, 'done', exists (
        select 1 from public.ai_video_jobs j
         where j.user_id = p_user_id and j.status = 'completed')),
    jsonb_build_object('id', 'video',    'points', 20, 'done', cardinality(p.video_urls) > 0)
  );
end;
$$;
