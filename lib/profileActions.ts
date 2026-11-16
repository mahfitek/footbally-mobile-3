// Başka bir oyuncunun veya takımın profilinde görünen eylemler (takip, şikâyet, engelleme).
// Saf kurallar: kendi profilinde hiçbir eylem görünmez.
// Takım profilinde engelleme ve takip takım sahibinin kimliği (owner_id) üzerinden yapılır; şikâyet takım kimliğiyle ('team').

export type ProfileSubjectKind = 'player' | 'team';
export type ProfileAction = 'follow' | 'report' | 'block';

/** Görüntülenen profil oturumdaki kullanıcıya ait mi? userId: oyuncu için kullanıcı id'si, takım için sahip id'si. */
export function isOwnProfileView(viewerId: string | null | undefined, subjectUserId: string | null | undefined): boolean {
  if (!viewerId || !subjectUserId) return true;
  return viewerId === subjectUserId;
}

/** Görünür eylemler. Kendi profilinde boş liste. */
export function visibleProfileActions(viewerId: string | null | undefined, subjectUserId: string | null | undefined): ProfileAction[] {
  if (isOwnProfileView(viewerId, subjectUserId)) return [];
  return ['follow', 'report', 'block'];
}

/** Şikâyet hedefi: oyuncu için profil (kullanıcı id), takım için takım (teams.id). */
export function reportTargetFor(
  kind: ProfileSubjectKind,
  subject: { userId: string; teamId?: string | null; name: string },
): { type: 'profile' | 'team'; id: string; name: string } | null {
  if (kind === 'player') return subject.userId ? { type: 'profile', id: subject.userId, name: subject.name } : null;
  return subject.teamId ? { type: 'team', id: subject.teamId, name: subject.name } : null;
}

/** Engellenecek kullanıcı kimliği: oyuncunun kendisi ya da takımın sahibi. */
export function blockTargetUserId(subjectUserId: string | null | undefined): string | null {
  return subjectUserId ? subjectUserId : null;
}

/** Yalnızca kendi profilinde gösterilen bölümler (ana sayfadan taşınan ilerleme ve görevler). */
export function ownOnlySections(
  viewerId: string | null | undefined,
  subjectUserId: string | null | undefined,
): { progress: boolean } {
  const own = isOwnProfileView(viewerId, subjectUserId);
  return { progress: own };
}
