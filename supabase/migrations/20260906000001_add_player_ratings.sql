-- Maç sonrası oyuncu değerlendirmesi (peer rating). Bir kullanıcı, katıldığı bir
-- maçtaki diğer katılımcıları 1-5 arası puanlar. Aynı maç + değerlendiren +
-- değerlendirilen kombinasyonu tekildir; tekrar puanlamak upsert ile günceller.
--
-- NOT: match_id tipi public.matches.id ile aynı olmalı (bu repo'daki migration
-- geçmişinde matches tablosunun oluşturulduğu dosya yok — match_applications
-- tablosundaki kullanımından bigint/identity olduğu varsayılmıştır. Uygulama
-- öncesi matches.id tipini doğrulayın; farklıysa match_id tipini buna göre düzeltin.
create table if not exists public.player_ratings (
  id uuid primary key default gen_random_uuid(),
  match_id bigint not null references public.matches(id) on delete cascade,
  rater_id uuid not null references auth.users(id) on delete cascade,
  rated_user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, rater_id, rated_user_id),
  check (rater_id <> rated_user_id)
);

create index if not exists player_ratings_rated_user_id_idx on public.player_ratings(rated_user_id);

alter table public.player_ratings enable row level security;

drop policy if exists "Users can view ratings about themselves or given by them" on public.player_ratings;
create policy "Users can view ratings about themselves or given by them" on public.player_ratings
  for select using (auth.uid() = rater_id or auth.uid() = rated_user_id);

drop policy if exists "Users can rate other match participants" on public.player_ratings;
create policy "Users can rate other match participants" on public.player_ratings
  for insert with check (auth.uid() = rater_id);

drop policy if exists "Users can update own given rating" on public.player_ratings;
create policy "Users can update own given rating" on public.player_ratings
  for update using (auth.uid() = rater_id) with check (auth.uid() = rater_id);
