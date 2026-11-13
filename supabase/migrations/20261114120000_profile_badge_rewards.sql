-- Otomatik rozet ödülleri (hediye premium günleri).
--
-- Bu fonksiyon istemciden doğrudan çağrılmaz. Yalnızca refresh_my_score() (20261114120100) içinden
-- çalışır; skor yeniden hesaplanıp kaydedildikten sonra kazanılmış rozetleri işler.
--
-- Her rozet için en fazla bir kez:
--   1) profiles.claimed_badge_keys içine rozet anahtarı eklenir.
--   2) Ay anahtarı (Europe/Istanbul) ve ayın kullanılan gün sayısı güncellenir; ayda en fazla 7 gün verilir.
--   3) Verilen gün kadar subscriptions kaydı eklenir (plan='reward', status='active', amount=0, currency='TRY').
--      expires_at, mevcut en geç aktif aboneliğin bitişine ya da şu ana göre hesaplanır.
--   4) profiles.is_premium = true yapılır.
--   5) notifications tablosuna bildirim eklenir (yalnızca gün verildiyse).
-- Tekrar çalıştırmada claimed_badge_keys kontrolü nedeniyle hiçbir şey iki kez verilmez.
-- Satır kilidi (FOR UPDATE) eşzamanlı çağrılarda çift ödülü önler.

create or replace function public.award_due_profile_badges(p_user_id uuid, p_score integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p public.profiles%rowtype;
  v_month text := to_char(now() at time zone 'Europe/Istanbul', 'YYYY-MM');
  v_used integer;
  v_grant integer;
  v_base timestamp;
  r record;
begin
  select * into v_p from public.profiles where user_id = p_user_id for update;
  if not found then
    return;
  end if;

  -- Kısıtlı hesaba ödül verilmez (pasif ya da etkin yasak). Skor yine de yenilenir.
  if v_p.account_status = 'inactive'
     or (v_p.account_status = 'banned'
         and (coalesce(v_p.ban_is_permanent, false) or v_p.banned_until is null or v_p.banned_until > now())) then
    return;
  end if;

  for r in
    select * from (values
      ('basics',    1, 0,   true),
      ('gelisiyor', 1, 31,  false),
      ('iyi',       2, 61,  false),
      ('elit',      2, 81,  false),
      ('mukemmel',  3, 100, false)
    ) as b(badge_key, reward_days, min_score, is_basics)
  loop
    if r.badge_key = any(v_p.claimed_badge_keys) then
      continue;
    end if;

    if r.is_basics then
      -- "Profilini Tamamladı": pozisyon, şehir ve yaş dolu olmalı.
      if nullif(btrim(v_p.position), '') is null or nullif(btrim(v_p.city), '') is null or v_p.age is null then
        continue;
      end if;
    elsif p_score < r.min_score then
      continue;
    end if;

    v_used := case when v_p.reward_premium_month_key = v_month then v_p.reward_premium_days_this_month else 0 end;
    v_grant := least(r.reward_days, greatest(0, 7 - v_used));

    -- Aylık limit bu rozetin tüm günlerini karşılamıyorsa rozet beklemeye alınır: claimed_badge_keys'e
    -- eklenmez, gün ve bildirim verilmez. Sonraki skor yenilemesinde (ve yeni ayda) tekrar denenir.
    if v_grant < r.reward_days then
      continue;
    end if;

    -- Rozet verildiğinde işaretlenir; böylece aynı rozet bir daha değerlendirilmez.
    update public.profiles
       set claimed_badge_keys = array_append(claimed_badge_keys, r.badge_key),
           reward_premium_month_key = v_month,
           reward_premium_days_this_month = v_used + v_grant
     where user_id = p_user_id;

    -- Sonraki turların kararı için yerel kopya de güncellenir.
    v_p.claimed_badge_keys := array_append(v_p.claimed_badge_keys, r.badge_key);
    v_p.reward_premium_month_key := v_month;
    v_p.reward_premium_days_this_month := v_used + v_grant;

    if v_grant > 0 then
      select max(expires_at) into v_base
        from public.subscriptions
       where user_id = p_user_id and lower(status) = 'active';
      v_base := greatest(coalesce(v_base, now()::timestamp), now()::timestamp);

      insert into public.subscriptions (user_id, plan, status, started_at, expires_at, amount, currency)
      values (p_user_id, 'reward', 'active', now(), v_base + make_interval(days => v_grant), 0, 'TRY');

      update public.profiles set is_premium = true where user_id = p_user_id;

      insert into public.notifications (user_id, title, body, read, screen)
      values (p_user_id, 'Tebrikler', 'Hediye haklarınız tanımlanmıştır.', false, 'badges');
    end if;
  end loop;
end;
$$;

revoke all on function public.award_due_profile_badges(uuid, integer) from public, anon, authenticated;
