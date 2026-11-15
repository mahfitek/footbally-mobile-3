-- İlan türü, maç formatı, diziliş ve kadro (lineup) alanları.
--
-- Yalnızca ekleme yapar: yeni kolonlar, kısıtlar, indeks ve bir trigger fonksiyonu.
-- Mevcut kolonların anlamı değişmez:
--   * matches.type   : mevcut istemci burada "7v7" gibi format metni yazar. Dokunulmaz.
--   * matches.required_players : mevcut istemci burada toplam kadro kapasitesi yazar. Dokunulmaz.
--   * matches.team_payment     : kişi başı ücret (web'de price_per_player olarak yazılır). Ücretli ilanda
--     bu kolon kullanılır; yeni is_paid / fee_per_person kolonu AÇILMAZ (aynı anlam).
--
-- Yeni kolonlar:
--   listing_type  : 'individual' (oyuncuyum, maç arıyorum) | 'opponent' (rakip arıyorum) | 'players' (oyuncu arıyorum).
--                   Mevcut satırlar 'players' olur: bu, mevcut ilanların davranışıyla aynıdır.
--   match_format  : saha içi kişi sayısı 5..11. Null = eski satır (type içindeki metinden okunur).
--   formation     : seçilen diziliş, ör. "4-4-2". Null = diziliş yok.
--   lineup        : [{slot, user_id, name}] dizisi. Yalnızca takım üyeleri yazılabilir (trigger doğrular).
--   fee_note      : ücretli ilanın kısa notu, ör. "saha ücreti paylaşılacak".

alter table public.matches
  add column if not exists listing_type text not null default 'players',
  add column if not exists match_format smallint null,
  add column if not exists formation text null,
  add column if not exists lineup jsonb null,
  add column if not exists fee_note text null;

alter table public.matches
  add constraint matches_listing_type_check
  check (listing_type in ('individual', 'opponent', 'players'));

alter table public.matches
  add constraint matches_match_format_check
  check (match_format is null or match_format between 5 and 11);

alter table public.matches
  add constraint matches_formation_check
  check (formation is null or formation ~ '^[1-5](-[1-5]){1,3}$');

alter table public.matches
  add constraint matches_lineup_shape_check
  check (lineup is null or (jsonb_typeof(lineup) = 'array' and jsonb_array_length(lineup) <= 11));

create index if not exists matches_listing_type_idx on public.matches (listing_type);

-- Kadro doğrulaması: her oyuncu ilgili takımın üyesi olmalı, aynı oyuncu iki kez yazılamaz.
-- Takımsız (bireysel) ilanda kadro boş olmalıdır.
create or replace function public.matches_validate_lineup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_uid uuid;
  v_distinct integer;
begin
  if new.lineup is null or jsonb_array_length(new.lineup) = 0 then
    return new;
  end if;

  if new.team_id is null then
    raise exception 'lineup_requires_team' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(new.lineup) loop
    begin
      v_uid := (v_item->>'user_id')::uuid;
    exception when others then
      raise exception 'lineup_invalid_user' using errcode = '22023';
    end;

    if v_uid is null then
      raise exception 'lineup_invalid_user' using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.team_members tm
       where tm.team_id = new.team_id and tm.user_id = v_uid
    ) then
      raise exception 'lineup_not_team_member' using errcode = '42501';
    end if;
  end loop;

  select count(distinct v->>'user_id') into v_distinct
    from jsonb_array_elements(new.lineup) as v;
  if v_distinct <> jsonb_array_length(new.lineup) then
    raise exception 'lineup_duplicate_player' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.matches_validate_lineup() from public, anon, authenticated;

create trigger matches_validate_lineup_trg
  before insert or update of lineup, team_id on public.matches
  for each row execute function public.matches_validate_lineup();
