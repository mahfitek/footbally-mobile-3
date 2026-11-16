// Oturum açan kullanıcının engellediği kişilerin kimlikleri. Listeler bu kümeyi filtrede kullanır.
// Okunamazsa boş küme yerine null döner; çağıran, emin olmadığı listeyi göstermemelidir (fail closed).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { discoveryBlocksClient } from './discoveryClient';
import { fetchBlockedUserIds } from './discovery';

export function useBlockedIds(): { blockedIds: ReadonlySet<string> | null; reload: () => void } {
  const [blockedIds, setBlockedIds] = useState<ReadonlySet<string> | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      setBlockedIds(new Set());
      return;
    }
    setBlockedIds(await fetchBlockedUserIds(discoveryBlocksClient, uid));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { blockedIds, reload: () => void load() };
}
