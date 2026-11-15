// İlan türü, format ve ilan kaydının kuralları (saf fonksiyonlar; Supabase'e bağımlı değildir).
//
// İlan türleri (matches.listing_type):
//   individual : "Oyuncuyum, maç arıyorum" — kişisel hesap, takım yok. required_players = 1.
//   opponent   : "Rakip arıyorum" — takım (sahibi olunan) rakip arar. required_players = format (karşı takım).
//   players    : "Oyuncu arıyorum" — takım ya da organizatör eksik oyuncu arar. required_players = eksik oyuncu sayısı.
// Eski satırlar listing_type='players' ile gelir (mevcut ilanların davranışı).
//
// matches.type mevcut istemcide "7v7" gibi format metni taşır; match_format yeni kolondur. Eski satırlarda
// match_format null olabilir, bu yüzden format type içinden de okunur.
import { isFormationForFormat, isMatchFormat, type LineupEntry, type MatchFormat } from './formations';
import { buildMatchInsert, type MatchScope } from './matchCreation';

export const LISTING_TYPES = ['individual', 'opponent', 'players'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];
export type ListingFilter = ListingType | 'all';

export const LISTING_TYPE_LABEL_KEYS: Record<ListingType, 'listing_type_individual' | 'listing_type_opponent' | 'listing_type_players'> = {
  individual: 'listing_type_individual',
  opponent: 'listing_type_opponent',
  players: 'listing_type_players',
};

export const LISTING_TYPE_SHORT_KEYS: Record<ListingType, 'listing_short_individual' | 'listing_short_opponent' | 'listing_short_players'> = {
  individual: 'listing_short_individual',
  opponent: 'listing_short_opponent',
  players: 'listing_short_players',
};

export const MAX_FEE_NOTE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 500;

export const POSITION_OPTIONS = ['Kaleci', 'Defans', 'Orta Saha', 'Kanat', 'Forvet'] as const;

export function isListingType(value: unknown): value is ListingType {
  return typeof value === 'string' && (LISTING_TYPES as readonly string[]).includes(value);
}

/** Satırın türü. Bilinmeyen ya da boş değer eski davranışa (players) düşer. */
export function listingTypeOf(row: { listing_type?: string | null }): ListingType {
  return isListingType(row.listing_type) ? row.listing_type : 'players';
}

export type ListingRowLike = {
  type?: string | null;
  listing_type?: string | null;
  match_format?: number | null;
  team_payment?: number | string | null;
};

/** Satırın formatı: önce match_format, yoksa type metnindeki "7v7" (eski satırlar). */
export function formatOfListing(row: ListingRowLike): MatchFormat | null {
  if (isMatchFormat(row.match_format)) return row.match_format;
  const match = /^\s*(\d+)\s*v\s*\1\s*$/i.exec(row.type ?? '');
  if (!match) return null;
  const value = Number(match[1]);
  return isMatchFormat(value) ? value : null;
}

export function isPaidListing(row: { team_payment?: number | string | null }): boolean {
  const fee = Number(row.team_payment ?? 0);
  return Number.isFinite(fee) && fee > 0;
}

