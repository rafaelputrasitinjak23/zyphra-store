const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./helpers/projectFiles');
const { sanitize } = require('../services/auditService');
const objectStorage = require('../services/objectStorageService');

test('entry point memvalidasi konfigurasi runtime sebelum memuat aplikasi', () => {
  const server = read('server.js');
  const vercel = read('api/index.js');
  assert.match(server, /assertRuntimeConfig\(\);[\s\S]*require\('\.\/app'\)/);
  assert.match(vercel, /assertRuntimeConfig\(\);[\s\S]*require\('\.\.\/app'\)/);
  assert.match(read('config/env.js'), /production harus acak dan minimal 32 karakter/);
  assert.match(read('config/env.js'), /CRON_SECRET/);
});

test('checkout memakai reservasi stok, diskon, dan status kompensasi', () => {
  const checkout = read('controllers/checkoutController.js');
  const order = read('models/Order.js');
  assert.match(checkout, /reserveOrderStock/);
  assert.match(checkout, /reserveDiscountUsage/);
  assert.match(checkout, /compensation_required/);
  assert.match(checkout, /gatewaySnapshot/);
  assert.match(order, /stockReserved/);
  assert.match(order, /discountReserved/);
  assert.match(order, /maintenanceLockId/);
});

test('maintenance dan webhook memakai endpoint mesin tanpa session browser', () => {
  const app = read('app.js');
  const sessionPosition = app.indexOf('browserSessionMiddleware = session(');
  assert.ok(app.indexOf("app.use('/api/system'") < sessionPosition);
  assert.ok(app.indexOf("app.use('/webhooks'") < sessionPosition);
  assert.match(app, /client: mongoose\.connection\.getClient\(\)/);
  assert.match(read('controllers/systemController.js'), /timingSafeEqual/);
  assert.match(read('vercel.json'), /api\/system\/maintenance/);
});

test('audit log meredaksi secret dan file source privat', () => {
  const result = sanitize({ passwordHash: 'hash', apiKey: 'key', digitalFileUrl: 'https://secret', digitalStorageKey: 'products/private.zip', nested: { token: 'abc', safe: 'ok' } });
  assert.equal(result.passwordHash, '[REDACTED]');
  assert.equal(result.apiKey, '[REDACTED]');
  assert.equal(result.digitalFileUrl, '[REDACTED]');
  assert.equal(result.digitalStorageKey, '[REDACTED]');
  assert.equal(result.nested.token, '[REDACTED]');
  assert.equal(result.nested.safe, 'ok');
});

test('service worker hanya meng-cache aset publik', () => {
  const sw = read('public/sw.js');
  assert.match(sw, /pathname\.startsWith\('\/public\/'\)/);
  assert.match(sw, /request\.method !== 'GET'/);
  assert.doesNotMatch(sw, /caches\.match\(.*navigate/s);
  assert.match(read('public/js/app.js'), /serviceWorker\.register/);
});

test('layout menyediakan SEO, JSON-LD, dan navigasi keyboard', () => {
  const layout = read('views/layouts/main.ejs');
  assert.match(layout, /rel="canonical"/);
  assert.match(layout, /property="og:title"/);
  assert.match(layout, /name="twitter:card"/);
  assert.match(layout, /application\/ld\+json/);
  assert.match(layout, /class="skip-link"/);
  assert.match(read('public/js/app.js'), /keepFocusInside/);
});

test('popup support tidak membangun data database melalui innerHTML', () => {
  const js = read('public/js/app.js');
  const start = js.indexOf('function setupSupportPopup');
  const end = js.indexOf('\n  function ', start + 1);
  const section = js.slice(start, end > start ? end : undefined);
  assert.doesNotMatch(section, /innerHTML\s*=\s*`/);
  assert.match(section, /options\.innerHTML = ''/);
  assert.match(section, /textContent/);
});

test('object key storage menolak traversal dan menormalisasi prefix produk', () => {
  assert.equal(objectStorage.productObjectKey('products/file.zip'), 'products/file.zip');
  assert.equal(objectStorage.productObjectKey('file.zip'), 'products/file.zip');
  assert.throws(() => objectStorage.normalizeObjectKey('../secret.zip'), /Object key storage tidak valid/);
  assert.throws(() => objectStorage.normalizeObjectKey('folder\\secret.zip'), /Object key storage tidak valid/);
});


test('structured log dan canonical URL tidak menyimpan query token', () => {
  assert.match(read('middlewares/requestContext.js'), /originalUrl\.split\('\?'\)\[0\]/);
  assert.match(read('middlewares/errorHandler.js'), /originalUrl\.split\('\?'\)\[0\]/);
  assert.match(read('middlewares/locals.js'), /originalUrl\.split\('\?'\)\[0\]/);
});
