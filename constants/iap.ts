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

// Ücretsiz deneme süresi. Birim yalnızca day | month | year olur; hafta güne çevrilir.
export type IapTrialUnit = 'day' | 'month' | 'year';
export type IapFreeTrial = { unit: IapTrialUnit; count: number };

type OfferLike = {
  type?: string | null;
  paymentMode?: string | null;
  period?: { unit?: string | null; value?: number | null } | null;
  periodCount?: number | null;
};

// StoreKit tanıtım teklifinden (introductory, free-trial) ücretsiz deneme süresini okur.
// Süre, birim ve dönem sayısı StoreKit'ten gelir; sabit değer kullanılmaz.
// Teklif yoksa ya da süre okunamıyorsa null döner.
export function freeTrialFromOffers(offers: OfferLike[] | null | undefined): IapFreeTrial | null {
  const intro = (offers ?? []).find((o) => o.type === 'introductory' && o.paymentMode === 'free-trial');
  const unit = intro?.period?.unit;
  const value = intro?.period?.value ?? 0;
  const periods = intro?.periodCount ?? 1;
  const total = value * periods;
  if (total <= 0) return null;
  if (unit === 'week') return { unit: 'day', count: total * 7 };
  if (unit === 'day' || unit === 'month' || unit === 'year') return { unit, count: total };
  return null;
}

// Deneme yalnızca StoreKit uygunluğu doğrulandıysa gösterilir. Daha önce abone olmuş
// ya da uygunluk okunamadıysa null döner ve ekranda yalnızca normal fiyat kalır.
export function trialIfEligible(offers: OfferLike[] | null | undefined, eligible: boolean): IapFreeTrial | null {
  return eligible ? freeTrialFromOffers(offers) : null;
}

// Para birimi biçimi. Intl başarısız olursa ₺ ile yazılır. Gruplama kapalı: "₺1188".
export function formatMoney(amount: number, currency: string = 'TRY', locale: string = 'tr-TR'): string {
  const rounded = Math.round(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      useGrouping: false,
    }).format(rounded);
  } catch {
    return `₺${rounded}`;
  }
}

// Yıllık kartta gösterilen üstü çizili fiyat ve tasarruf.
// Üstü çizili fiyat = 12 × aylık fiyat (StoreKit'ten; yoksa sabit 12 × 99 = 1188).
// Tasarruf = üstü çizili fiyat − yıllık fiyat (StoreKit'ten; yoksa 999). Yoksa bile 189 döner.
export function yearlySaving(monthlyPrice: number | null, yearlyPrice: number | null): { strike: number; savings: number } {
  const strike = monthlyPrice != null ? Math.round(12 * monthlyPrice) : 12 * IAP_PRODUCTS.monthly.fallbackPrice;
  const yearly = yearlyPrice ?? IAP_PRODUCTS.yearly.fallbackPrice;
  return { strike, savings: strike - yearly };
}
