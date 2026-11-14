/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Purchase, PurchaseIOS } from 'expo-iap';
import { createIapFlow, type IapDependencies } from '../lib/iapFlow';

const never = () => new Promise<never>(() => {});
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const transaction = (overrides: Partial<PurchaseIOS> = {}): PurchaseIOS => ({
  id: 'tx1', transactionId: 'tx1', productId: 'monthly', store: 'apple', storeId: 'apple',
  quantity: 1, isAutoRenewing: true,
  purchaseState: 'purchased', purchaseToken: 'test-jws', transactionDate: Date.now(),
  appAccountToken: 'user', ...overrides,
});
function setup(overrides: Partial<IapDependencies> = {}) {
  let update: (p: Purchase) => void = () => {};
  let error: (e: unknown) => void = () => {};
  let removed = 0;
  let verified = 0;
  let finished = 0;
  let options: unknown;
  const deps: IapDependencies = {
    connect: async () => true, hasActive: async () => false,
    listen: (fn, opts) => { update = fn; options = opts; return { remove: () => { removed++; } }; },
    listenError: (fn) => { error = fn; return { remove: () => { removed++; } }; },
    request: async () => null, jws: async () => 'fallback-jws',
    verify: async () => { verified++; return { ok: true, active: true, transaction: { id: 'tx1', productId: 'monthly', purchaseDate: Date.now(), reason: 'PURCHASE', appAccountToken: 'user' } }; },
    finish: async () => { finished++; }, restore: async () => {},
    available: async () => [], unfinished: async () => [],
    knownProduct: (sku) => ['monthly', 'yearly'].includes(sku),
    cancelled: (e) => (e as { code?: string })?.code === 'cancelled', log: () => {},
    ...overrides,
  };
  const flow = createIapFlow(deps, { purchase: 80, restore: 80, store: 20, jws: 20, verify: 20, finish: 20 });
  return { flow, update: (p: Purchase) => update(p), error: (e: unknown) => error(e),
    counts: () => ({ removed, verified, finished }), options: () => options };
}

