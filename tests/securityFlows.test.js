const test = require('node:test');
const assert = require('node:assert/strict');
const { isOtpUsable } = require('../services/otpService');
const { webhookEventKey } = require('../utils/webhook');
const { authorizeOrderItem } = require('../services/downloadService');
const { priceCartRow } = require('../services/cartService');
const { AUTH_REQUIREMENTS, requirementsFor } = require('../services/authPolicy');
const { createCaptchaId, generateCaptchaCode, renderCaptchaSvg, verifyTextCaptcha } = require('../services/captchaService');

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


test('CAPTCHA teks menghasilkan kode yang mudah diketik', () => {
  const id = createCaptchaId();
  const code = generateCaptchaCode();
  assert.match(id, /^[a-f0-9]{32}$/);
  assert.match(code, /^[A-HJ-NP-Z2-9]{5}$/);
});

test('CAPTCHA teks valid hanya dapat digunakan sekali', async () => {
  const id = createCaptchaId();
  const session = {
    save(callback) { callback(); }
  };
  const req = { query: { id }, session };
  let svg = '';
  const res = {
    set() { return this; },
    send(value) { svg = value; return this; }
  };

  await renderCaptchaSvg(req, res);
  const code = [...svg.matchAll(/<text[^>]*>([A-Z2-9])<\/text>/g)].map((match) => match[1]).join('');
  assert.equal(code.length, 5);
  assert.equal(verifyTextCaptcha(req, id, code.toLowerCase()), true);
  assert.throws(() => verifyTextCaptcha(req, id, code), /tidak ditemukan|sudah digunakan/);
});

const { extractAiText, parseJsonFromText, fallbackProductCopy } = require('../services/aiService');
const { canCancelOrder, normalizeProviderStatus } = require('../services/orderCancellationService');

test('parser AI mendukung respons API bertingkat dan JSON code fence', () => {
  assert.equal(extractAiText({ status: true, data: { response: 'Halo dari AI' } }), 'Halo dari AI');
  assert.deepEqual(parseJsonFromText('```json\n{"shortDescription":"Produk bagus","tags":["nodejs"]}\n```'), { shortDescription: 'Produk bagus', tags: ['nodejs'] });
});

test('generator produk memiliki fallback saat layanan AI gagal', () => {
  const content = fallbackProductCopy({ name: 'Bot WhatsApp', category: 'Bot', tags: ['nodejs', 'baileys'], version: '2.0.0' });
  assert.match(content.shortDescription, /Bot WhatsApp/);
  assert.match(content.description, /Fitur utama/);
  assert.ok(content.tags.includes('nodejs'));
});

test('hanya transaksi pending yang dapat dibatalkan', () => {
  assert.equal(canCancelOrder({ paymentStatus: 'pending', orderStatus: 'awaiting_payment', accessGranted: false }), true);
  assert.equal(canCancelOrder({ paymentStatus: 'paid', orderStatus: 'fulfilled', accessGranted: true }), false);
  assert.equal(canCancelOrder({ paymentStatus: 'cancelled', orderStatus: 'cancelled', accessGranted: false }), false);
  assert.equal(normalizeProviderStatus('completed'), 'paid');
  assert.equal(normalizeProviderStatus('processing'), 'pending');
});
