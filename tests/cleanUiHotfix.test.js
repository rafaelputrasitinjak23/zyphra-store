const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('layout mengaktifkan clean UI untuk seluruh halaman', () => {
  const layout = read('views/layouts/main.ejs');
  assert.match(layout, /class="ui-clean/);
  assert.match(layout, /3\.0\.0-clean-ui/);
});

test('halaman utama menggunakan hero dan showcase sederhana', () => {
  const home = read('views/home.ejs');
  assert.match(home, /clean-hero/);
  assert.match(home, /clean-showcase/);
});

test('footer menggunakan tampilan bersih dan ringan', () => {
  const footer = read('views/partials/footer.ejs');
  assert.match(footer, /clean-footer/);
  assert.match(footer, /clean-footer-grid/);
});

test('tampilan mobile account dipaksa satu kolom penuh', () => {
  const css = read('public/css/app.css');
  assert.match(css, /\.ui-clean \.account-layout\{display:flex!important;flex-direction:column!important/);
  assert.match(css, /\.ui-clean \.nav\{right:0!important;left:auto!important/);
});
