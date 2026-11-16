// Sahadan verisi ve canlı abonelik. TribunScreen (tam ekran) ve ana sayfa önizlemesi bu hook'u kullanır.
// Abonelik yalnızca ekran etkinken açıktır; uygulama arka plana gidince kapanır, geri gelince yeniden yüklenir.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';
import { TRIBUN_MESSAGE_COLUMNS } from './columns';
import { resolveSenderIdentities, type SenderIdentity } from './chatIdentity';
import { isMissingRpc } from './reports';
import { useBlockedIds } from './useBlockedIds';
import {
  filterSahadanMessages,
  type SahadanMessage,
} from './sahadan';

export const SAHADAN_HISTORY_LIMIT = 100;

type RowsResult = { rows: SahadanMessage[]; verified: boolean } | null;

/**
 * Mesaj geçmişi. get_sahadan_messages RPC'si varsa onu kullanır (engel + kaldırılmış medya sunucuda süzülür,
 * verified=true). Yoksa tribun_messages okunur (verified=false: medya doğrulanmamıştır).
 * Hata durumunda null: çağıran boş durum gösterir.
 */
export async function fetchSahadanRows(limit: number = SAHADAN_HISTORY_LIMIT): Promise<RowsResult> {
  const rpc = await supabase.rpc('get_sahadan_messages', { p_limit: limit });
  if (!rpc.error) {
    const rows = ((rpc.data ?? []) as SahadanMessage[]).slice().reverse();
    return { rows, verified: true };
  }
  if (!isMissingRpc(rpc.error)) return null;

  const { data, error } = await supabase
    .from('tribun_messages')
    .select(TRIBUN_MESSAGE_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return null;
  return { rows: ([...(data ?? [])] as SahadanMessage[]).reverse(), verified: false };
}

/**
 * @param active ekran görünür ve etkin mi (ana sayfada: ana sayfa açıkken; tam ekranda: Sahadan açıkken)
 */
export function useSahadanFeed(active: boolean) {
  const { blockedIds } = useBlockedIds();
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<SahadanMessage[]>([]);
  const [identities, setIdentities] = useState<Map<string, SenderIdentity>>(new Map());
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appActive, setAppActive] = useState(true);

  const live = active && appActive;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setLoading(false);
      return;
    }
    const result = await fetchSahadanRows(SAHADAN_HISTORY_LIMIT);
    if (!result) {
      setRows([]);
      setVerified(false);
      setLoading(false);
      return;
    }
    setVerified(result.verified);
    setRows(result.rows);
    const senderIds = Array.from(new Set([uid, ...result.rows.map((m) => m.sender_id)]));
    setIdentities(await resolveSenderIdentities(senderIds));
    setLoading(false);
  }, []);

  // Etkin olunca (ve uygulama öne gelince) geçmişi yeniden yükler; kaçan mesajlar da gelir.
  useEffect(() => {
    if (!live) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    void load();
  }, [live, load]);

  // Canlı abonelik yalnızca etkinken açık.
  useEffect(() => {
    if (!live || !userId) return;
    const channel = supabase
      .channel('tribun')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tribun_messages' }, async (payload) => {
        const m = payload.new as SahadanMessage;
        setRows((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        const resolved = await resolveSenderIdentities([m.sender_id]);
        if (resolved.size > 0) setIdentities((prev) => new Map([...prev, ...resolved]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [live, userId]);

  const visibleRows = useMemo(
    () => (blockedIds ? filterSahadanMessages(rows, blockedIds, userId) : []),
    [rows, blockedIds, userId],
  );

  const appendMessage = useCallback((m: SahadanMessage) => {
    setRows((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
  }, []);

  return {
    loading,
    userId,
    rows: visibleRows,
    identities,
    verified,
    appendMessage,
  };
}
