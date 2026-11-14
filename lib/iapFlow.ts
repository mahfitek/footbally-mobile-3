import type { Purchase, PurchaseUpdatedListenerOptions } from 'expo-iap';

export type IapOutcome = 'success' | 'existing' | 'synced' | 'restored' | 'cancelled' | 'pending' | 'none' | 'already_linked' | 'error' | 'timeout';
type Subscription = { remove(): void };
type Verification = { ok?: boolean; active?: boolean; error?: string; status?: number;
  transaction?: { id: string; productId: string; purchaseDate: number; reason: string; appAccountToken: string } };
export interface IapDependencies {
  connect(): Promise<unknown>;
  hasActive(userId: string): Promise<boolean>;
  listen(update: (purchase: Purchase) => void, options: PurchaseUpdatedListenerOptions): Subscription;
  listenError(error: (error: unknown) => void): Subscription;
  request(sku: string, userId: string): Promise<Purchase | Purchase[] | null | undefined>;
  jws(sku: string): Promise<string | null | undefined>;
  verify(jws: string, signal: AbortSignal): Promise<Verification>;
  finish(purchase: Purchase): Promise<unknown>;
  restore(): Promise<unknown>;
  available(): Promise<Purchase[]>;
  unfinished(): Promise<Purchase[]>;
  knownProduct(sku: string): boolean;
  cancelled(error: unknown): boolean;
  log(stage: string, result: string): void;
}

export const IAP_TIMEOUTS = { purchase: 120_000, restore: 90_000, store: 15_000, jws: 10_000, verify: 30_000, finish: 10_000 };
class FlowTimeout extends Error {}

// A late native/network result is consumed, but cannot resume a timed-out stage.
async function bounded<T>(work: () => Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new FlowTimeout();
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    abort = () => reject(new FlowTimeout());
    timer = setTimeout(abort, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve().then(work), deadline]);
  } finally {
    clearTimeout(timer!);
    signal.removeEventListener('abort', abort);
  }
}

