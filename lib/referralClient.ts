// Davet RPC'lerini Supabase istemcisi üzerinden çağıran ince sarmalayıcı (ekranlar kullanır).
// Saf kurallar lib/referral.ts içindedir ve Supabase'e bağlı değildir.
import { supabase } from './supabase';

export const referralRpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => supabase.rpc(fn, args),
};
