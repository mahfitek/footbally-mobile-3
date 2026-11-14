import { createClient } from "npm:@supabase/supabase-js@2";
import * as jose from "npm:jose@5.9.6";

const PLANS: Record<string, { plan: string; amount: number }> = {
  "com.footbally.app.premium.monthly": { plan: "Monthly", amount: 99 },
  "com.footbally.app.premium.yearly": { plan: "Annual", amount: 999 },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// JWS payload'ını okur; istemci verisi yalnızca yönlendirme ipucudur.
// Abonelik durumu seçilen Apple API'sinden doğrulanır.
function decodePayload(jws: string): Record<string, any> {
  const part = jws.split(".")[1];
  if (!part) throw new Error("bad_jws");
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function appleBearer(): Promise<string> {
  const pem = Deno.env.get("APPLE_PRIVATE_KEY")!.replace(/\\n/g, "\n");
  const key = await jose.importPKCS8(pem, "ES256");
  return await new jose.SignJWT({ bid: Deno.env.get("APPLE_BUNDLE_ID")! })
    .setProtectedHeader({ alg: "ES256", kid: Deno.env.get("APPLE_KEY_ID")!, typ: "JWT" })
    .setIssuer(Deno.env.get("APPLE_ISSUER_ID")!)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience("appstoreconnect-v1")
    .sign(key);
}

type AppleEnvironment = "Sandbox" | "Production";

async function fetchSubscriptionStatus(
  originalTxId: string,
  bearer: string,
  environment: AppleEnvironment,
) {
  const host = environment === "Sandbox"
    ? "https://api.storekit-sandbox.apple.com"
    : "https://api.storekit.apple.com";
  const res = await fetch(`${host}/inApps/v1/subscriptions/${encodeURIComponent(originalTxId)}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (res.ok) return await res.json();
  if (res.status === 404) return null;
  const errBody = await res.text();
  console.error("APPLE_HTTP_ERROR", res.status, host, errBody);
  throw new Error(`apple_${res.status}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");

  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await anon.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ ok: false, error: "unauthorized" }, 401);
  const userId = userData.user.id;

  const body = await req.json().catch(() => null);
  const signed = body?.signedTransactionInfo;
  if (typeof signed !== "string") return json({ ok: false, error: "bad_request" }, 400);

  let claims: Record<string, any>;
  try {
    claims = decodePayload(signed);
  } catch {
    return json({ ok: false, error: "bad_transaction" }, 400);
  }

  if (claims.bundleId !== Deno.env.get("APPLE_BUNDLE_ID")) {
    return json({ ok: false, error: "bundle_mismatch" }, 400);
  }
  const product = PLANS[claims.productId];
  if (!product) return json({ ok: false, error: "unknown_product" }, 400);
  if (claims.appAccountToken && claims.appAccountToken !== userId) {
    return json({ ok: false, error: "account_mismatch" }, 403);
  }

  const environment = claims.environment;
  if (environment !== "Sandbox" && environment !== "Production") {
    return json({ ok: false, error: "invalid_environment" }, 400);
  }

  const originalId = String(claims.originalTransactionId);
  let statusRes: any;
  try {
    statusRes = await fetchSubscriptionStatus(originalId, await appleBearer(), environment);
  } catch (e) {
    console.error("APPLE_UNAVAILABLE_REASON", String(e));
    return json({ ok: false, error: "apple_unavailable" }, 502);
  }
  if (!statusRes) return json({ ok: false, error: "apple_not_found" }, 400);

  // Aynı originalTransactionId'nin en güncel işlemini bul.
  let latest: Record<string, any> | null = null;
  for (const group of statusRes.data ?? []) {
    for (const lt of group.lastTransactions ?? []) {
      const info = decodePayload(lt.signedTransactionInfo);
      if (String(info.originalTransactionId) !== originalId) continue;
      if (!latest || Number(info.expiresDate) > Number(latest.expiresDate)) latest = info;
    }
  }
  if (!latest) return json({ ok: false, error: "apple_not_found" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Bir Apple aboneliği yalnızca bir Footbally hesabına bağlanabilir.
  const { data: rows, error: selErr } = await admin
    .from("subscriptions")
    .select("id, user_id")
    .eq("payment_provider", "apple")
    .eq("provider_transaction_id", originalId);
  if (selErr) return json({ ok: false, error: "db_error" }, 500);
  if ((rows ?? []).some((r) => r.user_id !== userId)) {
    return json({ ok: false, error: "already_linked" }, 409);
  }

  const expiresMs = Number(latest.expiresDate);
  const revoked = latest.revocationDate != null;
  const active = !revoked && expiresMs > Date.now();
  const expiresAt = new Date(expiresMs).toISOString();

  const values = {
    plan: product.plan,
    status: active ? "active" : "Cancelled",
    started_at: new Date(Number(latest.purchaseDate)).toISOString(),
    expires_at: expiresAt,
    amount: product.amount,
    currency: "TRY",
    payment_provider: "apple",
    provider_transaction_id: originalId,
  };

  const mine = (rows ?? []).find((r) => r.user_id === userId);
  const { error: writeErr } = mine
    ? await admin.from("subscriptions").update(values).eq("id", mine.id)
    : await admin.from("subscriptions").insert({ ...values, user_id: userId });
  if (writeErr) return json({ ok: false, error: "db_error" }, 500);

  return json({ ok: true, plan: product.plan, expires_at: expiresAt, active,
    transaction: {
      id: String(latest.transactionId),
      productId: latest.productId,
      purchaseDate: Number(latest.purchaseDate),
      reason: latest.transactionReason ?? '',
      appAccountToken: latest.appAccountToken ?? '',
    },
  });
});

