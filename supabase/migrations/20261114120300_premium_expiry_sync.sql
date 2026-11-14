-- Süresi dolan premium'ları kapatır: etkin aboneliği kalmayan profilin is_premium değerini false yapar.
-- Zamanlanmış iş (pg_cron) her 15 dakikada bir çalışır. Yalnızca profiles.is_premium değerini günceller.

create or replace function public.expire_stale_premium()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.profiles p
     set is_premium = false
   where p.is_premium
     and not exists (
       select 1 from public.subscriptions s
        where s.user_id = p.user_id
          and lower(s.status) = 'active'
          and (s.expires_at is null or s.expires_at > now())
     );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_stale_premium() from public, anon, authenticated;

select cron.schedule('premium-expiry-sync', '*/15 * * * *', $cron$select public.expire_stale_premium();$cron$);
