const test = require('node:test');
const assert = require('node:assert/strict');
const { read, readStyles } = require('./helpers/projectFiles');

const css = readStyles();
const js = read('public/js/app.js');
const layout = read('views/layouts/main.ejs');

test('mobile menggunakan breakpoint navigasi 900px yang konsisten', () => {
  assert.match(js, /max-width: 900px/);
  assert.doesNotMatch(js, /max-width: 820px/);
  assert.match(css, /@media\(max-width:900px\)/);
});

test('grid desktop utama runtuh menjadi satu kolom di mobile', () => {
  for (const selector of [
    '.hero-grid', '.product-detail', '.checkout-grid', '.payment-layout',
    '.account-layout', '.market-settings-layout', '.wallet-layout', '.wallet-hero'
  ]) assert.ok(css.includes(selector), `Missing ${selector}`);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\)!important/);
});

test('drawer mobile berada pada sisi yang diminta', () => {
  assert.match(css, /\.nav\{[\s\S]*right:0!important;[\s\S]*left:auto!important/);
  assert.match(css, /\.admin-nav\{[\s\S]*left:0!important/);
});

test('root dan konten mencegah overflow horizontal', () => {
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /main>section/);
  assert.match(css, /\.table-wrap[\s\S]*overflow-x:auto!important/);
});

test('layout menyertakan viewport fit dan cache busting produksi', () => {
  assert.match(layout, /viewport-fit=cover/);
  assert.match(layout, /6\.0\.0-production-hardening/);
});
