import { Platform } from 'react-native';
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  getPendingTransactionsIOS,
  restorePurchases,
  isEligibleForIntroOfferIOS,
  purchaseUpdatedListener,
  purchaseErrorListener,
  isUserCancelledError,
  getTransactionJwsIOS,
} from 'expo-iap';
import { supabase } from './supabase';
import { fetchPremiumStatus } from './premium';
import { createIapFlow, IAP_TIMEOUTS, type IapOutcome } from './iapFlow';
export type { IapOutcome } from './iapFlow';
import {
  IAP_PRODUCTS,
  IAP_PRODUCT_IDS,
  IAP_VERIFY_FUNCTION,
  freeTrialFromOffers,
  planIdForProductId,
  trialIfEligible,
  type IapFreeTrial,
  type IapPlanId,
} from '../constants/iap';

// Apple IAP akışı (yalnızca iOS). İstemci hiçbir makbuz/JWS doğrulaması yapmaz:
// StoreKit'in verdiği imzalı işlem (JWS) olduğu gibi Edge Function'a gönderilir.
// İşlem, sunucu yanıtından SONRA ve yalnızca kesin sonuçta bitirilir (finishTransaction):
// ok. Doğrulama hatalarında bitirilmez; StoreKit işlemi sonraki
// açılışta yeniden sunar ve senkronizasyon tekrar dener.

export type IapPlanStore = {
  displayPrice: string;
  price: number | null;
  currency: string | null;
  // Yalnızca StoreKit ücretsiz deneme teklifi varsa ve kullanıcı hâlâ uygunsa doludur.
  trial: IapFreeTrial | null;
};

export type IapStoreInfo = {
  plans: Partial<Record<IapPlanId, IapPlanStore>>;
};

let connection: Promise<boolean> | null = null;
const ensureConnection = () => {
  connection ??= new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('iap_connection_timeout')), IAP_TIMEOUTS.store);
    Promise.resolve().then(() => initConnection()).then((connected) => {
      if (!connected) throw new Error('iap_connection_failed');
      resolve(true);
    }).catch(reject).finally(() => clearTimeout(timer));
  }).catch((err) => {
    connection = null;
    throw err;
  });
  return connection;
};

export async function loadIapStoreInfo(): Promise<IapStoreInfo> {
  const info: IapStoreInfo = { plans: {} };
  if (Platform.OS !== 'ios') return info;
  await ensureConnection();
  const products = (await fetchProducts({ skus: IAP_PRODUCT_IDS, type: 'subs' })) ?? [];
  for (const product of products) {
    const planId = planIdForProductId(product.id);
    if (!planId) continue;
    const plan: IapPlanStore = {
      displayPrice: product.displayPrice,
      price: product.price ?? null,
      currency: product.currency ?? null,
      trial: null,
    };
    info.plans[planId] = plan;
    if (product.platform !== 'ios' || product.type !== 'subs') continue;
    const groupId = product.subscriptionGroupIdIOS;
    if (!groupId || !freeTrialFromOffers(product.subscriptionOffers)) continue;
    // Uygunluk doğrulanamazsa deneme vaat edilmez; normal fiyat gösterilir.
    const eligible = await isEligibleForIntroOfferIOS(groupId).catch(() => false);
    plan.trial = trialIfEligible(product.subscriptionOffers, eligible);
  }
  return info;
}

// No receipt, token or personal data is logged.
const flow = createIapFlow({
  connect: ensureConnection,
  hasActive: async (userId) => (await fetchPremiumStatus(userId)).active,
  listen: purchaseUpdatedListener,
  listenError: purchaseErrorListener,
  request: (sku, userId) => requestPurchase({
    request: { apple: { sku, appAccountToken: userId, andDangerouslyFinishTransactionAutomatically: false } },
    type: 'subs',
  }),
  jws: getTransactionJwsIOS,
  verify: async (signedTransactionInfo, signal) => {
    const { data, error } = await supabase.functions.invoke(IAP_VERIFY_FUNCTION, {
      body: { signedTransactionInfo }, signal, timeout: 30_000,
    });
    if (!error) return data ?? { ok: false };
    const context = (error as { context?: unknown }).context;
    const body = context instanceof Response ? await context.json().catch(() => null) : null;
    return { ok: false, error: body?.error, status: context instanceof Response ? context.status : undefined };
  },
  finish: (purchase) => finishTransaction({ purchase, isConsumable: false }),
  restore: restorePurchases,
  available: async () => (await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true })) ?? [],
  unfinished: async () => (await getPendingTransactionsIOS()) ?? [],
  knownProduct: (sku) => planIdForProductId(sku) !== null,
  cancelled: isUserCancelledError,
  log: (stage, result) => { if (__DEV__) console.warn('IAP', stage, result); },
});

export async function purchasePremium(planId: IapPlanId, userId: string | null): Promise<IapOutcome> {
  if (Platform.OS !== 'ios' || !userId) return 'error';
  return flow.purchase(IAP_PRODUCTS[planId].productId, userId);
}

export async function syncApplePurchases(restore = false): Promise<IapOutcome> {
  if (Platform.OS !== 'ios') return 'none';
  const outcome = await flow.sync(restore);
  for (const listener of statusListeners) listener();
  return outcome;
}

const statusListeners = new Set<() => void>();
export function onIapStatusChanged(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => { statusListeners.delete(listener); };
}
