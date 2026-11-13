-- AI analizi tamamlanınca video listesine ekleme ve AI CV kaydetme.
--
-- 1) ai_video_jobs bir analiz "completed" olduğunda video_url, kullanıcının profiles.video_urls listesine eklenir.
--    Analiz, edge function (analyze-video) tarafından yazılır; bu trigger o fonksiyonu değiştirmeden çalışır.
--    Kaldırılmış (admin tarafından removed_by_admin) medya geri eklenmez: guard_removed_profile_media hatasından
--    kaçınmak için aynı kontrol burada yapılır ve sessizce atlanır. Aynı URL iki kez eklenmez.
-- 2) save_my_ai_cv(p_text): AI CV metnini kendi profiline yazar. auth.uid() kullanır, 4000 karakter sınırı vardır.
--    ai_cv_text istemcinin doğrudan güncellemesine açık değildir; yazım yalnızca bu fonksiyon üzerinden yapılır.

create or replace function public.add_video_from_completed_analysis()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from 'completed' then
    return new;
  end if;
  if new.user_id is null or nullif(btrim(new.video_url), '') is null then
    return new;
  end if;

  -- Yönetici tarafından kaldırılmış bir video geri eklenmez.
  if exists (
    select 1 from public.media_moderation m
     where m.owner_user_id = new.user_id
       and m.moderation_status = 'removed_by_admin'
       and m.media_kind = 'video'
       and m.media_ref = new.video_url
  ) then
    return new;
  end if;

  update public.profiles
     set video_urls = array_append(video_urls, new.video_url)
   where user_id = new.user_id
     and not (new.video_url = any (video_urls));

  return new;
end;
$$;

drop trigger if exists ai_video_jobs_add_completed_video on public.ai_video_jobs;
create trigger ai_video_jobs_add_completed_video
  after insert or update of status, video_url on public.ai_video_jobs
  for each row execute function public.add_video_from_completed_analysis();

create or replace function public.save_my_ai_cv(p_text text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_text text := btrim(coalesce(p_text, ''));
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.assert_personal_account_allowed();

  if v_text = '' then
    raise exception 'cv_empty' using errcode = '22023';
  end if;
  if char_length(v_text) > 4000 then
    raise exception 'cv_too_long' using errcode = '22001';
  end if;

  update public.profiles set ai_cv_text = v_text where user_id = v_uid;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.add_video_from_completed_analysis() from public, anon, authenticated;
revoke all on function public.save_my_ai_cv(text) from public, anon;
grant execute on function public.save_my_ai_cv(text) to authenticated;
