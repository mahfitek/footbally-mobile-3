-- get_my_blocked_users: list of users the caller has blocked (Settings > Engellenen Kullanıcılar).
-- Additive only: a new function; tables, policies and existing functions are not changed.
--
-- Security:
--   * Returns only rows where blocker_id = auth.uid(); anonymous callers get no rows.
--   * Name, avatar and team name come from profiles/teams, which the caller may not be able to
--     read for restricted or deleted accounts. For those rows the fields are returned as NULL and
--     the client shows the neutral "Kullanıcı" label, so restricted identities are not exposed.
--   * Execute is granted to authenticated only (same as block_user / unblock_user).

create or replace function public.get_my_blocked_users()
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  team_name text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.blocked_id as user_id,
    case when v.visible then p.full_name end as full_name,
    case when v.visible then p.avatar_url end as avatar_url,
    case when v.visible then tm.name end as team_name,
    b.created_at as blocked_at
  from public.user_blocks b
  left join public.profiles p on p.user_id = b.blocked_id
  cross join lateral (
    select p.user_id is not null
           and not coalesce(
             public.account_restriction_active(p.account_status, p.banned_until, p.ban_is_permanent),
             false
           ) as visible
  ) v
  left join lateral (
    select t.name
      from public.teams t
     where t.owner_id = b.blocked_id
       and t.archived_at is null
     order by t.created_at desc nulls last, t.id
     limit 1
  ) tm on true
  where b.blocker_id = auth.uid()
  order by b.created_at desc, b.blocked_id;
$$;

revoke all on function public.get_my_blocked_users() from public;
revoke all on function public.get_my_blocked_users() from anon;
grant execute on function public.get_my_blocked_users() to authenticated;
