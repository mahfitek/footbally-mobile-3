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
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_no_self_follow check (follower_id <> followed_id)
);

create index if not exists follows_followed_id_idx on public.follows (followed_id);

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
    update public.profiles set followers_count = followers_count + 1 where user_id = new.followed_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles set following_count = greatest(following_count - 1, 0) where user_id = old.follower_id;
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where user_id = old.followed_id;
    return old;
  end if;
  return null;
end;
$$;

-- Sayaç trigger'ı YALNIZCA web tarafındaki handle_follow_insert/handle_follow_delete trigger'ları yoksa
-- oluşturulur. Canlıda bu trigger'lar zaten sayaçları tutar; ikisi birden çalışırsa sayılar çift artar.
do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.follows'::regclass and not tgisinternal) then
    create trigger follows_count_trigger
      after insert or delete on public.follows
      for each row execute function public.social_saha_adjust_follow_counts();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- profiles.is_premium: KAYNAK subscriptions'tır (sunucu fonksiyonu sync_profile_is_premium).
-- Eskiden burada auth.users.raw_user_meta_data.premium okunup profiles.is_premium yazılıyordu;
-- kullanıcılar auth.updateUser ile kendi metadata'sını yazabildiği için bu, Premium'un
-- istemciden açılmasına izin veren bir açıktı. Metadata tabanlı trigger ve backfill KALDIRILDI.
-- Mevcut değer (varsayılan false) yalnızca abonelik tablosundan yeniden hesaplanır.
-- ---------------------------------------------------------------------------
update public.profiles p
set is_premium = exists (
  select 1 from public.subscriptions s
  where s.user_id = p.user_id
    and lower(btrim(s.status)) = 'active'
    and (s.expires_at is null or s.expires_at > now())
);

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
