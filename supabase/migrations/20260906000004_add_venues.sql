create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  city text,
  district text,
  address text,
  phone text,
  whatsapp text,
  price_per_hour numeric,
  description text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.venue_availability (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time text not null,
  end_time text not null,
  created_at timestamptz not null default now(),
  unique (venue_id, day_of_week, start_time)
);

alter table public.venues enable row level security;
alter table public.venue_availability enable row level security;

-- is_active = false olan sahalar (henuz onaylanmamis/pasif) sadece sahibine
-- gorunur; aktif olanlar herkese acik kesif icin gorunur.
create policy "Anyone can view active venues" on public.venues
  for select using (is_active = true or auth.uid() = owner_user_id);

create policy "Owner can update own venue" on public.venues
  for update using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

create policy "Anyone can view availability of visible venues" on public.venue_availability
  for select using (
    exists (select 1 from public.venues v where v.id = venue_id and (v.is_active = true or v.owner_user_id = auth.uid()))
  );

create policy "Owner can manage own venue availability" on public.venue_availability
  for all using (
    exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid())
  );
