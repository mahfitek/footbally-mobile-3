-- Tribün: a single public room where every player and team account can
-- post text and/or a photo/video. Membership isn't modeled — any
-- authenticated user may read and post; sender identity (player vs team)
-- is resolved client-side from profiles/teams, same as the ban-lookup
-- fallback in lib/accountAccess.ts. Media files reuse the existing public
-- 'avatars' storage bucket under "<user_id>/tribun/<filename>", so the
-- per-user storage RLS in lib/balance_migration.sql already covers it.
create table if not exists public.tribun_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz not null default now(),
  constraint tribun_messages_content_length check (content is null or char_length(content) <= 500),
  constraint tribun_messages_has_content_or_media check (
    (media_url is not null) or (content is not null and char_length(trim(content)) > 0)
  ),
  constraint tribun_messages_media_type_requires_media check (
    (media_type is null) = (media_url is null)
  )
);

create index if not exists tribun_messages_created_at_idx
  on public.tribun_messages (created_at);

alter table public.tribun_messages enable row level security;

drop policy if exists "Authenticated users can read tribun" on public.tribun_messages;
create policy "Authenticated users can read tribun" on public.tribun_messages
  for select using (auth.role() = 'authenticated');

drop policy if exists "Users can post their own tribun messages" on public.tribun_messages;
create policy "Users can post their own tribun messages" on public.tribun_messages
  for insert with check (auth.uid() = sender_id);

drop policy if exists "Users can delete their own tribun messages" on public.tribun_messages;
create policy "Users can delete their own tribun messages" on public.tribun_messages
  for delete using (auth.uid() = sender_id);

-- Realtime: enable Replication for public.tribun_messages in the Supabase
-- dashboard (Database > Replication) the same way it was enabled for
-- public.messages, so TribunScreen's postgres_changes subscription
-- receives new rows live.