test('no event: purchase times out, removes listeners and permits another attempt', async () => {
  const h = setup();
  assert.equal(await h.flow.purchase('monthly', 'user'), 'timeout');
  assert.equal(h.counts().removed, 2);
  const retry = h.flow.purchase('monthly', 'user');
  await tick(); h.update(transaction());
  assert.equal(await retry, 'success');
});
test('connection stall and request rejection both terminate', async () => {
  assert.equal(await setup({ connect: never }).flow.purchase('monthly', 'user'), 'timeout');
  const h = setup({ request: async () => { throw Error('native'); } });
  assert.equal(await h.flow.purchase('monthly', 'user'), 'error');
  assert.equal(h.counts().removed, 2);
});
test('stale, unrelated product and foreign account events cannot own a new attempt', async () => {
  const h = setup();
  const promise = h.flow.purchase('monthly', 'user');
  await tick();
  h.update(transaction({ transactionDate: Date.now() - 60_000 }));
  h.update(transaction({ productId: 'yearly' }));
  h.update(transaction({ appAccountToken: 'other' }));
  h.error({ productId: 'yearly', code: 'cancelled' });
  assert.equal(h.counts().verified, 0);
  h.update(transaction());
  assert.equal(await promise, 'success');
});
test('repeated events and native return verify and finish only once; SDK dedupe disabled', async () => {
  let release: (p: Purchase) => void = () => {};
  const h = setup({ request: () => new Promise((resolve) => { release = resolve; }) });
  const promise = h.flow.purchase('monthly', 'user'); await tick();
  const p = transaction(); h.update(p); h.update(p); release(p);
  assert.equal(await promise, 'success');
  assert.deepEqual(h.options(), { dedupeTransactionIOS: false });
  assert.equal(h.counts().verified, 1); assert.equal(h.counts().finished, 1);
});
test('native return recovers a reused transaction even without an event', async () => {
  const h = setup({ request: async () => transaction({ transactionDate: 1 }) });
  assert.equal(await h.flow.purchase('monthly', 'user'), 'existing');
});
test('cancel and deferred purchase terminate without verification', async () => {
  const h = setup(); let p = h.flow.purchase('monthly', 'user'); await tick();
  h.error({ code: 'cancelled' }); assert.equal(await p, 'cancelled');
  p = h.flow.purchase('monthly', 'user'); await tick();
  h.update(transaction({ purchaseState: 'pending' })); assert.equal(await p, 'pending');
  assert.equal(h.counts().verified, 0);
});
test('JWS stall/rejection cannot call server or finish', async () => {
  for (const jws of [never, async () => { throw Error('jws'); }]) {
    const h = setup({ jws }); const p = h.flow.purchase('monthly', 'user'); await tick();
    h.update(transaction({ purchaseToken: null }));
    assert.equal(await p, jws === never ? 'timeout' : 'error');
    assert.equal(h.counts().verified, 0); assert.equal(h.counts().finished, 0);
  }
});
test('JWS fallback succeeds when purchase token is absent', async () => {
  const h = setup(); const p = h.flow.purchase('monthly', 'user'); await tick();
  h.update(transaction({ purchaseToken: null })); assert.equal(await p, 'success');
});
test('failed/malformed verification never grants access or finishes', async () => {
  for (const result of [{ ok: false, status: 502 }, { ok: true }, { ok: false, status: 409 }]) {
    const h = setup({ verify: async () => result });
    const p = h.flow.purchase('monthly', 'user'); await tick(); h.update(transaction());
    assert.equal(await p, 'error'); assert.equal(h.counts().finished, 0);
  }
});
test('verification timeout aborts network and late success cannot finish', async () => {
  let signal: AbortSignal | undefined;
  let release: (result: { ok: boolean; active: boolean }) => void = () => {};
  const h = setup({ verify: (_, s) => { signal = s; return new Promise((resolve) => { release = resolve; }); } });
  const p = h.flow.purchase('monthly', 'user'); await tick(); h.update(transaction());
  assert.equal(await p, 'timeout'); assert.equal(signal?.aborted, true);
  release({ ok: true, active: true }); await tick(); assert.equal(h.counts().finished, 0);
});
test('finish stall/rejection cannot hang a verified purchase', async () => {
  for (const finish of [never, async () => { throw Error('finish'); }]) {
    const h = setup({ finish }); const p = h.flow.purchase('monthly', 'user'); await tick();
    h.update(transaction()); assert.equal(await p, 'success'); assert.equal(h.counts().removed, 2);
  }
});
test('inactive verified transaction is not reported as premium', async () => {
  const h = setup({ verify: async () => ({ ok: true, active: false }) });
  const p = h.flow.purchase('monthly', 'user'); await tick(); h.update(transaction());
  assert.equal(await p, 'none'); assert.equal(h.counts().finished, 1);
});
test('failed verification is retryable through unfinished transactions on restore', async () => {
  let attempts = 0;
  const p = transaction({ transactionDate: 1 });
  const h = setup({ request: async () => p, unfinished: async () => [p],
    verify: async () => ({ ok: ++attempts > 1, active: true }) });
  assert.equal(await h.flow.purchase('monthly', 'user'), 'error');
  assert.equal(h.counts().finished, 0);
  assert.equal(await h.flow.sync(true), 'restored'); assert.equal(h.counts().finished, 1);
});
test('restore merges active and unfinished transactions without duplicate verification', async () => {
  const p = transaction();
  const h = setup({ available: async () => [p], unfinished: async () => [p] });
  assert.equal(await h.flow.sync(true), 'restored'); assert.equal(h.counts().verified, 1);
});
test('restore stalls return timeout and still allow a later retry', async () => {
  assert.equal(await setup({ restore: never }).flow.sync(true), 'timeout');
  assert.equal(await setup({ available: never, unfinished: never }).flow.sync(), 'timeout');
});
test('concurrent purchase is not started twice; callbacks after timeout do nothing', async () => {
  const h = setup(); const p = h.flow.purchase('monthly', 'user');
  assert.equal(await h.flow.purchase('monthly', 'user'), 'pending');
  assert.equal(await p, 'timeout'); h.update(transaction()); await tick();
  assert.equal(h.counts().verified, 0);
});

test('a still-open native request is not duplicated after UI timeout; restore remains usable', async () => {
  let requests = 0;
  const h = setup({ request: () => { requests++; return never(); } });
  assert.equal(await h.flow.purchase('monthly', 'user'), 'timeout');
  assert.equal(await h.flow.purchase('monthly', 'user'), 'timeout');
  assert.equal(requests, 1);
  assert.equal(await h.flow.sync(true), 'none');
});

