/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IAP_PRODUCTS,
  IAP_PRODUCT_IDS,
  formatMoney,
  freeTrialFromOffers,
  planIdForProductId,
  trialIfEligible,
  yearlySaving,
} from '../constants/iap';

const trialOffer = (unit: string, value: number, periodCount = 1) => ({
  type: 'introductory',
  paymentMode: 'free-trial',
  period: { unit, value },
  periodCount,
});

test('ürün ID ve DB plan eşlemesi App Store Connect ile birebir aynıdır', () => {
  assert.equal(IAP_PRODUCTS.monthly.productId, 'com.footbally.app.premium.monthly');
  assert.equal(IAP_PRODUCTS.monthly.dbPlan, 'Monthly');
  assert.equal(IAP_PRODUCTS.yearly.productId, 'com.footbally.app.premium.yearly');
  assert.equal(IAP_PRODUCTS.yearly.dbPlan, 'Annual');
  assert.deepEqual(IAP_PRODUCT_IDS, ['com.footbally.app.premium.monthly', 'com.footbally.app.premium.yearly']);
});

test('planIdForProductId yalnızca bilinen ürünleri eşler', () => {
  assert.equal(planIdForProductId('com.footbally.app.premium.yearly'), 'yearly');
  assert.equal(planIdForProductId('com.footbally.app.premium.monthly'), 'monthly');
  assert.equal(planIdForProductId('com.other.app.premium'), null);
});

test('freeTrialFromOffers: 1 haftalık ücretsiz deneme 7 gün olarak okunur', () => {
  assert.deepEqual(freeTrialFromOffers([trialOffer('week', 1)]), { unit: 'day', count: 7 });
});

test('freeTrialFromOffers: süre StoreKit değerinden okunur, sabit yazılmaz', () => {
  assert.deepEqual(freeTrialFromOffers([trialOffer('month', 2)]), { unit: 'month', count: 2 });
  assert.deepEqual(freeTrialFromOffers([trialOffer('week', 1, 2)]), { unit: 'day', count: 14 });
});

test('freeTrialFromOffers: ücretsiz deneme yoksa veya süre okunamıyorsa null döner', () => {
  assert.equal(freeTrialFromOffers(null), null);
  assert.equal(freeTrialFromOffers([]), null);
  assert.equal(freeTrialFromOffers([{ type: 'promotional', paymentMode: 'free-trial', period: { unit: 'week', value: 1 } }]), null);
  assert.equal(freeTrialFromOffers([{ type: 'introductory', paymentMode: 'pay-as-you-go', period: { unit: 'week', value: 1 } }]), null);
  assert.equal(freeTrialFromOffers([trialOffer('unknown', 1)]), null);
  assert.equal(freeTrialFromOffers([trialOffer('week', 0)]), null);
});

test('deneme metni yalnızca uygunlukta görünür (aylık ve yıllık için aynı kural)', () => {
  const offers = [trialOffer('week', 1)];
  assert.deepEqual(trialIfEligible(offers, true), { unit: 'day', count: 7 });
  assert.equal(trialIfEligible(offers, false), null);
  assert.equal(trialIfEligible(null, true), null);
});

test('tasarruf 12 × aylık − yıllık = 189 (StoreKit fiyatlarıyla)', () => {
  const s = yearlySaving(99, 999);
  assert.equal(s.strike, 1188);
  assert.equal(s.savings, 189);
  assert.equal(s.savings, 12 * 99 - 999);
});

test('tasarruf satırı her durumda hesaplanır; fiyat okunamazsa sabit değerler kullanılır', () => {
  assert.deepEqual(yearlySaving(null, null), { strike: 1188, savings: 189 });
  assert.deepEqual(yearlySaving(null, 999), { strike: 1188, savings: 189 });
  assert.deepEqual(yearlySaving(99, null), { strike: 1188, savings: 189 });
});

test('formatMoney üstü çizili fiyatı gruplamadan yazar (₺1188)', () => {
  assert.equal(formatMoney(1188, 'TRY', 'tr-TR'), '₺1188');
  assert.equal(formatMoney(189, 'TRY', 'tr-TR'), '₺189');
});