/** Tür ve format filtresi. 'all' her şeyi geçirir. */
export function filterListings<T extends ListingRowLike>(
  rows: T[],
  filter: { listingType: ListingFilter; format: MatchFormat | 'all' },
): T[] {
  return rows.filter((row) => {
    if (filter.listingType !== 'all' && listingTypeOf(row) !== filter.listingType) return false;
    if (filter.format !== 'all' && formatOfListing(row) !== filter.format) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------------------------
// İlan oluşturma
// ---------------------------------------------------------------------------------------------

export type ListingDraft = {
  listingType: ListingType;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  city: string;
  district: string;
  format: number | null;
  category: string;
  description: string;
  positions: string[];
  missingPlayers: number | null;
  teamId: string | null;
  formation: string | null;
  lineup: LineupEntry[];
  isPaid: boolean;
  feePerPerson: number | null;
  feeNote: string;
  creatorId: string;
};

export type ListingDraftError =
  | 'title_required'
  | 'location_required'
  | 'city_required'
  | 'date_required'
  | 'time_required'
  | 'format_required'
  | 'team_required'
  | 'positions_required'
  | 'missing_players_invalid'
  | 'fee_required'
  | 'fee_note_too_long'
  | 'description_too_long'
  | 'formation_invalid'
  | 'lineup_requires_team';

export type ListingBuildResult =
  | { ok: true; row: Record<string, unknown>; scope: MatchScope }
  | { ok: false; error: ListingDraftError };

function clean(value: string): string {
  return value.trim();
}

/** Taslağı doğrular ve matches tablosuna yazılacak satırı üretir. Hata varsa ilk sorunu döndürür. */
export function buildListingRow(draft: ListingDraft): ListingBuildResult {
  const title = clean(draft.title);
  const location = clean(draft.location);
  const city = clean(draft.city);
  const district = clean(draft.district);
  const description = clean(draft.description);
  const feeNote = clean(draft.feeNote);

  if (!title) return { ok: false, error: 'title_required' };
  if (!clean(draft.date)) return { ok: false, error: 'date_required' };
  if (!clean(draft.time)) return { ok: false, error: 'time_required' };
  if (!location) return { ok: false, error: 'location_required' };
  if (!city || !district) return { ok: false, error: 'city_required' };
  if (!isMatchFormat(draft.format)) return { ok: false, error: 'format_required' };
  if (description.length > MAX_DESCRIPTION_LENGTH) return { ok: false, error: 'description_too_long' };

  const format = draft.format;
  const teamId = draft.listingType === 'individual' ? null : draft.teamId;
  if (draft.listingType === 'opponent' && !teamId) return { ok: false, error: 'team_required' };

  const positions = [...new Set(draft.positions.filter((p) => (POSITION_OPTIONS as readonly string[]).includes(p)))];
  if ((draft.listingType === 'individual' || draft.listingType === 'players') && positions.length === 0) {
    return { ok: false, error: 'positions_required' };
  }

  let requiredPlayers: number;
  if (draft.listingType === 'individual') {
    requiredPlayers = 1;
  } else if (draft.listingType === 'opponent') {
    requiredPlayers = format;
  } else {
    const missing = draft.missingPlayers;
    if (missing === null || !Number.isInteger(missing) || missing < 1 || missing > format - 1) {
      return { ok: false, error: 'missing_players_invalid' };
    }
    requiredPlayers = missing;
  }

  if (draft.formation !== null && !isFormationForFormat(format, draft.formation)) {
    return { ok: false, error: 'formation_invalid' };
  }
  if (draft.lineup.length > 0 && !teamId) return { ok: false, error: 'lineup_requires_team' };

  let fee = 0;
  if (draft.isPaid) {
    if (draft.feePerPerson === null || !Number.isFinite(draft.feePerPerson) || draft.feePerPerson <= 0) {
      return { ok: false, error: 'fee_required' };
    }
    if (feeNote.length > MAX_FEE_NOTE_LENGTH) return { ok: false, error: 'fee_note_too_long' };
    fee = draft.feePerPerson;
  }

  const scope: MatchScope = teamId ? { kind: 'team', teamId } : { kind: 'personal' };
  const base = {
    title,
    date: draft.date,
    time: draft.time,
    location,
    city: `${city}, ${district}`,
    required_players: requiredPlayers,
    type: `${format}v${format}`,
    category: draft.category,
    creator_id: draft.creatorId,
  };
  const row: Record<string, unknown> = {
    ...buildMatchInsert(base, scope),
    listing_type: draft.listingType,
    match_format: format,
    formation: draft.formation,
    needed_positions: positions,
    description: description || null,
    team_payment: fee,
    fee_note: draft.isPaid && feeNote ? feeNote : null,
  };
  if (teamId && draft.lineup.length > 0) row.lineup = draft.lineup;

  return { ok: true, row, scope };
}

/** Ücretli ilanın sorumluluk metni anahtarı (TR/EN çevirisi lib/i18n.ts içindedir). */
export const PAYMENT_DISCLAIMER_KEY = 'listing_paymentDisclaimer' as const;

