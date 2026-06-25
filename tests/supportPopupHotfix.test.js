const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./helpers/projectFiles');

test('popup ucapan dukungan menggunakan konten dan cache versi terbaru', () => {
  assert.match(read('models/StoreSetting.js'), /Terima kasih kepada support kami/);
  assert.match(read('views/partials/support-popup.ejs'), /THANKS TO SUPPORT/);
  assert.match(read('views/admin/support-popup.ejs'), /Popup thanks support/);
  assert.match(read('services/settingService.js'), /Kunjungi Vercel/);
  assert.match(read('services/settingService.js'), /Kunjungi Pakasir/);
  assert.match(read('views/layouts/main.ejs'), /6\.0\.0-production-hardening/);
});