export function createIapFlow(deps: IapDependencies, limits = IAP_TIMEOUTS) {
  let purchasing = false;
  let nativeRequestPending = false;
  const failure = (error: unknown): IapOutcome => error instanceof FlowTimeout ? 'timeout'
    : deps.cancelled(error) ? 'cancelled' : 'error';
  const key = (purchase: Purchase) => purchase.transactionId || purchase.id;

  async function verifyAndFinish(purchase: Purchase, signal: AbortSignal, attempt?: { started: number; userId: string }): Promise<IapOutcome> {
    if (purchase.purchaseState === 'pending') return 'pending';
    if (purchase.purchaseState !== 'purchased') return 'error';
    let stage = 'jws';
    const verification = new AbortController();
    const abort = () => verification.abort();
    signal.addEventListener('abort', abort, { once: true });
    try {
      const signed = purchase.purchaseToken || await bounded(() => deps.jws(purchase.productId), limits.jws, signal);
      if (!signed || signal.aborted) return signal.aborted ? 'timeout' : 'error';
      stage = 'verify';
      const result = await bounded(() => deps.verify(signed, verification.signal), limits.verify, signal);
      if (signal.aborted) return 'timeout';
      if (result.ok !== true || typeof result.active !== 'boolean') {
        deps.log(stage, 'rejected');
        // Never finish a transaction whose verification failed.
        return result.status === 409 && result.error === 'already_linked' ? 'already_linked' : 'error';
      }
      stage = 'finish';
      try {
        await bounded(() => deps.finish(purchase), limits.finish, signal);
      } catch (error) {
        // Entitlement was verified. StoreKit retains an unfinished transaction for retry.
        deps.log(stage, error instanceof FlowTimeout ? 'timeout' : 'error');
      }
      if (signal.aborted) return 'timeout';
      if (!result.active) return 'none';
      const tx = result.transaction;
      // Only server-confirmed identity, date and PURCHASE reason may announce a new purchase.
      // Older servers without transaction metadata safely recover access without that announcement.
      const isNew = attempt && tx && tx.id === key(purchase) && tx.productId === purchase.productId
        && tx.purchaseDate >= attempt.started && purchase.transactionDate >= attempt.started
        && tx.reason === 'PURCHASE' && tx.appAccountToken?.toLowerCase() === attempt.userId.toLowerCase();
      return isNew ? 'success' : 'existing';
    } catch (error) {
      const outcome = failure(error);
      deps.log(stage, outcome);
      return outcome;
    } finally {
      verification.abort();
      signal.removeEventListener('abort', abort);
    }
  }

  async function purchase(sku: string, userId: string): Promise<IapOutcome> {
    if (purchasing) return 'pending';
    // A UI timeout cannot cancel Apple's purchase sheet. Restore remains available.
    if (nativeRequestPending) return 'timeout';
    purchasing = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limits.purchase);
    let update: Subscription | undefined;
    let errorListener: Subscription | undefined;
    try {
      if (await bounded(() => deps.hasActive(userId), limits.store, controller.signal)) return 'existing';
      await bounded(deps.connect, limits.store, controller.signal);
      // Reconcile both plans before opening a payment sheet. Unknown verification fails closed.
      const previous = await bounded(async () => [...await deps.available(), ...await deps.unfinished()], limits.store, controller.signal);
      const previousIds = new Set<string>();
      for (const value of previous) {
        if (!deps.knownProduct(value.productId) || previousIds.has(key(value))) continue;
        previousIds.add(key(value));
        const outcome = await verifyAndFinish(value, controller.signal);
        if (outcome !== 'none') return outcome;
      }
      if (await bounded(() => deps.hasActive(userId), limits.store, controller.signal)) return 'existing';
      return await new Promise<IapOutcome>((resolve) => {
        let settled = false;
        let verifying = false;
        const seen = new Set<string>();
        const started = Date.now();
        const settle = (outcome: IapOutcome) => {
          if (settled) return;
          settled = true;
          resolve(outcome);
        };
        controller.signal.addEventListener('abort', () => settle('timeout'), { once: true });
        const onPurchase = (value: Purchase, fromRequest = false) => {
          if (settled || controller.signal.aborted || value.productId !== sku) return;
          if ('appAccountToken' in value && value.appAccountToken && value.appAccountToken.toLowerCase() !== userId.toLowerCase()) return;
          // Historical events do not own this attempt. Restore processes them separately.
          // A result returned by this specific request is correlated even when StoreKit reuses a transaction.
          if (!fromRequest && (!Number.isFinite(value.transactionDate) || value.transactionDate < started)) return;
          if (seen.has(key(value)) && value.purchaseState !== 'pending') return;
          if (value.purchaseState === 'pending') { settle('pending'); return; }
          if (value.purchaseState !== 'purchased') return;
          seen.add(key(value));
          verifying = true;
          void verifyAndFinish(value, controller.signal, previousIds.has(key(value)) ? undefined : { started, userId }).then(settle);
        };
        const onError = (error: unknown) => {
          const productId = (error as { productId?: string } | null)?.productId;
          if (productId && productId !== sku) return;
          // A verified purchase result takes precedence over an unrelated late StoreKit error.
          if (!verifying) settle(failure(error));
        };
        try {
          update = deps.listen(onPurchase, { dedupeTransactionIOS: false });
          errorListener = deps.listenError(onError);
          // Events are primary. The native return is an additional recovery path in 6.4.3.
          nativeRequestPending = true;
          void Promise.resolve().then(() => deps.request(sku, userId)).then((result) => {
            nativeRequestPending = false;
            for (const value of Array.isArray(result) ? result : result ? [result] : []) onPurchase(value, true);
          }).catch((error) => {
            nativeRequestPending = false;
            onError(error);
          });
        } catch (error) {
          settle(failure(error));
        }
      });
    } catch (error) {
      return failure(error);
    } finally {
      controller.abort();
      clearTimeout(timer);
      try { update?.remove(); } catch { deps.log('listener', 'cleanup_error'); }
      try { errorListener?.remove(); } catch { deps.log('listener', 'cleanup_error'); }
      purchasing = false;
    }
  }

  async function sync(restore = false): Promise<IapOutcome> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limits.restore);
    try {
      await bounded(deps.connect, limits.store, controller.signal);
      if (restore) await bounded(deps.restore, limits.store, controller.signal);
      const lists = await Promise.allSettled([
        bounded(deps.available, limits.store, controller.signal),
        bounded(deps.unfinished, limits.store, controller.signal),
      ]);
      const unique = new Map<string, Purchase>();
      for (const list of lists) if (list.status === 'fulfilled') {
        for (const value of list.value) if (deps.knownProduct(value.productId)) unique.set(key(value), value);
      }
      const results: IapOutcome[] = [];
      for (const value of [...unique.values()].sort((a, b) => b.transactionDate - a.transactionDate)) {
        results.push(await verifyAndFinish(value, controller.signal));
        if (controller.signal.aborted) break;
      }
      if (results.includes('existing')) return restore ? 'restored' : 'synced';
      if (controller.signal.aborted || results.includes('timeout')) return 'timeout';
      const rejected = lists.find((list) => list.status === 'rejected');
      if (rejected?.status === 'rejected') return failure(rejected.reason);
      if (results.includes('error')) return 'error';
      if (results.includes('already_linked')) return 'already_linked';
      if (results.includes('pending')) return 'pending';
      return 'none';
    } catch (error) {
      return failure(error);
    } finally {
      controller.abort();
      clearTimeout(timer);
    }
  }
  return { purchase, sync };
}