test('verification rejection and confirmed account conflict preserve unfinished transaction', async () => {
  for (const verify of [async () => { throw Error('network'); }, async () => ({ ok: false, error: 'already_linked', status: 409 })]) {
    const h = setup({ verify }); const p = h.flow.purchase('monthly', 'user'); await tick();
    h.update(transaction()); assert.ok(['error', 'already_linked'].includes(await p));
    assert.equal(h.counts().finished, 0);
  }
});

for (const sku of ['monthly', 'yearly']) {
  test(`${sku}: active backend subscription blocks payment for either plan`, async () => {
    let requests = 0;
    const h = setup({ hasActive: async () => true, request: async () => { requests++; return null; } });
    assert.equal(await h.flow.purchase(sku, 'user'), 'existing');
    assert.equal(requests, 0);
  });
  test(`${sku}: existing Apple entitlement in the other plan is verified before payment`, async () => {
    let requests = 0;
    const h = setup({ available: async () => [transaction({ productId: sku === 'monthly' ? 'yearly' : 'monthly' })],
      request: async () => { requests++; return null; } });
    assert.equal(await h.flow.purchase(sku, 'user'), 'existing');
    assert.equal(requests, 0); assert.equal(h.counts().verified, 1);
  });
  test(`${sku}: failed preflight verification cannot grant access or open payment`, async () => {
    let requests = 0;
    const h = setup({ available: async () => [transaction({ productId: sku })], verify: async () => ({ ok: false }),
      request: async () => { requests++; return null; } });
    assert.equal(await h.flow.purchase(sku, 'user'), 'error');
    assert.equal(requests, 0); assert.equal(h.counts().finished, 0);
  });
  for (const reason of ['PURCHASE', 'RENEWAL', '']) {
    test(`${sku}: server reason ${reason || 'unknown'} determines new purchase announcement`, async () => {
      let p: Purchase;
      const h = setup({ request: async () => (p = transaction({ productId: sku })),
        verify: async () => ({ ok: true, active: true, transaction: {
          id: p.transactionId!, productId: sku, purchaseDate: p.transactionDate, reason, appAccountToken: 'user',
        } }) });
      assert.equal(await h.flow.purchase(sku, 'user'), reason === 'PURCHASE' ? 'success' : 'existing');
    });
  }
  test(`${sku}: automatic sync and explicit restore have distinct non-purchase outcomes`, async () => {
    const h = setup({ available: async () => [transaction({ productId: sku })] });
    assert.equal(await h.flow.sync(), 'synced');
    assert.equal(await h.flow.sync(true), 'restored');
  });
  test(`${sku}: old native return never announces a new purchase`, async () => {
    const h = setup({ request: async () => transaction({ productId: sku, transactionDate: 1 }),
      verify: async () => ({ ok: true, active: true, transaction: {
        id: 'tx1', productId: sku, purchaseDate: 1, reason: 'PURCHASE', appAccountToken: 'user',
      } }) });
    assert.equal(await h.flow.purchase(sku, 'user'), 'existing');
  });
}

test('unknown backend status prevents a purchase instead of assuming inactive', async () => {
  const h = setup({ hasActive: async () => { throw Error('network'); } });
  assert.equal(await h.flow.purchase('monthly', 'user'), 'error');
  assert.equal(h.counts().verified, 0);
});

for (const fields of [{ id: 'different' }, { productId: 'yearly' }, { purchaseDate: 1 }, { appAccountToken: 'other' }]) {
  test(`verified transaction mismatch ${Object.keys(fields)[0]} cannot announce new purchase`, async () => {
    const h = setup({ request: async () => transaction(), verify: async () => ({ ok: true, active: true,
      transaction: { id: 'tx1', productId: 'monthly', purchaseDate: Date.now(), reason: 'PURCHASE', appAccountToken: 'user', ...fields },
    }) });
    assert.equal(await h.flow.purchase('monthly', 'user'), 'existing');
  });
}

test('older backend without transaction metadata can only recover access', async () => {
  const h = setup({ request: async () => transaction(), verify: async () => ({ ok: true, active: true }) });
  assert.equal(await h.flow.purchase('monthly', 'user'), 'existing');
});
