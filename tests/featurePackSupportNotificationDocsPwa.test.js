const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { root, read } = require('./helpers/projectFiles');

test('fitur support, notifikasi, dokumentasi, dan PWA tetap terpasang', () => {
  const app = read('app.js');
  assert.match(app, /mountIfRouteExists\('\/support'/);
  assert.match(app, /mountIfRouteExists\('\/notifications'/);
  assert.match(app, /mountIfRouteExists\('\/docs'/);
  assert.ok(fs.existsSync(path.join(root, 'models/SupportTicket.js')));
  assert.ok(fs.existsSync(path.join(root, 'models/Notification.js')));
  assert.ok(fs.existsSync(path.join(root, 'models/ProductDocumentation.js')));
  assert.ok(fs.existsSync(path.join(root, 'public/manifest.webmanifest')));
  assert.ok(fs.existsSync(path.join(root, 'public/sw.js')));
  assert.match(read('routes/adminRoutes.js'), /router\.get\('\/support'/);
  assert.match(read('routes/adminRoutes.js'), /router\.get\('\/documentation'/);
  assert.match(read('views/partials/header.ejs'), /\/notifications/);
  assert.match(read('views/products/detail.ejs'), /\/docs\/<%= product\.slug %>/);
  assert.match(read('public/js/app.js'), /serviceWorker\.register/);
});
