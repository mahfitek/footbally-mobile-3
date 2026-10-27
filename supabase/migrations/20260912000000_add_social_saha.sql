-- Sosyal Saha: posts, follows, likes, comments + premium/follow-count sync.
-- Paste this whole file into the Supabase SQL Editor and run it once.

-- ---------------------------------------------------------------------------
-- profiles: new columns
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists is_premium boolean not null default false;
alter table public.profiles add column if not exists followers_count integer not null default 0;
alter table public.profiles add column if not exists following_count integer not null default 0;

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_type text not null check (post_type in ('photo', 'video', 'match_video')),
  media_url text,
  youtube_video_id text,
  venue_name text,
  match_date date,
  caption text,
  highlight_start_sec integer,
  highlight_end_sec integer,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_id_idx on public.posts (user_id);

alter table public.posts enable row level security;

drop policy if exists "Posts are publicly readable" on public.posts;
create policy "Posts are publicly readable" on public.posts for select using (true);

drop policy if exists "Users can insert own posts" on public.posts;
create policy "Users can insert own posts" on public.posts for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts" on public.posts for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists "Follows are publicly readable" on public.follows;
create policy "Follows are publicly readable" on public.follows for select using (true);

drop policy if exists "Users can follow as themselves" on public.follows;
create policy "Users can follow as themselves" on public.follows for insert with check (auth.uid() = follower_id);

drop policy if exists "Users can unfollow as themselves" on public.follows;
create policy "Users can unfollow as themselves" on public.follows for delete using (auth.uid() = follower_id);

-- ---------------------------------------------------------------------------
-- post_likes
-- ---------------------------------------------------------------------------
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_post_id_idx on public.post_likes (post_id);

alter table public.post_likes enable row level security;

drop policy if exists "Post likes are publicly readable" on public.post_likes;
create policy "Post likes are publicly readable" on public.post_likes for select using (true);

drop policy if exists "Users can like as themselves" on public.post_likes;
create policy "Users can like as themselves" on public.post_likes for insert with check (auth.uid() = user_id);

drop policy if exists "Users can unlike as themselves" on public.post_likes;
create policy "Users can unlike as themselves" on public.post_likes for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- post_comments
-- ---------------------------------------------------------------------------
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_id_idx on public.post_comments (post_id);

alter table public.post_comments enable row level security;

drop policy if exists "Post comments are publicly readable" on public.post_comments;
create policy "Post comments are publicly readable" on public.post_comments for select using (true);

drop policy if exists "Users can comment as themselves" on public.post_comments;
create policy "Users can comment as themselves" on public.post_comments for insert with check (auth.uid() = user_id);

-- Comment author OR the post owner (cleaning up unwanted comments) can delete.
drop policy if exists "Comment author or post owner can delete" on public.post_comments;
create policy "Comment author or post owner can delete" on public.post_comments for delete using (
  auth.uid() = user_id
  or auth.uid() = (select p.user_id from public.posts p where p.id = post_comments.post_id)
);

-- ---------------------------------------------------------------------------
-- Count triggers (likes_count, comments_count, followers_count, following_count)
-- ---------------------------------------------------------------------------
create or replace function public.social_saha_adjust_post_likes_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists post_likes_count_trigger on public.post_likes;
create trigger post_likes_count_trigger
  after insert or delete on public.post_likes
  for each row execute function public.social_saha_adjust_post_likes_count();

create or replace function public.social_saha_adjust_post_comments_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists post_comments_count_trigger on public.post_comments;
create trigger post_comments_count_trigger
  after insert or delete on public.post_comments
  for each row execute function public.social_saha_adjust_post_comments_count();

create or replace function public.social_saha_adjust_follow_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where user_id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where user_id = new.following_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles set following_count = greatest(following_count - 1, 0) where user_id = old.follower_id;
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where user_id = old.following_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists follows_count_trigger on public.follows;
create trigger follows_count_trigger
  after insert or delete on public.follows
  for each row execute function public.social_saha_adjust_follow_counts();

-- ---------------------------------------------------------------------------
-- profiles.is_premium sync from auth.users.raw_user_meta_data
-- (app writes { premium: true, premium_until } via supabase.auth.updateUser,
--  e.g. screens/PremiumScreen.tsx — this trigger mirrors that into profiles
--  so other users' premium status can be read client-side for the feed.
--  Note: this only re-evaluates on a metadata write, so a premium period
--  that lapses with no further auth.users update won't flip is_premium
--  back to false until the next metadata change.)
-- ---------------------------------------------------------------------------
create or replace function public.social_saha_sync_profile_premium()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_prem boolean;
begin
  is_prem := coalesce((new.raw_user_meta_data->>'premium')::boolean, false)
    and (
      new.raw_user_meta_data->>'premium_until' is null
      or (new.raw_user_meta_data->>'premium_until')::timestamptz > now()
    );
  update public.profiles set is_premium = is_prem where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_premium_updated on auth.users;
create trigger on_auth_user_premium_updated
  after update of raw_user_meta_data on auth.users
  for each row execute function public.social_saha_sync_profile_premium();

-- Backfill is_premium for existing users from their current metadata.
update public.profiles p
set is_premium = coalesce((u.raw_user_meta_data->>'premium')::boolean, false)
  and (
    u.raw_user_meta_data->>'premium_until' is null
    or (u.raw_user_meta_data->>'premium_until')::timestamptz > now()
  )
from auth.users u
where u.id = p.user_id;

-- ---------------------------------------------------------------------------
-- Storage bucket for post media
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('posts-media', 'posts-media', true)
on conflict (id) do nothing;

drop policy if exists "Post media is publicly readable" on storage.objects;
create policy "Post media is publicly readable" on storage.objects for select using (bucket_id = 'posts-media');

drop policy if exists "Users can upload own post media" on storage.objects;
create policy "Users can upload own post media" on storage.objects for insert with check (
  bucket_id = 'posts-media' and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own post media" on storage.objects;
create policy "Users can delete own post media" on storage.objects for delete using (
  bucket_id = 'posts-media' and auth.uid()::text = (storage.foldername(name))[1]
);
