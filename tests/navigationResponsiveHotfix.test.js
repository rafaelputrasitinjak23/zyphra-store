const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('menu utama mobile menggunakan drawer dari kanan', () => {
  const css = read('public/css/app.css');
  const header = read('views/partials/header.ejs');
  assert.match(header, /data-nav-overlay/);
  assert.match(header, /data-nav-close/);
  assert.match(css, /right:0!important;bottom:0!important;left:auto!important/);
  assert.match(css, /transform:translateX\(106%\)/);
});

test('sidebar admin desktop tetap di kiri dengan tinggi viewport sendiri', () => {
  const css = read('public/css/app.css');
  assert.match(css, /grid-template-columns:260px minmax\(0,1fr\)/);
  assert.match(css, /position:sticky!important;top:70px;height:calc\(100vh - 70px\);overflow-y:auto/);
});

test('sidebar admin mobile memiliki tombol, overlay, dan drawer kiri', () => {
  const partial = read('views/partials/admin-nav.ejs');
  const css = read('public/css/app.css');
  const js = read('public/js/app.js');
  assert.match(partial, /data-admin-open/);
  assert.match(partial, /data-admin-close/);
  assert.match(partial, /data-admin-overlay/);
  assert.match(css, /transform:translateX\(-106%\)/);
  assert.match(js, /setAdminSidebarOpen/);
});
