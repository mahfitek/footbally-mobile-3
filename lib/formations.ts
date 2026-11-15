// Maç formatları, dizilişler ve kadro yerleşimi. Tek kaynak: bu dosya.
//
// Dizilişler kaleci HARİÇ yazılır (örn. 4-4-2 = 10 saha oyuncusu). Format = kaleci dahil toplam kişi sayısı,
// yani her dizilişin saha oyuncusu sayısı format - 1 olmalıdır (birim testi bunu doğrular).
// Slot sırası: önce kaleci (GK), sonra hatlar öndeki sıra ile. Her slotun anahtarı "ROL-n" biçimindedir
// (n: o roldeki 1 tabanlı sıra), kadro kaydında (matches.lineup.slot) bu anahtar kullanılır.

export const MATCH_FORMATS = [5, 6, 7, 8, 9, 10, 11] as const;
export type MatchFormat = (typeof MATCH_FORMATS)[number];

export type SlotRole = 'GK' | 'DEF' | 'DM' | 'MID' | 'ATT' | 'FWD';

export type FormationSlot = {
  key: string;
  role: SlotRole;
  x: number;
  y: number;
};

export const FORMATIONS: Record<MatchFormat, readonly string[]> = {
  5: ['1-2-1', '2-2', '1-1-2', '2-1-1', '3-1'],
  6: ['2-2-1', '2-1-2', '3-1-1', '1-3-1'],
  7: ['2-3-1', '3-2-1', '3-1-2', '2-2-2', '1-3-2', '2-1-2-1'],
  8: ['3-3-1', '2-3-2', '3-2-2', '2-4-1', '3-1-3', '4-2-1'],
  9: ['3-3-2', '3-2-3', '2-4-2', '4-3-1', '3-4-1'],
  10: ['3-3-3', '4-3-2', '3-4-2', '4-4-1', '3-5-1'],
  11: ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '4-1-4-1', '4-5-1'],
};

const FORMAT_SET = new Set<number>(MATCH_FORMATS);

export function isMatchFormat(value: unknown): value is MatchFormat {
  return typeof value === 'number' && FORMAT_SET.has(value);
}

/** "4-2-3-1" -> [4, 2, 3, 1]. Geçersiz metinde null. */
export function parseFormation(formation: string): number[] | null {
  if (!/^\d(-\d){1,3}$/.test(formation)) return null;
  return formation.split('-').map((n) => Number(n));
}

/** Diziliş bu formatta tanımlı mı? */
export function isFormationForFormat(format: number, formation: string): boolean {
  if (!isMatchFormat(format)) return false;
  return FORMATIONS[format].includes(formation);
}

const ROLE_ORDER_BY_LINES: Record<number, readonly SlotRole[]> = {
  2: ['DEF', 'FWD'],
  3: ['DEF', 'MID', 'FWD'],
  4: ['DEF', 'DM', 'MID', 'FWD'],
};

function rolesForLines(lines: number[]): SlotRole[] {
  // 4-2-3-1 kalıbı: ikinci hat 2 kişiyse üçüncü hat ofansif orta saha (ATT) sayılır.
  if (lines.length === 4 && lines[1] === 2) return ['DEF', 'DM', 'ATT', 'FWD'];
  return [...(ROLE_ORDER_BY_LINES[lines.length] ?? [])];
}

function lineY(index: number, count: number): number {
  // Savunma hattı y=72 (kendi kalesine yakın), forvet hattı y=22.
  if (count === 1) return 50;
  return 72 - (50 * index) / (count - 1);
}

function lineXs(count: number): number[] {
  if (count === 1) return [50];
  const spacing = Math.min(30, 70 / (count - 1));
  return Array.from({ length: count }, (_, j) => 50 + (j - (count - 1) / 2) * spacing);
}

/**
 * Formattaki bir diziliş için saha slotlarını üretir (kaleci dahil, GK ilk sırada).
 * Geçersiz format/diziliş için boş dizi döner.
 */
export function getFormationSlots(format: number, formation: string): FormationSlot[] {
  if (!isFormationForFormat(format, formation)) return [];
  const lines = parseFormation(formation);
  if (!lines) return [];
  const roles = rolesForLines(lines);
  const slots: FormationSlot[] = [{ key: 'GK-1', role: 'GK', x: 50, y: 88 }];
  lines.forEach((count, lineIndex) => {
    const role = roles[lineIndex];
    const y = lineY(lineIndex, lines.length);
    lineXs(count).forEach((x, j) => {
      slots.push({ key: `${role}-${j + 1}`, role, x, y: Math.round(y * 10) / 10 });
    });
  });
  return slots;
}

const ROLE_LABELS_TR: Record<SlotRole, string> = { GK: 'KAL', DEF: 'DEF', DM: 'DMF', MID: 'ORT', ATT: 'ATK', FWD: 'FOR' };
const ROLE_LABELS_EN: Record<SlotRole, string> = { GK: 'GK', DEF: 'DEF', DM: 'DM', MID: 'MID', ATT: 'AM', FWD: 'FWD' };

