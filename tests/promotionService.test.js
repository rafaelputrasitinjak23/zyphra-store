const test = require('node:test');
const assert = require('node:assert/strict');
const { getProductPriceInfo } = require('../services/productPricingService');
const { calculateDiscountAmount, eligibleSubtotalForItems, normalizeCode } = require('../services/discountService');

test('flash sale aktif menggantikan harga promo hanya selama periode aktif', () => {
  const now = new Date('2026-06-17T05:00:00.000Z');
  const product = {
    price: 100000,
    promoPrice: 90000,
    flashSale: {
      enabled: true,
      price: 65000,
      startsAt: new Date('2026-06-17T04:00:00.000Z'),
      endsAt: new Date('2026-06-17T06:00:00.000Z')
    }
  };
  const active = getProductPriceInfo(product, now);
  assert.equal(active.flashActive, true);
  assert.equal(active.effectivePrice, 65000);
  assert.equal(active.compareAtPrice, 90000);
  const ended = getProductPriceInfo(product, new Date('2026-06-17T07:00:00.000Z'));
  assert.equal(ended.flashActive, false);
  assert.equal(ended.effectivePrice, 90000);
});

test('voucher semua produk memberi diskon pada seluruh subtotal', () => {
  const items = [{ product: { _id: 'a' }, lineTotal: 30000 }, { product: { _id: 'b' }, lineTotal: 20000 }];
  const discount = { scope: 'all', discountType: 'percentage', value: 20, maxDiscount: 0, minSubtotal: 0, products: [] };
  assert.equal(eligibleSubtotalForItems(discount, items), 50000);
  assert.equal(calculateDiscountAmount(discount, items, 50000).amount, 10000);
});

test('kode promo produk tertentu hanya menghitung produk yang dipilih', () => {
  const items = [{ product: { _id: 'a' }, lineTotal: 30000 }, { product: { _id: 'b' }, lineTotal: 20000 }];
  const discount = { scope: 'products', discountType: 'fixed', value: 25000, maxDiscount: 0, minSubtotal: 0, products: ['b'] };
  assert.equal(eligibleSubtotalForItems(discount, items), 20000);
  assert.equal(calculateDiscountAmount(discount, items, 50000).amount, 20000);
});

test('kode promo dinormalisasi menjadi huruf besar tanpa spasi', () => {
  assert.equal(normalizeCode(' zyphra 10 '), 'ZYPHRA10');
});

test('diskon tidak dapat membuat subtotal pembayaran menjadi nol', () => {
  const items = [{ product: { _id: 'a' }, lineTotal: 50000 }];
  const discount = { scope: 'all', discountType: 'percentage', value: 100, maxDiscount: 0, minSubtotal: 0, products: [] };
  assert.throws(() => calculateDiscountAmount(discount, items, 50000), /Rp0/);
});
