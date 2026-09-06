alter table public.profiles
  add column if not exists notify_all boolean not null default true,
  add column if not exists notify_match boolean not null default true,
  add column if not exists notify_message boolean not null default true,
  add column if not exists notify_scout boolean not null default true;
