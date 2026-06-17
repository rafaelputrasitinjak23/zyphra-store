const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'public/css/app.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/js/app.js'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8');

test('mobile v4 uses a consistent 900px navigation breakpoint', () => {
  assert.match(js, /max-width: 900px/);
  assert.doesNotMatch(js, /max-width: 820px/);
  assert.match(css, /@media\(max-width:900px\)/);
});

test('major desktop grids collapse on mobile', () => {
  for (const selector of [
    '.hero-grid', '.product-detail', '.checkout-grid', '.payment-layout',
    '.account-layout', '.market-settings-layout', '.wallet-layout', '.wallet-hero'
  ]) assert.ok(css.includes(selector), `Missing ${selector}`);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\)!important/);
});

test('mobile drawers are positioned on the requested sides', () => {
  assert.match(css, /\.nav\{[\s\S]*right:0!important;[\s\S]*left:auto!important/);
  assert.match(css, /\.admin-nav\{[\s\S]*left:0!important/);
});

test('root and content prevent horizontal overflow', () => {
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /main>section/);
  assert.match(css, /\.table-wrap[\s\S]*overflow-x:auto!important/);
});

test('layout includes viewport fit and cache busting', () => {
  assert.match(layout, /viewport-fit=cover/);
  assert.match(layout, /3\.0\.0-clean-ui-4\.0\.0-mobile-rebuild/);
});
