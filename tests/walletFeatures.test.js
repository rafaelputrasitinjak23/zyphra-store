const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { internalBreakdown, buildPaymentOptions } = require('../controllers/checkoutController');

const qrisRule = { method: 'qris', label: 'QRIS', type: 'tiered_qris', percentage: 0.007, fixed: 310, highPercentage: 0.01, highThreshold: 105000, active: true };
const settings = { feeSplitThreshold: 50000, wallet: { enabled: true }, paymentFees: [qrisRule] };

test('pembayaran dompet penuh tidak memiliki biaya kanal eksternal', () => {
  assert.deepEqual(internalBreakdown(40000, 40000), {
    subtotal: 40000,
    gatewayFee: 0,
    userFee: 0,
    merchantFee: 0,
    merchantNet: 40000,
    total: 40000,
    pakasirAmount: 0,
    walletAmount: 40000,
    externalSubtotal: 0
  });
});

test('opsi checkout menampilkan pembayaran saldo penuh saat saldo cukup', () => {
  const options = buildPaymentOptions(settings, 30000, 50000);
  assert.equal(options[0].value, 'wallet');
  assert.equal(options[0].walletAmount, 30000);
  assert.equal(options[0].externalSubtotal, 0);
});

test('opsi checkout dapat menggabungkan saldo dan metode pembayaran', () => {
  const options = buildPaymentOptions(settings, 50000, 15000);
  const hybrid = options.find((option) => option.value === 'hybrid:qris');
  assert.ok(hybrid);
  assert.equal(hybrid.walletAmount, 15000);
  assert.equal(hybrid.externalSubtotal, 35000);
  assert.equal(hybrid.total, 15000 + hybrid.quote.total);
});

test('halaman publik tidak menampilkan penjelasan internal fee dan autentikasi', () => {
  const root = path.join(__dirname, '..', 'views');
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'admin') walk(full);
      } else if (entry.name.endsWith('.ejs')) files.push(full);
    }
  }
  walk(root);
  const content = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n').toLowerCase();
  for (const phrase of ['fee dibagi', 'server-side', 'login dilindungi password dan captcha', 'status pembayaran tetap mengikuti data server dan pakasir']) {
    assert.equal(content.includes(phrase), false, `teks publik masih memuat: ${phrase}`);
  }
});


test('opsi saldo disembunyikan ketika fitur dompet dinonaktifkan', () => {
  const options = buildPaymentOptions({ ...settings, wallet: { enabled: false } }, 50000, 50000);
  assert.equal(options.some((option) => option.type === 'wallet' || option.type === 'hybrid'), false);
  assert.equal(options.some((option) => option.type === 'gateway'), true);
});

test('admin dapat membuat voucher saldo dan mengelola dompet', () => {
  const promotionForm = fs.readFileSync(path.join(__dirname, '../views/admin/discounts/form.ejs'), 'utf8');
  const adminRoutes = fs.readFileSync(path.join(__dirname, '../routes/adminRoutes.js'), 'utf8');
  assert.match(promotionForm, /value="wallet_credit"/);
  assert.match(promotionForm, /name="walletCreditAmount"/);
  assert.match(adminRoutes, /wallets\/:userId\/adjust/);
  assert.match(adminRoutes, /wallets\/:userId\/status/);
});

test('halaman utama marketplace tidak menampilkan detail implementasi internal', () => {
  const selected = [
    '../views/home.ejs',
    '../views/products/list.ejs',
    '../views/products/detail.ejs',
    '../views/cart/index.ejs',
    '../views/checkout/index.ejs',
    '../views/wallet/index.ejs'
  ].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8').toLowerCase()).join('\n');
  for (const phrase of ['fee dibagi', 'server-side', 'pakasir', 'captcha', 'otp enam digit']) {
    assert.equal(selected.includes(phrase), false, `halaman marketplace masih memuat: ${phrase}`);
  }
});
