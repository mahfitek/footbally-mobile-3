-- get_my_blocked_users testleri için teams kolonları (canlı tanımla uyumlu; yalnızca yerel veritabanı).
alter table public.teams add column if not exists created_at timestamp not null default now();
alter table public.teams add column if not exists archived_at timestamptz;
