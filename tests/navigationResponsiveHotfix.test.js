const test = require('node:test');
const assert = require('node:assert/strict');
const { read, readStyles } = require('./helpers/projectFiles');

test('menu utama mobile memakai drawer kanan dan kontrol aksesibel', () => {
  const css = readStyles();
  const header = read('views/partials/header.ejs');
  const js = read('public/js/app.js');
  assert.match(header, /data-nav-overlay/);
  assert.match(header, /data-nav-close/);
  assert.match(header, /tabindex="-1"/);
  assert.match(css, /right:0!important;[\s\S]*left:auto!important/);
  assert.match(css, /transform:translateX\(10[56]%\)!important/);
  assert.match(js, /keepFocusInside/);
});

test('sidebar admin desktop tetap di kiri dengan tinggi viewport sendiri', () => {
  const css = readStyles();
  assert.match(css, /grid-template-columns:260px minmax\(0,1fr\)/);
  assert.match(css, /position:sticky!important;top:70px;height:calc\(100vh - 70px\);overflow-y:auto/);
});

test('sidebar admin mobile memiliki tombol, overlay, drawer kiri, dan pemulihan fokus', () => {
  const partial = read('views/partials/admin-nav.ejs');
  const css = readStyles();
  const js = read('public/js/app.js');
  assert.match(partial, /data-admin-open/);
  assert.match(partial, /data-admin-close/);
  assert.match(partial, /data-admin-overlay/);
  assert.match(partial, /tabindex="-1"/);
  assert.match(css, /transform:translateX\(-10[56]%\)!important/);
  assert.match(js, /function setupAdminNav/);
  assert.match(js, /let previousFocus = null/);
});
