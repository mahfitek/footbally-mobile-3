-- Engel ve başvuru testleri için ek iskelet (canlı kolon tanımlarına göre; yalnızca yerel veritabanı).
create table public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  caption text,
  created_at timestamptz not null default now()
);

create table public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint no_self_follow check (follower_id <> followed_id)
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  target_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (requester_id, target_id)
);

create table public.match_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_team_id uuid references public.teams (id),
  opponent_team_id uuid references public.teams (id),
  status text,
  created_at timestamp not null default now()
);

create table public.team_invitations (
  id bigserial primary key,
  team_id uuid references public.teams (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  invited_email text,
  status text,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id bigserial primary key,
  participant_a uuid not null references auth.users (id) on delete cascade,
  participant_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint conversations_distinct_participants check (participant_a <> participant_b)
);

create table public.messages (
  id bigserial primary key,
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  body text,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

create table public.scout_conversations (
  id bigserial primary key,
  scout_user_id uuid not null references auth.users (id) on delete cascade,
  recipient_user_id uuid references auth.users (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  constraint scout_conversations_target_type_check check (target_type in ('player', 'team')),
  unique (scout_user_id, target_type, target_id)
);

create table public.scout_messages (
  id bigserial primary key,
  conversation_id bigint not null references public.scout_conversations (id) on delete cascade,
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  body text,
  created_at timestamptz not null default now()
);

-- Canlı tanımıyla aynı (yalnızca okuma/karşılaştırma için; değiştirilmedi).
create or replace function public.enforce_message_block()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_other uuid;
begin
  select case when c.participant_a = new.sender_user_id then c.participant_b else c.participant_a end
    into v_other
    from public.conversations c where c.id = new.conversation_id;
  if v_other is not null and exists (
    select 1 from public.user_blocks b
     where (b.blocker_id = v_other and b.blocked_id = new.sender_user_id)
        or (b.blocker_id = new.sender_user_id and b.blocked_id = v_other)
  ) then
    raise exception 'blocked_user' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger messages_enforce_block before insert on public.messages
  for each row execute function public.enforce_message_block();

-- Canlıdaki scout alıcı çözümü (resolve_recipient) ile aynı kural.
create or replace function public.scout_conversations_resolve_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_recipient uuid;
begin
  if new.target_type = 'player' then
    select user_id into v_recipient from public.profiles where user_id = new.target_id;
  else
    select owner_id into v_recipient from public.teams where id = new.target_id;
  end if;
  if v_recipient is null then
    raise exception 'target % % not found', new.target_type, new.target_id;
  end if;
  new.recipient_user_id = v_recipient;
  return new;
end;
$$;

create trigger resolve_recipient before insert on public.scout_conversations
  for each row execute function public.scout_conversations_resolve_recipient();

-- Canlıdaki başvuru kısıtı (match_id, user_id) benzersiz.
alter table public.match_applications add constraint match_applications_match_id_user_id_key unique (match_id, user_id);

grant all on all tables in schema public to authenticated, anon;
