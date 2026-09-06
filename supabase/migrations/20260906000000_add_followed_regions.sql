-- Kullanıcının takip ettiği şehir/ilçe bölgeleri ("Bölgelerim").
-- Her satır bir kullanıcının bir bölgeyi takibe aldığını temsil eder;
-- district null ise tüm şehir takip ediliyor demektir.
create table if not exists public.followed_regions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  city text not null,
  district text,
  created_at timestamptz not null default now(),
  unique (user_id, city, district)
);

create index if not exists followed_regions_user_id_idx on public.followed_regions(user_id);

alter table public.followed_regions enable row level security;

drop policy if exists "Users can view own followed regions" on public.followed_regions;
create policy "Users can view own followed regions" on public.followed_regions for select using (auth.uid() = user_id);

drop policy if exists "Users can follow a region" on public.followed_regions;
create policy "Users can follow a region" on public.followed_regions for insert with check (auth.uid() = user_id);

drop policy if exists "Users can unfollow own region" on public.followed_regions;
create policy "Users can unfollow own region" on public.followed_regions for delete using (auth.uid() = user_id);
