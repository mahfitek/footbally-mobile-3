-- Davet sistemi (referral).
--
-- Kurallar:
--   * Her kullanıcının benzersiz 8 karakterlik kodu vardır (büyük harf + rakam; 0, O, 1, I, L yok).
--     Kod sunucuda üretilir (get_or_create_my_referral_code). İstemci kodu değiştiremez.
--   * redeem_referral_code(p_code): yeni kullanıcı kodu kullanır. Kendi kodu, ikinci kullanım, 7 günden eski hesap,
--     kısıtlı hesap ve kısıtlı davet eden geçersizdir. Geçerliyse yeni kullanıcıya hemen 14 gün Premium verilir.
--   * Davet, davet edilen profilini tamamladığında (profiles.profile_completed_at) "geçerli" (qualified_at) olur.
--     Sayaç yalnızca geçerli davetleri sayar.
--   * Davet edenin her 7 geçerli davetinde 30 gün Premium verilir. Her 7'lik grup için bir kez
--     (referrals.referrer_rewarded_batch + benzersiz indeks).
--   * Premium verme şekli rozet ödülüyle aynıdır: subscriptions (plan='referral', status='active', amount=0,
--     currency='TRY'). profiles.is_premium, handle_subscription_change trigger'ı ile güncellenir.
--
-- İstemci bu tablolara doğrudan yazamaz ve okuyamaz (RLS açık, politika yok). Tüm erişim security definer RPC ile.
-- Yalnızca ekleme yapar; mevcut tablo ve fonksiyonların anlamını değiştirmez.

-- 1) Kodlar -------------------------------------------------------------------
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  constraint referral_codes_format_check check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$')
);

alter table public.referral_codes enable row level security;
revoke all on public.referral_codes from public, anon, authenticated;

-- 2) Davetler ---------------------------------------------------------------
create table if not exists public.referrals (
  id bigint generated always as identity primary key,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  qualified_at timestamptz null,
  referrer_rewarded_batch integer null,
  constraint referrals_one_per_invitee unique (referred_id),
  constraint referrals_no_self_invite check (referrer_id <> referred_id),
  constraint referrals_batch_positive check (referrer_rewarded_batch is null or referrer_rewarded_batch >= 1)
);

-- Aynı davet eden için aynı 7'lik grup iki kez ödüllendirilemez (eşzamanlı çağrılarda da).
create unique index if not exists referrals_referrer_batch_key
  on public.referrals (referrer_id, referrer_rewarded_batch)
  where referrer_rewarded_batch is not null;
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;
revoke all on public.referrals from public, anon, authenticated;

-- 3) Kod üretme / alma -----------------------------------------------------------
create or replace function public.get_or_create_my_referral_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_existing text;
  v_candidate text;
  v_inserted integer;
  v_attempt integer;
  v_i integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select code into v_existing from public.referral_codes where user_id = v_uid;
  if found then
    return v_existing;
  end if;

  for v_attempt in 1..20 loop
    v_candidate := '';
    for v_i in 1..8 loop
      v_candidate := v_candidate || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;

    insert into public.referral_codes (user_id, code) values (v_uid, v_candidate)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;

    if v_inserted = 1 then
      return v_candidate;
    end if;

    -- Eşzamanlı bir çağrı kodu zaten yazmış olabilir.
    select code into v_existing from public.referral_codes where user_id = v_uid;
    if found then
      return v_existing;
    end if;
  end loop;

  raise exception 'referral_code_unavailable' using errcode = 'P0001';
end;
$$;

-- 4) Premium hediyesi (rozet ödülüyle aynı biçim) -------------------------------
create or replace function public.grant_referral_premium(p_user_id uuid, p_days integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base timestamp;
begin
  if p_days is null or p_days <= 0 then
    return;
  end if;

  select max(expires_at) into v_base
    from public.subscriptions
   where user_id = p_user_id and lower(status) = 'active';
  v_base := greatest(coalesce(v_base, now()::timestamp), now()::timestamp);

  insert into public.subscriptions (user_id, plan, status, started_at, expires_at, amount, currency)
  values (p_user_id, 'referral', 'active', now(), v_base + make_interval(days => p_days), 0, 'TRY');

  update public.profiles set is_premium = true where user_id = p_user_id;
end;
$$;

-- 5) Geçerli davet (nitelik) ---------------------------------------------------------
-- Yalnızca davet edilen profili tamamlandığında çalışır. Davet eden satırı kilitlenir: eşzamanlı nitelemeler sıralanır.
create or replace function public.qualify_referral_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ref public.referrals%rowtype;
  v_referrer public.profiles%rowtype;
  v_count integer;
  v_progress integer;
  v_batch integer;
  v_restricted boolean;
begin
  select * into v_ref from public.referrals where referred_id = p_user_id for update;
  if not found or v_ref.qualified_at is not null then
    return;
  end if;

  if not exists (
    select 1 from public.profiles
     where user_id = p_user_id and profile_completed_at is not null
  ) then
    return;
  end if;

  select * into v_referrer from public.profiles where user_id = v_ref.referrer_id for update;

  update public.referrals set qualified_at = now() where id = v_ref.id;

  select count(*) into v_count
    from public.referrals
   where referrer_id = v_ref.referrer_id and qualified_at is not null;

  v_progress := ((v_count - 1) % 7) + 1;

  insert into public.notifications (user_id, title, body, read, screen)
  values (
    v_ref.referrer_id,
    'Davet',
    E'Davet etti\u011fin bir kullan\u0131c\u0131 kat\u0131ld\u0131. (' || v_progress || '/7)',
    false,
    'referral'
  );

  if v_count % 7 = 0 then
    v_batch := v_count / 7;

    -- Grup numarası bu davete işlenir. Davet eden kısıtlıysa grup tüketilir ama Premium verilmez
    -- (kısıtlı hesaba ödül verilmez kuralı).
    update public.referrals set referrer_rewarded_batch = v_batch where id = v_ref.id;

    v_restricted := public.account_restriction_active(
      v_referrer.account_status, v_referrer.banned_until, v_referrer.ban_is_permanent
    );

    if not v_restricted then
      perform public.grant_referral_premium(v_ref.referrer_id, 30);
      insert into public.notifications (user_id, title, body, read, screen)
      values (
        v_ref.referrer_id,
        E'Davet \u00f6d\u00fcl\u00fc',
        E'7 ki\u015fi davet ettin. 1 ayl\u0131k Premium hediyen tan\u0131mland\u0131.',
        false,
        'referral'
      );
    end if;
  end if;
