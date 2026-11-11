import { Platform } from 'react-native';
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  restorePurchases,
  isEligibleForIntroOfferIOS,
  purchaseUpdatedListener,
  purchaseErrorListener,
  isUserCancelledError,
  getTransactionJwsIOS,
  type Purchase,
} from 'expo-iap';
import { supabase } from './supabase';
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
// ok ya da 409 already_linked. Diğer hatalarda bitirilmez; StoreKit işlemi sonraki
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

// already_linked: sunucu 409 döndü; bu Apple aboneliği başka bir Footbally hesabına kayıtlı.
export type IapOutcome = 'success' | 'cancelled' | 'pending' | 'none' | 'already_linked' | 'error';

let connection: Promise<boolean> | null = null;
const ensureConnection = () => {
  connection ??= initConnection().catch((err) => {
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

// İşlemi sunucuya doğrulatır; sunucu ok ya da 409 already_linked dönerse işlemi bitirir.
async function verifyAndFinish(purchase: Purchase): Promise<'success' | 'already_linked' | 'error'> {
  if (__DEV__) console.log('IAP purchase nesnesi:', JSON.stringify(purchase));
  let signedTransactionInfo: string | null | undefined = purchase.purchaseToken;
  if (!signedTransactionInfo && Platform.OS === 'ios') {
    signedTransactionInfo = await getTransactionJwsIOS(purchase.productId).catch(() => null);
    if (__DEV__) console.log('IAP JWS fallback:', signedTransactionInfo ? 'var' : 'yok');
  }
  if (!signedTransactionInfo) return 'error';
  const { data, error } = await supabase.functions.invoke(IAP_VERIFY_FUNCTION, {
    body: { signedTransactionInfo },
  });
  if (error || !data?.ok) {
    // 2xx dışı yanıtlarda gövde ({ ok: false, error }) hata nesnesinin context'inde (Response) gelir.
    const context = (error as { context?: unknown } | null)?.context;
    const body = context instanceof Response ? await context.json().catch(() => null) : data;
    const code = typeof body?.error === 'string' ? body.error : null;
    if (__DEV__) console.log('IAP doğrulaması başarısız:', code ?? error?.message);
    const status = context instanceof Response ? context.status : null;
    // Diğer hatalarda (400, 403, 5xx, ağ) işlem bitirilmez; StoreKit yeniden sunar ve tekrar denenir.
    if (code !== 'already_linked' && status !== 409) return 'error';
    // 409: işlem başka bir hesaba kayıtlı. Bitirmek hak vermez; yalnızca işlemin her açılışta
    // kuyruktan yeniden gelmesini önler.
    await finishTransaction({ purchase, isConsumable: false }).catch(() => {});
    return 'already_linked';
  }
  // Premium sunucuda verildi; bitirme hatası kullanıcıya yansıtılmaz, işlem sonraki açılışta yeniden işlenir.
  await finishTransaction({ purchase, isConsumable: false }).catch(() => {});
  return 'success';
}

export async function purchasePremium(planId: IapPlanId, userId: string | null): Promise<IapOutcome> {
  // Sunucu appAccountToken'ı kontrol eder; kullanıcı kimliği olmadan satın alma başlatılmaz.
  if (Platform.OS !== 'ios' || !userId) return 'error';
  await ensureConnection();
  return new Promise<IapOutcome>((resolve) => {
    let handled = false;
    const settle = (outcome: IapOutcome) => {
      updateSub.remove();
      errorSub.remove();
      resolve(outcome);
    };
    const updateSub = purchaseUpdatedListener(async (purchase) => {
      if (handled) return;
      handled = true;
      if (purchase.purchaseState === 'pending') return settle('pending');
      settle(await verifyAndFinish(purchase).catch(() => 'error' as const));
    });
    const onError = (err: unknown) => {
      if (handled) return;
      handled = true;
      if (__DEV__) console.log('IAP satın alma hatası:', err);
      settle(isUserCancelledError(err) ? 'cancelled' : 'error');
    };
    const errorSub = purchaseErrorListener(onError);
    requestPurchase({
      // appAccountToken: kullanıcı kimliği (UUID); sunucu işlemin bu hesaba ait olduğunu bununla doğrular.
      request: { apple: { sku: IAP_PRODUCTS[planId].productId, appAccountToken: userId } },
      type: 'subs',
    }).catch(onError);
  });
}

// Mevcut aktif abonelikleri sunucuyla eşitler. restore = true ise önce App Store ile
// eşitlenir ("Satın alımları geri yükle"); açılışta sessizce (restore = false) çağrılır.
export async function syncApplePurchases(restore = false): Promise<IapOutcome> {
  if (Platform.OS !== 'ios') return 'none';
  try {
    await ensureConnection();
    if (restore) await restorePurchases();
    const purchases = ((await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true })) ?? [])
      .filter((p) => planIdForProductId(p.productId) !== null)
      .sort((a, b) => b.transactionDate - a.transactionDate);
    if (purchases.length === 0) return 'none';
    const results: IapOutcome[] = [];
    for (const purchase of purchases) {
      results.push(await verifyAndFinish(purchase).catch(() => 'error' as const));
    }
    if (results.includes('success')) return 'success';
    return results.includes('already_linked') ? 'already_linked' : 'error';
  } catch (err) {
    if (__DEV__) console.log('IAP senkronizasyon hatası:', err);
    return isUserCancelledError(err) ? 'cancelled' : 'error';
  }
}
