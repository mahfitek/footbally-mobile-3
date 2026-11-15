-- Yerel test iskeleti: canlı şemanın ilgili kısmı (kolonlar ve fonksiyon tanımları canlıdan alındı).
-- Gerçek canlı veritabanına DOKUNMAZ; yalnızca footbally_test yerel veritabanında çalışır.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;
create table auth.users (
  id uuid primary key,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;

create table public.admins (user_id uuid primary key);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  position text,
  age integer,
  height integer,
  weight integer,
  city text,
  district text,
  foot text,
  club text,
  score integer default 0,
  avatar_url text,
  created_at timestamp default now(),
  district_x text,
  ai_cv_text text,
  video_urls text[] not null default '{}',
  photo_urls text[] not null default '{}',
  updated_at timestamptz not null default now(),
  account_status text not null default 'active',
  banned_until timestamptz,
  ban_is_permanent boolean not null default false,
  ban_reason text,
  banned_by uuid,
  banned_at timestamptz,
  claimed_badge_keys text[] not null default '{}',
  reward_premium_days_this_month integer not null default 0,
  reward_premium_month_key text,
  is_premium boolean not null default false,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  overall_rating integer,
  stat_hiz integer, stat_sut integer, stat_pas integer, stat_dribbling integer,
  stat_savunma integer, stat_dayaniklilik integer, stats_updated_at timestamptz,
  profile_completed_at timestamptz,
  profile_completion_source text
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  plan text default 'monthly',
  status text default 'active',
  started_at timestamp default now(),
  expires_at timestamp,
  amount numeric default 299,
  currency text default 'TRY',
  created_at timestamp default now(),
  payment_provider text,
  provider_transaction_id text
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text, body text, read boolean default false, screen text,
  created_at timestamp default now()
);

create table public.ai_video_jobs (id bigserial primary key, user_id uuid, status text);
create table public.match_applications (
  id bigserial primary key, match_id bigint, user_id uuid, status text default 'pending',
  created_at timestamptz default now(), opportunity_id text
);
create table public.teams (id uuid primary key default gen_random_uuid(), owner_id uuid, name text not null);
create table public.team_members (
  id uuid primary key default gen_random_uuid(), team_id uuid, user_id uuid,
  role text default 'player', position text, jersey_number integer, joined_at timestamp default now()
);
create table public.matches (
  id bigserial primary key,
  title text, date date, time time, location text, city text, district text, type text,
  description text,
  required_players integer not null default 1,
  team_payment numeric not null default 0,
  travel_covered boolean not null default false,
  food_covered boolean not null default false,
  needed_positions text[] not null default '{}',
  creator_id uuid not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  category text default 'Eğlence',
  team_id uuid
);

