-- Player photo gallery: each row points at a photo stored in the private
-- 'videos' storage bucket, under "<user_id>/gallery/<filename>" so the
-- existing per-user storage RLS (see lib/balance_migration.sql) already
-- scopes read/write access correctly without any bucket changes.
create table if not exists public.player_gallery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.player_gallery enable row level security;

drop policy if exists "Users can view own gallery" on public.player_gallery;
create policy "Users can view own gallery" on public.player_gallery for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own gallery" on public.player_gallery;
create policy "Users can insert own gallery" on public.player_gallery for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own gallery" on public.player_gallery;
create policy "Users can delete own gallery" on public.player_gallery for delete using (auth.uid() = user_id);
