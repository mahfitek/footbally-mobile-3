/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IAP_PRODUCTS, IAP_PRODUCT_IDS, freeTrialFromOffers, planIdForProductId } from '../constants/iap';

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

test('freeTrialFromOffers: 2 aylık ücretsiz deneme tanıtım teklifinden okunur', () => {
  const offers = [{ type: 'introductory', paymentMode: 'free-trial', period: { unit: 'month', value: 2 }, periodCount: 1 }];
  assert.deepEqual(freeTrialFromOffers(offers), { unit: 'month', count: 2 });
});

test('freeTrialFromOffers: dönem sayısı süreyle çarpılır', () => {
  const offers = [{ type: 'introductory', paymentMode: 'free-trial', period: { unit: 'week', value: 1 }, periodCount: 2 }];
  assert.deepEqual(freeTrialFromOffers(offers), { unit: 'week', count: 2 });
});

test('freeTrialFromOffers: ücretsiz deneme yoksa null döner', () => {
  assert.equal(freeTrialFromOffers(null), null);
  assert.equal(freeTrialFromOffers([]), null);
  assert.equal(freeTrialFromOffers([{ type: 'promotional', paymentMode: 'free-trial', period: { unit: 'month', value: 2 } }]), null);
  assert.equal(freeTrialFromOffers([{ type: 'introductory', paymentMode: 'pay-as-you-go', period: { unit: 'month', value: 2 } }]), null);
  assert.equal(freeTrialFromOffers([{ type: 'introductory', paymentMode: 'free-trial', period: { unit: 'unknown', value: 2 } }]), null);
});