-- Canlı tanımlar (pg_get_functiondef ile alındı, 2026-11-15).
CREATE OR REPLACE FUNCTION public.account_restriction_active(p_status text, p_banned_until timestamp with time zone, p_ban_is_permanent boolean)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(p_status = 'inactive', false)
      or coalesce(
           p_status = 'banned'
           and (coalesce(p_ban_is_permanent, false) or p_banned_until is null or p_banned_until > now()),
           false);
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_is_premium(p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update profiles
  set is_premium = exists (
    select 1 from subscriptions
    where subscriptions.user_id = p_user_id
      and lower(subscriptions.status) = 'active'
      and (subscriptions.expires_at is null or subscriptions.expires_at > now())
  )
  where user_id = p_user_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_subscription_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if (tg_op = 'DELETE') then
    perform sync_profile_is_premium(old.user_id);
    return old;
  else
    perform sync_profile_is_premium(new.user_id);
    return new;
  end if;
end;
$function$;

create trigger on_subscription_change after insert or delete or update on public.subscriptions
  for each row execute function public.handle_subscription_change();

CREATE OR REPLACE FUNCTION public.assert_personal_account_allowed()
 RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.profiles p
     where p.user_id = auth.uid()
       and public.account_restriction_active(p.account_status, p.banned_until, p.ban_is_permanent)
  ) then
    raise exception 'account_restricted' using errcode = '42501';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_profile_trusted_columns()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if auth.uid() is not null then
    if exists (select 1 from public.admins a where a.user_id = auth.uid()) then
      return new;
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.is_premium                     := false;
    new.reward_premium_days_this_month := 0;
    new.claimed_badge_keys             := '{}';
    new.reward_premium_month_key       := null;
    new.account_status                 := 'active';
    new.banned_until                   := null;
    new.ban_is_permanent               := false;
    new.ban_reason                     := null;
    new.banned_by                      := null;
    new.banned_at                      := null;
    new.overall_rating                 := null;
    new.followers_count                := 0;
    new.following_count                := 0;
    new.score                          := 0;
    new.stat_hiz                       := null;
    new.stat_sut                       := null;
    new.stat_pas                       := null;
    new.stat_dribbling                 := null;
    new.stat_savunma                   := null;
    new.stat_dayaniklilik              := null;
    new.stats_updated_at               := null;
    new.profile_completed_at           := null;
    new.profile_completion_source      := null;
    return new;
  end if;

  if old.account_status = 'inactive'
     or (old.account_status = 'banned'
         and (coalesce(old.ban_is_permanent, false) or old.banned_until is null or old.banned_until > now())) then
    raise exception 'account_restricted' using errcode = '42501';
  end if;

  if new.is_premium                     is distinct from old.is_premium
     or new.reward_premium_days_this_month is distinct from old.reward_premium_days_this_month
     or new.claimed_badge_keys             is distinct from old.claimed_badge_keys
     or new.reward_premium_month_key       is distinct from old.reward_premium_month_key
     or new.account_status                 is distinct from old.account_status
     or new.banned_until                   is distinct from old.banned_until
     or new.ban_is_permanent               is distinct from old.ban_is_permanent
     or new.ban_reason                     is distinct from old.ban_reason
     or new.banned_by                      is distinct from old.banned_by
     or new.banned_at                      is distinct from old.banned_at
     or new.overall_rating                 is distinct from old.overall_rating
     or new.followers_count                is distinct from old.followers_count
     or new.following_count                is distinct from old.following_count
     or new.score                          is distinct from old.score
     or new.stat_hiz                       is distinct from old.stat_hiz
     or new.stat_sut                       is distinct from old.stat_sut
     or new.stat_pas                       is distinct from old.stat_pas
     or new.stat_dribbling                 is distinct from old.stat_dribbling
     or new.stat_savunma                   is distinct from old.stat_savunma
     or new.stat_dayaniklilik              is distinct from old.stat_dayaniklilik
     or new.stats_updated_at               is distinct from old.stats_updated_at
     or new.profile_completed_at           is distinct from old.profile_completed_at
     or new.profile_completion_source      is distinct from old.profile_completion_source then
    raise exception 'protected_profile_column' using errcode = '42501';
  end if;

  return new;
end;
$function$;

create trigger profiles_protect_trusted_columns before insert or update on public.profiles
  for each row execute function public.protect_profile_trusted_columns();

CREATE OR REPLACE FUNCTION public.complete_my_player_profile()
 RETURNS timestamp with time zone LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles%rowtype;
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.assert_personal_account_allowed();
  select * into v_p from public.profiles p where p.user_id = v_uid for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;
  if v_p.profile_completed_at is not null then
    return v_p.profile_completed_at;
  end if;
  if nullif(btrim(v_p.full_name), '') is null
     or nullif(btrim(v_p."position"), '') is null
     or nullif(btrim(v_p.city), '') is null
     or nullif(btrim(v_p.district), '') is null
     or nullif(btrim(v_p.foot), '') is null
     or v_p.age is null or v_p.height is null or v_p.weight is null then
    raise exception 'profile_incomplete' using errcode = '22023';
  end if;
  if v_p."position" not in ('Kaleci', 'Defans', 'Orta Saha', 'Kanat', 'Forvet')
     or v_p.foot not in (E'Sa\u011f', 'Sol', E'Her \u0130kisi') then
    raise exception 'profile_invalid_value' using errcode = '22023';
  end if;
  if v_p.age not between 10 and 80 or v_p.height not between 100 and 250 or v_p.weight not between 30 and 250 then
    raise exception 'profile_invalid_value' using errcode = '22023';
  end if;
  update public.profiles
     set profile_completed_at = now(),
         profile_completion_source = 'form'
   where user_id = v_uid
  returning profile_completed_at into v_at;
  return v_at;
end;
$function$;

grant select, insert, update, delete on all tables in schema public to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;
