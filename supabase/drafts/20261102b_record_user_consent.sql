-- TASLAK, UYGULANMADI. Canlı veritabanına yalnızca kullanıcı onayından sonra uygulanır.
-- Resmî migration web repoda tutulur (footbally-unified-account/supabase/migrations); bu dosya referans içindir.
--
-- Neden RPC: user_consents tablosunda istemci için yalnızca SELECT politikası var (INSERT yok).
-- Rıza kaydı, auth.uid() ile sunucu tarafında yazılır; istemci başka kullanıcı adına kayıt üretemez.
-- Kolonlar mevcut şemadan: user_id, app, consent_type, document_version, granted, recorded_at.

create or replace function public.record_user_consent(
  p_app text,
  p_consent_type text,
  p_document_version text,
  p_granted boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  if p_app not in ('mobile', 'web') then
    raise exception 'invalid_app' using errcode = '22023';
  end if;

  insert into public.user_consents (user_id, app, consent_type, document_version, granted, recorded_at)
  values (auth.uid(), p_app, p_consent_type, p_document_version, p_granted, now());
end;
$$;

revoke all on function public.record_user_consent(text, text, text, boolean) from public, anon;
grant execute on function public.record_user_consent(text, text, text, boolean) to authenticated;
