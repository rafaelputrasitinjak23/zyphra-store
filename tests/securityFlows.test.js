const test = require('node:test');
const assert = require('node:assert/strict');
const { isOtpUsable } = require('../services/otpService');
const { webhookEventKey } = require('../utils/webhook');
const { authorizeOrderItem } = require('../services/downloadService');
const { priceCartRow } = require('../services/cartService');
const { AUTH_REQUIREMENTS, requirementsFor } = require('../services/authPolicy');

test('OTP kedaluwarsa ditolak', () => {
  assert.equal(isOtpUsable({ expiresAt: new Date(Date.now() - 1), consumedAt: null, attempts: 0, maxAttempts: 5 }), false);
});

test('OTP hanya dapat digunakan sekali', () => {
  const otp = { expiresAt: new Date(Date.now() + 60000), consumedAt: null, attempts: 0, maxAttempts: 5 };
  assert.equal(isOtpUsable(otp), true);
  otp.consumedAt = new Date();
  assert.equal(isOtpUsable(otp), false);
});

test('webhook duplikat menghasilkan event key idempoten walau urutan properti berbeda', () => {
  const a = { amount: 22000, order_id: 'INV-1', status: 'completed' };
  const b = { status: 'completed', order_id: 'INV-1', amount: 22000 };
  assert.equal(webhookEventKey(a), webhookEventKey(b));
});

test('URL download tidak dapat diakses pengguna lain', () => {
  const order = { user: 'user-a', paymentStatus: 'paid', accessGranted: true, items: [{ product: 'product-1' }] };
  assert.equal(authorizeOrderItem(order, 'user-b', 'product-1'), null);
  assert.ok(authorizeOrderItem(order, 'user-a', 'product-1'));
});

test('harga dari frontend diabaikan dan harga database digunakan', () => {
  const product = { name: 'Script', price: 25000, promoPrice: 20000, allowMultipleQuantity: true, unlimitedStock: true, stock: 0 };
  const row = priceCartRow(product, 2, 1);
  assert.equal(row.unitPrice, 20000);
  assert.equal(row.lineTotal, 40000);
});

test('autentikasi hanya menyediakan login email dengan CAPTCHA, password, dan OTP', () => {
  assert.deepEqual(Object.keys(AUTH_REQUIREMENTS), ['email']);
  assert.deepEqual(requirementsFor('email'), { captcha: true, password: true, otp: true });
  assert.equal(requirementsFor('social'), null);
});
