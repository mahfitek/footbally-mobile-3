// Takıma gelen başvurular: takımın (matches.team_id) maçlarına yapılan match_applications kayıtları.
// Kabul/ret için match_applications üzerinde sahibe UPDATE politikası yoktur; bu ekran yalnızca listeler.
import type { SupabaseClient } from '@supabase/supabase-js';
import { countsAsApplication } from './profileTasks';

export type TeamApplicant = {
  application_id: number;
  user_id: string;
  full_name: string;
  position: string | null;
  city: string | null;
  age: number | null;
  score: number | null;
  status: string;
  created_at: string;
};

type Client = Pick<SupabaseClient, 'from'>;

/**
 * Takımın maçlarına gelen olumsuz olmayan başvuruları döndürür. Okuma hatasında null (çağıran boş durum gösterir).
 */
export async function fetchTeamApplicants(client: Client, teamId: string): Promise<TeamApplicant[] | null> {
  const { data: matches, error: matchError } = await client.from('matches').select('id').eq('team_id', teamId);
  if (matchError) return null;
  const matchIds = ((matches ?? []) as { id: number }[]).map((m) => m.id);
  if (matchIds.length === 0) return [];

  const { data: applications, error: applicationError } = await client
    .from('match_applications')
    .select('id, user_id, status, created_at')
    .in('match_id', matchIds)
    .order('created_at', { ascending: false });
  if (applicationError) return null;

  const rows = ((applications ?? []) as { id: number; user_id: string; status: string | null; created_at: string }[]).filter(
    (a) => countsAsApplication(a.status),
  );
  const userIds = [...new Set(rows.map((a) => a.user_id))];
  if (userIds.length === 0) return [];

  const { data: profiles, error: profileError } = await client
    .from('profiles_public')
    .select('user_id, full_name, position, city, age, score')
    .in('user_id', userIds);
  if (profileError) return null;

  const profileById = new Map(
    ((profiles ?? []) as { user_id: string; full_name: string | null; position: string | null; city: string | null; age: number | null; score: number | null }[]).map(
      (p) => [p.user_id, p],
    ),
  );

  return rows.map((a) => {
    const p = profileById.get(a.user_id);
    return {
      application_id: a.id,
      user_id: a.user_id,
      full_name: p?.full_name || '',
      position: p?.position ?? null,
      city: p?.city ?? null,
      age: p?.age ?? null,
      score: p?.score ?? null,
      status: a.status ?? 'applied',
      created_at: a.created_at,
    };
  });
}

/** Seçilen pozisyona başvuranlar (profil pozisyonu birebir eşleşir). */
export function filterApplicantsByPosition(applicants: TeamApplicant[], position: string): TeamApplicant[] {
  return applicants.filter((a) => a.position === position);
}
