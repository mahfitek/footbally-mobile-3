-- Tribün is a live/ephemeral room, not an archive — keep only the last 24
-- hours of messages so the table (and any attached media referenced by it)
-- doesn't grow unbounded on the server. pg_cron runs a rolling cleanup
-- hourly instead of a once-a-day wipe, so the room never goes fully empty
-- at a fixed hour.
create extension if not exists pg_cron;

create or replace function public.delete_old_tribun_messages()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.tribun_messages
  where created_at < now() - interval '24 hours';
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'tribun-message-cleanup';

select cron.schedule(
  'tribun-message-cleanup',
  '0 * * * *', -- every hour
  $$select public.delete_old_tribun_messages();$$
);

-- Note: pg_cron must be enabled for this project (Supabase: Database ->
-- Extensions -> pg_cron) if the `create extension` above is not permitted
-- to run automatically. Deleted messages' media files in the 'avatars'
-- bucket (under "<user_id>/tribun/...") are NOT auto-deleted by this job;
-- that's a separate storage-cleanup concern if it becomes worth doing.
