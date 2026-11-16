-- İlan sahibinin başvuruyu reddetmesi, reddedilen başvurunun yeniden kullanılmasının engellenmesi
-- ve başvuruda iki yönlü engel kontrolü.
--
-- Yalnızca ekleme: yeni fonksiyonlar ve bir trigger. Mevcut politikalar ve fonksiyonlar değişmez.
--   * users_blocked_either_way(a, b): iki kullanıcı arasında herhangi bir yönde engel var mı.
--   * reject_match_application(p_application_id): ilan sahibi (matches.creator_id) veya takım sahibi
--     (teams.owner_id). Yalnızca match_id dolu başvurular. Zaten reddedilmişse hata yok, ikinci bildirim yok.
--   * match_applications_guard: (ekleme) reddedilmiş başvuru varsa ya da iki yönlü engel varsa reddeder;
--     (silme) başvuran reddedilmiş başvurusunu silemez.
-- Türkçe metinler E'' kaçışlarıyla yazıldı (yerel psql kodlama sorununa karşı).

create or replace function public.users_blocked_either_way(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_a is not null and p_b is not null and p_a <> p_b and exists (
    select 1 from public.user_blocks b
     where (b.blocker_id = p_a and b.blocked_id = p_b)
        or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

revoke all on function public.users_blocked_either_way(uuid, uuid) from public, anon, authenticated;

create or replace function public.reject_match_application(p_application_id bigint)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.match_applications%rowtype;
  v_match public.matches%rowtype;
  v_is_owner boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform public.assert_personal_account_allowed();

  select * into v_app from public.match_applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;
  if v_app.match_id is null then
    raise exception 'application_not_match' using errcode = '22023';
  end if;

  select * into v_match from public.matches where id = v_app.match_id;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  v_is_owner := v_match.creator_id = v_uid
    or (v_match.team_id is not null and exists (
      select 1 from public.teams t where t.id = v_match.team_id and t.owner_id = v_uid
    ));
  if not v_is_owner then
    raise exception 'not_match_owner' using errcode = '42501';
  end if;

  if v_app.status = 'rejected' then
    return 'already_rejected';
  end if;

  update public.match_applications set status = 'rejected' where id = p_application_id;

  insert into public.notifications (user_id, title, body, read, screen)
  values (
    v_app.user_id,
    E'Ba\u015fvurun reddedildi',
    coalesce(v_match.title, '') || E' ilan\u0131na yapt\u0131\u011f\u0131n ba\u015fvuru reddedildi. Di\u011fer ilanlara g\u00f6z atabilirsin.',
    false,
    'match'
  );

  return 'rejected';
end;
$$;

revoke all on function public.reject_match_application(bigint) from public, anon;
grant execute on function public.reject_match_application(bigint) to authenticated;

-- Başvuru koruması: ekleme (reddedilmiş kayıt ve iki yönlü engel) ve silme (reddedilmiş kayıt).
create or replace function public.match_applications_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_creator uuid;
  v_team_owner uuid;
begin
  if tg_op = 'DELETE' then
    if old.status = 'rejected' and old.user_id = auth.uid() then
      raise exception 'application_rejected' using errcode = '42501';
    end if;
    return old;
  end if;

  if new.match_id is not null then
    if exists (
      select 1 from public.match_applications a
       where a.match_id = new.match_id and a.user_id = new.user_id and a.status = 'rejected'
    ) then
      raise exception 'application_rejected' using errcode = '42501';
    end if;

    select m.creator_id, t.owner_id
      into v_creator, v_team_owner
      from public.matches m
      left join public.teams t on t.id = m.team_id
     where m.id = new.match_id;

    if public.users_blocked_either_way(new.user_id, v_creator)
       or public.users_blocked_either_way(new.user_id, v_team_owner) then
      raise exception 'blocked_interaction' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.match_applications_guard() from public, anon, authenticated;

create trigger match_applications_guard_trg
  before insert or delete on public.match_applications
  for each row execute function public.match_applications_guard();