export function roleLabel(role: string, lang: 'tr' | 'en'): string {
  const table = lang === 'tr' ? ROLE_LABELS_TR : ROLE_LABELS_EN;
  return table[role as SlotRole] ?? role;
}

// ---------------------------------------------------------------------------------------------
// Kadro yerleştirme
// ---------------------------------------------------------------------------------------------

export type LineupCandidate = {
  user_id: string;
  name: string;
  position: string | null;
  jersey_number?: number | null;
};

export type LineupAssignment = LineupCandidate | null;

export type LineupEntry = { slot: string; user_id: string; name: string };

/**
 * Profil/kadro pozisyonunu slot rollerine eşler. Öncelik sırası: ilk rol en uygunudur.
 * Profil değerleri (Kaleci, Defans, Orta Saha, Kanat, Forvet) ile eski ayrıntılı değerler (CB, CAM, ST...) desteklenir.
 */
export function preferredRolesFor(position: string | null | undefined): SlotRole[] {
  const p = (position ?? '').trim();
  if (!p) return [];
  const lower = p.toLowerCase();
  if (lower === 'kaleci' || lower.includes('gk') || lower.includes('goalkeeper')) return ['GK'];
  if (lower.includes('libero') || lower.includes('sweeper') || lower === 'sw') return ['DEF', 'DM'];
  if (lower === 'defans' || lower.includes('stoper') || lower.includes('bek') || lower.includes('cb') || lower.includes('def')) {
    return ['DEF', 'DM'];
  }
  if (lower.includes('cdm') || lower.includes('savunma orta') || lower === 'dm' || lower.includes('dmf')) return ['DM', 'MID'];
  if (lower.includes('cam') || lower.includes('ofansif')) return ['ATT', 'MID'];
  if (lower === 'orta saha' || lower.includes('cm') || lower.includes('mid')) return ['DM', 'MID', 'ATT'];
  if (lower.includes('kanat') || lower.includes('wing') || lower.includes('rw') || lower.includes('lw')) return ['MID', 'ATT', 'FWD'];
  if (lower === 'forvet' || lower.includes('st') || lower.includes('fwd') || lower.includes('forvet')) return ['FWD', 'ATT'];
  return [];
}

/**
 * Kadroyu slotlara yerleştirir:
 *  1) Kaleci: kaleci pozisyonundaki ilk oyuncu GK slotuna.
 *  2) Pozisyon eşleşmesi: her oyuncu, pozisyonuna uygun ilk boş slota (öncelik sırasıyla).
 *  3) Kalanlar: boş (kaleci dışı) slotlara sırayla. Yer kalmazsa yerleşemeyen oyuncu listede kalır.
 * Her oyuncu en fazla bir slota konur. Boş bırakılan slot null kalır.
 */
export function autoFillLineup(candidates: LineupCandidate[], slots: FormationSlot[]): LineupAssignment[] {
  const result: LineupAssignment[] = slots.map(() => null);
  const placed = new Set<string>();

  const place = (index: number, candidate: LineupCandidate) => {
    result[index] = candidate;
    placed.add(candidate.user_id);
  };

  // 1) Kaleci
  const gkSlot = slots.findIndex((s) => s.role === 'GK');
  if (gkSlot !== -1) {
    const keeper = candidates.find((c) => preferredRolesFor(c.position).includes('GK'));
    if (keeper) place(gkSlot, keeper);
  }

  // 2) Pozisyon eşleşmesi (kaleci dışı)
  for (const candidate of candidates) {
    if (placed.has(candidate.user_id)) continue;
    const roles = preferredRolesFor(candidate.position).filter((r) => r !== 'GK');
    for (const role of roles) {
      const index = slots.findIndex((s, i) => s.role === role && result[i] === null);
      if (index !== -1) {
        place(index, candidate);
        break;
      }
    }
  }

  // 3) Kalanlar boş slotlara (kaleci slotu hariç)
  for (const candidate of candidates) {
    if (placed.has(candidate.user_id)) continue;
    const index = slots.findIndex((s, i) => s.role !== 'GK' && result[i] === null);
    if (index !== -1) place(index, candidate);
  }

  return result;
}

/** Kadro kaydı: dolu slotlar, slot sırasıyla. Aynı kullanıcı iki slotta olamaz (fırlatır). */
export function buildLineupEntries(slots: FormationSlot[], assignments: LineupAssignment[]): LineupEntry[] {
  const seen = new Set<string>();
  const entries: LineupEntry[] = [];
  slots.forEach((slot, i) => {
    const member = assignments[i];
    if (!member) return;
    if (seen.has(member.user_id)) {
      throw new Error('duplicate_lineup_player');
    }
    seen.add(member.user_id);
    entries.push({ slot: slot.key, user_id: member.user_id, name: member.name });
  });
  return entries;
}
