-- İki yönlü engel: engel hangi yönde olursa olsun taraflar birbiriyle etkileşemez.
--
-- Yalnızca ekleme: her tablo için yeni bir BEFORE INSERT trigger'ı ve trigger fonksiyonu.
-- Mevcut satırlar değişmez; engelden önce yapılmış beğeni, yorum, takip, bağlantı silinmez.
-- Engel yardımcısı: users_blocked_either_way (20261116110000_reject_match_application.sql).
-- Zaten korunan tablo: messages (messages_enforce_block, hata kodu 'blocked_user'); değiştirilmedi.
-- match_applications: 20261116110000 içindeki match_applications_guard.
-- Hata: 'blocked_interaction' (42501).

-- Beğeni: gönderinin sahibi.
create or replace function public.post_likes_block_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_owner uuid;
begin
  select p.user_id into v_owner from public.posts p where p.id = new.post_id;
  if public.users_blocked_either_way(new.user_id, v_owner) then
    raise exception 'blocked_interaction' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.post_likes_block_guard() from public, anon, authenticated;
create trigger post_likes_block_guard_trg before insert on public.post_likes
  for each row execute function public.post_likes_block_guard();

-- Yorum: gönderinin sahibi.
create or replace function public.post_comments_block_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_owner uuid;
begin
  select p.user_id into v_owner from public.posts p where p.id = new.post_id;
  if public.users_blocked_either_way(new.user_id, v_owner) then
    raise exception 'blocked_interaction' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.post_comments_block_guard() from public, anon, authenticated;
create trigger post_comments_block_guard_trg before insert on public.post_comments
  for each row execute function public.post_comments_block_guard();

-- Takip: takip edilen.
create or replace function public.follows_block_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if public.users_blocked_either_way(new.follower_id, new.followed_id) then
    raise exception 'blocked_interaction' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.follows_block_guard() from public, anon, authenticated;
create trigger follows_block_guard_trg before insert on public.follows
  for each row execute function public.follows_block_guard();

-- Bağlantı isteği: hedef kullanıcı.
create or replace function public.connections_block_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if public.users_blocked_either_way(new.requester_id, new.target_id) then
    raise exception 'blocked_interaction' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.connections_block_guard() from public, anon, authenticated;
create trigger connections_block_guard_trg before insert on public.connections
  for each row execute function public.connections_block_guard();

-- Meydan okuma: iki takımın sahipleri.
create or replace function public.match_challenges_block_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_challenger uuid; v_opponent uuid;
begin
  select t.owner_id into v_challenger from public.teams t where t.id = new.challenger_team_id;
  select t.owner_id into v_opponent from public.teams t where t.id = new.opponent_team_id;
  if public.users_blocked_either_way(v_challenger, v_opponent) then
    raise exception 'blocked_interaction' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.match_challenges_block_guard() from public, anon, authenticated;
create trigger match_challenges_block_guard_trg before insert on public.match_challenges
  for each row execute function public.match_challenges_block_guard();

-- Takım daveti: davet edilen kullanıcı ile takım sahibi. Yalnızca user_id dolu davetler (e-posta daveti kapsam dışı).
create or replace function public.team_invitations_block_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_owner uuid;
begin
  select t.owner_id into v_owner from public.teams t where t.id = new.team_id;
  if public.users_blocked_either_way(new.user_id, v_owner) then
    raise exception 'blocked_interaction' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.team_invitations_block_guard() from public, anon, authenticated;
create trigger team_invitations_block_guard_trg before insert on public.team_invitations
  for each row execute function public.team_invitations_block_guard();

-- Yeni sohbet: iki katılımcı.
create or replace function public.conversations_block_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if public.users_blocked_either_way(new.participant_a, new.participant_b) then
    raise exception 'blocked_interaction' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.conversations_block_guard() from public, anon, authenticated;
create trigger conversations_block_guard_trg before insert on public.conversations
  for each row execute function public.conversations_block_guard();

-- Scout konuşması: scout ile hedef (oyuncu profili ya da takım sahibi). Alıcı, resolve_recipient ile aynı
-- kuralla çözülür; bu trigger alıcı henüz atanmamış olsa bile doğru kişiyi kontrol eder.
create or replace function public.scout_conversations_block_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_recipient uuid;
begin
  if new.recipient_user_id is not null then
    v_recipient := new.recipient_user_id;
  elsif new.target_type = 'player' then
    select p.user_id into v_recipient from public.profiles p where p.user_id = new.target_id;
  else
    select t.owner_id into v_recipient from public.teams t where t.id = new.target_id::uuid;
  end if;
  if public.users_blocked_either_way(new.scout_user_id, v_recipient) then
    raise exception 'blocked_interaction' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.scout_conversations_block_guard() from public, anon, authenticated;
create trigger scout_conversations_block_guard_trg before insert on public.scout_conversations
  for each row execute function public.scout_conversations_block_guard();

-- Scout mesajı: konuşmanın iki tarafı.
create or replace function public.scout_messages_block_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_scout uuid; v_recipient uuid;
begin
  select c.scout_user_id, c.recipient_user_id into v_scout, v_recipient
    from public.scout_conversations c where c.id = new.conversation_id;
  if public.users_blocked_either_way(v_scout, v_recipient) then
    raise exception 'blocked_interaction' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.scout_messages_block_guard() from public, anon, authenticated;
create trigger scout_messages_block_guard_trg before insert on public.scout_messages
  for each row execute function public.scout_messages_block_guard();
