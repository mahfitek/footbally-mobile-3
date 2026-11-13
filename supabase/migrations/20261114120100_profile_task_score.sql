-- Profil skoru: tek kaynak, 15 görev, toplam 100 puan.
--
-- Puanlar ve kurallar lib/profileTasks.ts ile aynıdır. Değişiklik yapılırsa iki dosya birlikte güncellenmelidir.
--   name 5, position 5, age 3, height 3, weight 2, city 3, district 2, foot 2, photo 5   (profil alanları)
--   match 8 (maça katılım), apply 5 (fırsata başvuru), premium 7 (ücretli/aktif abonelik)
--   aiCv 15 (ai_cv_text dolu), aiAnalysis 15 (tamamlanmış ai_video_jobs), video 20 (video_urls dolu)
-- Toplam: 100.
--
-- Değişiklikler:
--   * compute_profile_task_breakdown(uid): görev durumlarını hesaplar (iç fonksiyon).
--   * get_my_score_breakdown(): skor ve görev listesini döndürür; yalnızca okur.
--   * refresh_my_score(): skoru yeniden hesaplar, profiles.score'a yazar ve rozet ödüllerini işler.
--     Eski hali yalnızca 9 profil alanına bakıyordu.
-- Ödül fonksiyonu 20261114120000_profile_badge_rewards.sql dosyasındadır; bu dosyadan sonra uygulanmalıdır.

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
    -- Başvurular: olumsuz durumlar (reddedildi, iptal, geri çekildi) sayılmaz. Tabloda onaylı bir durum
    -- (accepted/approved/confirmed) yoktur; bu nedenle olumsuz olmayan her başvuru yeterli kabul edilir.
    jsonb_build_object('id', 'match',    'points', 8, 'done', exists (
        select 1 from public.match_applications m
         where m.user_id = p_user_id and m.match_id is not null
           and lower(coalesce(m.status, '')) not in ('rejected', 'cancelled', 'canceled', 'withdrawn', 'declined'))),
    jsonb_build_object('id', 'apply',    'points', 5, 'done', exists (
        select 1 from public.match_applications m
         where m.user_id = p_user_id and m.opportunity_id is not null
           and lower(coalesce(m.status, '')) not in ('rejected', 'cancelled', 'canceled', 'withdrawn', 'declined'))),
    -- "Premium'a geç": yalnızca gerçek ücretli abonelik. Ödül aboneliği (plan='reward') ve tutarı olmayan
    -- kayıtlar (ör. yönetici hediyesi, amount boş/0) sayılmaz. Apple aboneliği payment_provider='apple' ile sayılır.
    jsonb_build_object('id', 'premium',  'points', 7, 'done', exists (
        select 1 from public.subscriptions s
         where s.user_id = p_user_id
           and lower(s.status) = 'active'
           and (s.expires_at is null or s.expires_at > now())
           and coalesce(s.plan, '') <> 'reward'
           and (coalesce(s.amount, 0) > 0 or s.payment_provider = 'apple'))),
    jsonb_build_object('id', 'aiCv',     'points', 15, 'done', nullif(btrim(p.ai_cv_text), '') is not null),
    jsonb_build_object('id', 'aiAnalysis', 'points', 15, 'done', exists (
        select 1 from public.ai_video_jobs j
         where j.user_id = p_user_id and j.status = 'completed')),
    jsonb_build_object('id', 'video',    'points', 20, 'done', cardinality(p.video_urls) > 0)
  );
end;
$$;

create or replace function public.get_my_score_breakdown()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_tasks jsonb;
  v_score integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  v_tasks := public.compute_profile_task_breakdown(v_uid);

  select coalesce(sum((t->>'points')::integer) filter (where (t->>'done')::boolean), 0)
    into v_score
    from jsonb_array_elements(v_tasks) as t;

  return jsonb_build_object('score', least(greatest(v_score, 0), 100), 'tasks', v_tasks);
end;
$$;

create or replace function public.refresh_my_score()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_breakdown jsonb;
  v_score integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  v_breakdown := public.get_my_score_breakdown();
  v_score := (v_breakdown->>'score')::integer;

  update public.profiles set score = v_score where user_id = v_uid;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  perform public.award_due_profile_badges(v_uid, v_score);

  return v_score;
end;
$$;

revoke all on function public.compute_profile_task_breakdown(uuid) from public, anon, authenticated;
revoke all on function public.get_my_score_breakdown() from public, anon;
grant execute on function public.get_my_score_breakdown() to authenticated;
revoke all on function public.refresh_my_score() from public, anon;
grant execute on function public.refresh_my_score() to authenticated;