end;
$$;

-- 6) Kod kullanma ------------------------------------------------------------------
create or replace function public.redeem_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_profile public.profiles%rowtype;
  v_created timestamptz;
  v_referrer uuid;
  v_referrer_profile public.profiles%rowtype;
  v_inserted integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where user_id = v_uid for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  if public.account_restriction_active(v_profile.account_status, v_profile.banned_until, v_profile.ban_is_permanent) then
    raise exception 'account_restricted' using errcode = '42501';
  end if;

  if exists (select 1 from public.referrals where referred_id = v_uid) then
    raise exception 'referral_already_used' using errcode = 'P0001';
  end if;

  select created_at into v_created from auth.users where id = v_uid;
  v_created := coalesce(v_created, v_profile.created_at::timestamptz, now());
  if now() - v_created > interval '7 days' then
    raise exception 'referral_account_too_old' using errcode = 'P0001';
  end if;

  select rc.user_id into v_referrer from public.referral_codes rc where rc.code = v_code;
  if v_referrer is null then
    raise exception 'referral_invalid_code' using errcode = 'P0001';
  end if;

  if v_referrer = v_uid then
    raise exception 'referral_own_code' using errcode = 'P0001';
  end if;

  select * into v_referrer_profile from public.profiles where user_id = v_referrer;
  -- Kısıtlı davet edenin kodu geçersiz sayılır. Bilgi sızmaması için aynı hata döner.
  if not found
     or public.account_restriction_active(v_referrer_profile.account_status, v_referrer_profile.banned_until, v_referrer_profile.ban_is_permanent) then
    raise exception 'referral_invalid_code' using errcode = 'P0001';
  end if;

  insert into public.referrals (referrer_id, referred_id, code)
  values (v_referrer, v_uid, v_code)
  on conflict (referred_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception 'referral_already_used' using errcode = 'P0001';
  end if;

  perform public.grant_referral_premium(v_uid, 14);

  insert into public.notifications (user_id, title, body, read, screen)
  values (v_uid, 'Davet kodu', E'Davet kodun onayland\u0131. 14 g\u00fcnl\u00fck Premium hediyen tan\u0131mland\u0131.', false, 'referral');

  -- Profil kullanıcı kodu girmeden önce tamamlanmışsa davet hemen geçerli sayılır.
  perform public.qualify_referral_for_user(v_uid);

  return jsonb_build_object('status', 'redeemed', 'premium_days', 14);
end;
$$;

-- 7) Özet (istemci ekranı için) ------------------------------------------------------
create or replace function public.get_my_referral_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_created timestamptz;
  v_code text;
  v_invited integer;
  v_qualified integer;
  v_rewards integer;
  v_redeemed boolean;
  v_restricted boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where user_id = v_uid;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  select created_at into v_created from auth.users where id = v_uid;
  v_created := coalesce(v_created, v_profile.created_at::timestamptz, now());

  select code into v_code from public.referral_codes where user_id = v_uid;
  select count(*) into v_invited from public.referrals where referrer_id = v_uid;
  select count(*) into v_qualified from public.referrals where referrer_id = v_uid and qualified_at is not null;
  select count(*) into v_rewards from public.referrals where referrer_id = v_uid and referrer_rewarded_batch is not null;
  v_redeemed := exists (select 1 from public.referrals where referred_id = v_uid);
  v_restricted := public.account_restriction_active(v_profile.account_status, v_profile.banned_until, v_profile.ban_is_permanent);

  return jsonb_build_object(
    'code', v_code,
    'invited_count', v_invited,
    'qualified_count', v_qualified,
    'progress', v_qualified % 7,
    'target', 7,
    'reward_months_total', v_rewards,
    'redeemed', v_redeemed,
    'can_redeem', (not v_redeemed and not v_restricted and now() - v_created <= interval '7 days')
  );
end;
$$;

-- 8) Profil tamamlanınca niteleme trigger'ı -------------------------------------------
create or replace function public.referrals_on_profile_completed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.qualify_referral_for_user(new.user_id);
  return new;
end;
$$;

revoke all on function public.referrals_on_profile_completed() from public, anon, authenticated;

create trigger profiles_referral_qualify
  after update of profile_completed_at on public.profiles
  for each row
  when (old.profile_completed_at is null and new.profile_completed_at is not null)
  execute function public.referrals_on_profile_completed();

-- 9) Yetkiler ----------------------------------------------------------------------------
revoke all on function public.get_or_create_my_referral_code() from public, anon;
grant execute on function public.get_or_create_my_referral_code() to authenticated;

revoke all on function public.redeem_referral_code(text) from public, anon;
grant execute on function public.redeem_referral_code(text) to authenticated;

revoke all on function public.get_my_referral_summary() from public, anon;
grant execute on function public.get_my_referral_summary() to authenticated;

revoke all on function public.grant_referral_premium(uuid, integer) from public, anon, authenticated;
revoke all on function public.qualify_referral_for_user(uuid) from public, anon, authenticated;
