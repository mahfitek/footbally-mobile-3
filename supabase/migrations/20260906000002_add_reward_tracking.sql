alter table profiles
  add column if not exists claimed_badge_keys text[] not null default '{}',
  add column if not exists reward_premium_days_this_month int not null default 0,
  add column if not exists reward_premium_month_key text;
