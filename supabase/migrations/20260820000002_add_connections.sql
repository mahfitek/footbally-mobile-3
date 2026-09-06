-- Mutual connections between players and scouts (request/accept flow).
-- A row starts as 'pending' when the requester sends a connection request
-- to the target, and becomes 'accepted' once the target approves it.
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (requester_id, target_id)
);

alter table public.connections enable row level security;

drop policy if exists "Users can view own connections" on public.connections;
create policy "Users can view own connections" on public.connections for select using (auth.uid() = requester_id or auth.uid() = target_id);

drop policy if exists "Users can create connection requests" on public.connections;
create policy "Users can create connection requests" on public.connections for insert with check (auth.uid() = requester_id);

drop policy if exists "Target can accept connection" on public.connections;
create policy "Target can accept connection" on public.connections for update using (auth.uid() = target_id) with check (auth.uid() = target_id);

drop policy if exists "Requester can cancel own request" on public.connections;
create policy "Requester can cancel own request" on public.connections for delete using (auth.uid() = requester_id);
