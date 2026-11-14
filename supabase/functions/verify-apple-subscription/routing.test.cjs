const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics.length, 0);

async function verify(environment, appleStatus, appleTransaction) {
  const calls = [];
  let handler;
  class SignJWT {
    setProtectedHeader() { return this; }
    setIssuer() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    setAudience() { return this; }
    async sign() { return 'test-bearer'; }
  }
  vm.runInNewContext(compiled.outputText, {
    exports: {}, Request, Response, TextDecoder, Uint8Array, atob,
    console: { error() {} },
    require(name) {
      if (name.includes('supabase-js')) return {
        createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'test-user' } } }) },
          from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [] }) }) }),
            insert: async () => ({ error: null }) }),
        }),
      };
      if (name.includes('jose')) return { SignJWT, importPKCS8: async () => ({}) };
      throw new Error(`Unexpected import: ${name}`);
    },
    Deno: {
      env: { get: (name) => name === 'APPLE_BUNDLE_ID' ? 'com.footbally.app' : 'test-only' },
      serve: (fn) => { handler = fn; },
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const signed = appleTransaction && `header.${Buffer.from(JSON.stringify(appleTransaction)).toString('base64url')}.signature`;
      return new Response(JSON.stringify({ data: signed ? [{ lastTransactions: [{ signedTransactionInfo: signed }] }] : [] }), { status: appleStatus });
    },
  });
  const payload = {
    bundleId: 'com.footbally.app', productId: 'com.footbally.app.premium.monthly',
    appAccountToken: 'test-user', originalTransactionId: 'test/transaction', environment,
  };
  const signedTransactionInfo = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
  const response = await handler(new Request('https://example.test', {
    method: 'POST', headers: { Authorization: 'Bearer test-user-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransactionInfo }),
  }));
  return { calls, status: response.status, body: await response.json() };
}

for (const reason of ['PURCHASE', 'RENEWAL']) {
  test(`response transaction identity and ${reason} reason come from Apple`, async () => {
    const date = Date.now();
    const result = await verify('Sandbox', 200, {
      originalTransactionId: 'test/transaction', transactionId: 'apple-transaction',
      productId: 'com.footbally.app.premium.monthly', purchaseDate: date,
      expiresDate: date + 300000, transactionReason: reason, appAccountToken: 'test-user',
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.active, true);
    assert.deepEqual(result.body.transaction, { id: 'apple-transaction', productId: 'com.footbally.app.premium.monthly',
      purchaseDate: date, reason, appAccountToken: 'test-user' });
  });
}

for (const [environment, host] of [
  ['Sandbox', 'https://api.storekit-sandbox.apple.com'],
  ['Production', 'https://api.storekit.apple.com'],
]) {
  for (const status of [200, 404, 401, 500]) {
    test(`${environment}: Apple ${status} uses only its own API`, async () => {
      const result = await verify(environment, status);
      assert.equal(result.calls.length, 1);
      assert.equal(result.calls[0].url, `${host}/inApps/v1/subscriptions/test%2Ftransaction`);
      assert.equal(result.calls[0].options.headers.Authorization, 'Bearer test-bearer');
      assert.equal(result.status, status === 200 || status === 404 ? 400 : 502);
      assert.equal(result.body.error, status === 200 || status === 404 ? 'apple_not_found' : 'apple_unavailable');
    });
  }
}

for (const environment of [undefined, null, '', 'sandbox', 'Xcode', 'https://example.test']) {
  test(`Reject invalid environment: ${environment}`, async () => {
    const result = await verify(environment, 200);
    assert.equal(result.calls.length, 0);
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'invalid_environment');
  });
}
