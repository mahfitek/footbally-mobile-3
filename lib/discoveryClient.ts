// Keşfet verisi için Supabase istemci sarmalayıcıları (lib/discovery.ts saf kuralları kullanır).
import { supabase } from './supabase';

export const discoveryRpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => supabase.rpc(fn, args),
};

type BlockedRowsQuery = {
  eq: (column: string, value: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

// Tipleri açıkça daraltılmış: genel Supabase tip çıkarımı derin örnekleme yapıp derleyiciyi zorluyordu.
export const discoveryBlocksClient = {
  from: (table: string) => ({
    select: (columns: string) => supabase.from(table).select(columns) as unknown as BlockedRowsQuery,
  }),
};
