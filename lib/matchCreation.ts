// Maç oluşturma kuralları (saf fonksiyonlar). Supabase'e bağımlı değildir; birim testleri bu dosyayı kullanır.
//
// Kapsam (bkz. docs/mobile-api-contract.md §9 web reposu):
//  - Bireysel maç: team_id HİÇ gönderilmez (eski istemci davranışıyla aynı). Oluşturan = auth.uid().
//  - Takım adına maç: team_id gönderilir. Yetki (sahip/yönetici, arşiv, ban) sunucu trigger'ında kontrol edilir.
import { isMissingColumnError } from './profileCompletion';

export type MatchScope = { kind: 'personal' } | { kind: 'team'; teamId: string };

/**
 * Sunucunun matches_validate_scope trigger'ı ve RLS'in döndürdüğü hata mesajları.
 *  - not_team_manager / team_archived / team_restricted / personal_account_restricted: yetki (42501)
 *  - team_not_found: takım yok (23503)
 *  - team_unsupported: istemci team_id gönderdi ama sunucu şemasında matches.team_id yok (42703)
 */
export type MatchFailureReason =
  | 'not_team_manager'
  | 'team_archived'
  | 'team_restricted'
  | 'personal_account_restricted'
  | 'team_not_found'
  | 'team_unsupported'
  | 'unknown';

export type MatchCreateOutcome = { status: 'created' } | { status: 'failed'; reason: MatchFailureReason };

export interface MatchBase {
  title: string;
  date: string;
  time: string;
  location: string;
  city: string;
  required_players: number;
  type: string;
  category: string;
  creator_id: string;
}

/**
 * Insert gövdesini kurar. Bireysel maçta team_id anahtarı hiç eklenmez; böylece sunucu ve eski şema değişmeden çalışır.
 */
export function buildMatchInsert(base: MatchBase, scope: MatchScope): Record<string, unknown> {
  if (scope.kind === 'team') return { ...base, team_id: scope.teamId };
  return { ...base };
}

const KNOWN_REASONS: readonly MatchFailureReason[] = [
  'not_team_manager',
  'team_archived',
  'team_restricted',
  'personal_account_restricted',
  'team_not_found',
];

/** Supabase hatasını kullanıcıya gösterilecek nedene çevirir. Takım seçilmemişse team_unsupported üretilmez. */
export function classifyMatchError(
  error: { code?: string; message?: string },
  scope: MatchScope,
): MatchFailureReason {
  const message = error.message ?? '';
  const known = KNOWN_REASONS.find((reason) => message.includes(reason));
  if (known) return known;
  if (scope.kind === 'team' && (isMissingColumnError(error) || message.includes('team_id'))) return 'team_unsupported';
  return 'unknown';
}

/** Sonuç: hata yoksa created. Hata varsa nedeni sınıflandırılır. */
export function classifyMatchResult(
  result: { error: { code?: string; message?: string } | null },
  scope: MatchScope,
): MatchCreateOutcome {
  if (!result.error) return { status: 'created' };
  return { status: 'failed', reason: classifyMatchError(result.error, scope) };
}
