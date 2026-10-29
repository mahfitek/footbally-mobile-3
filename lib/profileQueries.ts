import type { SupabaseClient } from '@supabase/supabase-js';

// Profil erişim katmanı. Supabase istemcisi dışarıdan verilir; böylece sorgu
// şekli birim testlerinde sahte (test double) bir istemciyle doğrulanabilir.
//
// Erişim modeli (bkz. ana projede 20261028a / 20261028b migration'ları):
//   - Kendi tam satırın:            get_my_profile() RPC'si (hassas alanlar dahil).
//   - Başka bir kullanıcının profili: profiles_public görünümü (hassas olmayan alanlar).
//   - Hassas alanlar (email, phone, push_token, ai_cv_text, ban alanları, notify_*)
//     başka kullanıcılar için istemciden okunamaz.
//
// Her çağıran, ihtiyaç duyduğu alanları `fields` ile açıkça belirtir. select('*') yoktur.

type ProfileClient = Pick<SupabaseClient, 'from' | 'rpc'>;

export function createProfileQueries(client: ProfileClient) {
  return {
    /** Oturum açan kullanıcının kendi satırı. */
    ownProfile<Q extends string>(fields: Q) {
      return client.rpc('get_my_profile').select(fields).maybeSingle();
    },

    /** Başka bir kullanıcının herkese açık profili. */
    publicProfile<Q extends string>(userId: string, fields: Q) {
      return client.from('profiles_public').select(fields).eq('user_id', userId).maybeSingle();
    },

    /** Birden fazla kullanıcının herkese açık profili. Boş liste için çağıran kontrol etmelidir. */
    publicProfiles<Q extends string>(userIds: string[], fields: Q) {
      return client.from('profiles_public').select(fields).in('user_id', userIds);
    },

    /** Filtre, sıralama veya sayım gerektiren özel sorgular için herkese açık görünüm. */
    publicTable() {
      return client.from('profiles_public');
    },

    /** Kendi profilini güncelle. Dönen satır yalnızca user_id'dir; hassas kolon okunmaz. */
    updateOwn(userId: string, patch: Record<string, unknown>) {
      return client.from('profiles').update(patch).eq('user_id', userId).select('user_id');
    },

    /** Kendi profilini oluştur (ilk kayıt). */
    insertOwn(userId: string, values: Record<string, unknown>) {
      return client.from('profiles').insert({ user_id: userId, ...values });
    },

    /** Süresi dolmuş geçici yasağı kendi kendine temizler. Ban alanlarını istemci yazmaz. */
    clearExpiredBan() {
      return client.rpc('clear_my_expired_ban');
    },

    /** Sunucuda profiles.score'u yeniler. İstemci skoru doğrudan yazmaz. */
    refreshMyScore() {
      return client.rpc('refresh_my_score');
    },
  };
}
