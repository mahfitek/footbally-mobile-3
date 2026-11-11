// Apple Uygulama İçi Satın Alma (IAP) yapılandırması: ürün ID'leri, DB plan eşlemesi,
// yedek fiyatlar ve yasal bağlantılar tek yerde tutulur. Burada gizli değer bulunmaz.

export type IapPlanId = 'monthly' | 'yearly';
export type IapDbPlan = 'Monthly' | 'Annual';

// ID'ler App Store Connect'teki ürünlerle birebir aynıdır ("Footbally Premium" grubu).
// fallbackPrice (TL), StoreKit fiyatı okunamadığında gösterilir.
export const IAP_PRODUCTS: Record<IapPlanId, { productId: string; dbPlan: IapDbPlan; fallbackPrice: number }> = {
  monthly: { productId: 'com.footbally.app.premium.monthly', dbPlan: 'Monthly', fallbackPrice: 99 },
  yearly: { productId: 'com.footbally.app.premium.yearly', dbPlan: 'Annual', fallbackPrice: 999 },
};

export const IAP_PRODUCT_IDS: string[] = Object.values(IAP_PRODUCTS).map((p) => p.productId);

export const IAP_VERIFY_FUNCTION = 'verify-apple-subscription';

export const IAP_LINKS = {
  terms: 'https://www.getfootbally.com/kullanim-kosullari',
  privacy: 'https://www.getfootbally.com/privacy',
};

export function planIdForProductId(productId: string): IapPlanId | null {
  const entry = (Object.keys(IAP_PRODUCTS) as IapPlanId[]).find((id) => IAP_PRODUCTS[id].productId === productId);
  return entry ?? null;
}

export type IapTrialUnit = 'day' | 'week' | 'month' | 'year';
export type IapFreeTrial = { unit: IapTrialUnit; count: number };

type OfferLike = {
  type?: string | null;
  paymentMode?: string | null;
  period?: { unit?: string | null; value?: number | null } | null;
  periodCount?: number | null;
};

// StoreKit'in tanıtım teklifinden (introductory offer) ücretsiz deneme süresini çıkarır.
// Ücretsiz deneme değilse ya da süre okunamıyorsa null döner; ekranda deneme metni gösterilmez.
export function freeTrialFromOffers(offers: OfferLike[] | null | undefined): IapFreeTrial | null {
  const intro = (offers ?? []).find((o) => o.type === 'introductory' && o.paymentMode === 'free-trial');
  const unit = intro?.period?.unit;
  const value = intro?.period?.value ?? 0;
  if (unit !== 'day' && unit !== 'week' && unit !== 'month' && unit !== 'year') return null;
  const count = value * (intro?.periodCount ?? 1);
  return count > 0 ? { unit, count } : null;
}
