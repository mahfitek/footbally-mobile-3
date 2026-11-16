// Oturum açan kullanıcının engellediği kişilerin kimlikleri. Önbellek lib/blockStore.ts'tedir: bir ekranda
// yapılan engelleme veya engel kaldırma, açık olan diğer tüm ekranlara anında yansır.
// Liste okunamazsa null kalır; liste yine gösterilir ama "Engellendi" etiketi verilmez.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { discoveryBlocksClient } from './discoveryClient';
import { fetchBlockedUserIds } from './discovery';
import { getBlockedSnapshot, setBlockedSnapshot, subscribeBlocked, type BlockedSnapshot } from './blockStore';

export function useBlockedIds(): { blockedIds: BlockedSnapshot; reload: () => void } {
  const blockedIds = useSyncExternalStore(subscribeBlocked, getBlockedSnapshot, getBlockedSnapshot);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      setBlockedSnapshot(new Set());
      return;
    }
    setBlockedSnapshot(await fetchBlockedUserIds(discoveryBlocksClient, uid));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { blockedIds, reload: () => void load() };
}
