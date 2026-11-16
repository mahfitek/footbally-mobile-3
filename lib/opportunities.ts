// Fırsatlar (opportunities): yalnızca veritabanından gelir. Sabit, örnek veya yedek fırsat listesi yoktur.
// Kurallar burada saf fonksiyonlardır (test edilebilir); ekranlar Supabase sorgusunu kendileri yapar.
// Tablodaki kayıtlar proje sahibi tarafından silinecektir; istemci hiçbir kayda yazmaz ya da silmez.

export type OpportunityRow = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  location: string;
  age: string;
  deadline: string;
};

/** Veritabanı satırını ekran modeline çevirir. Kimliği ya da başlığı olmayan satır atılır. */
export function normalizeOpportunity(raw: unknown): OpportunityRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id) : '';
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (!id || !title) return null;
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return {
    id,
    title,
    subtitle: text(row.subtitle),
    badge: text(row.badge),
    badgeColor: text(row.badge_color),
    location: text(row.location),
    age: text(row.age_range),
    deadline: text(row.deadline),
  };
}

/** Sıra korunur; geçersiz satırlar listeden çıkarılır. */
export function normalizeOpportunities(rawRows: unknown[]): OpportunityRow[] {
  return rawRows
    .map((raw) => normalizeOpportunity(raw))
    .filter((row): row is OpportunityRow => row !== null);
}

/**
 * Kullanıcının başvurularından yalnızca HÂLÂ VAR OLAN fırsatlara ait olanları döndürür.
 * Fırsatı silinmiş (opportunity_id artık listede yok) ya da fırsatı olmayan başvurular atlanır.
 */
export function appliedOpportunityIds(
  applicationRows: { opportunity_id: unknown }[],
  opportunities: OpportunityRow[],
): Set<string> {
  const existing = new Set(opportunities.map((op) => op.id));
  const applied = new Set<string>();
  for (const row of applicationRows) {
    const id = typeof row.opportunity_id === 'string' || typeof row.opportunity_id === 'number' ? String(row.opportunity_id) : '';
    if (id && existing.has(id)) applied.add(id);
  }
  return applied;
}

/** Fırsatlar ekranındaki süzgeçler (konum ve rozet). "Tümü" her şeyi kabul eder. */
export function matchesOpportunityFilter(op: OpportunityRow, filter: string): boolean {
  if (filter === 'Tümü') return true;
  if (filter === 'Türkiye') return op.location.includes('TR');
  if (filter === 'Avrupa') return !op.location.includes('TR');
  return op.badge === filter;
}
