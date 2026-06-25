const test = require('node:test');
const assert = require('node:assert/strict');
const { read, readStyles } = require('./helpers/projectFiles');

test('layout mengaktifkan UI bersih dan stylesheet modular', () => {
  const layout = read('views/layouts/main.ejs');
  assert.match(layout, /<body class="ui-clean/);
  for (const stylesheet of ['core.css', 'clean-ui.css', 'responsive.css', 'storefront.css', 'accessibility.css']) {
    assert.match(layout, new RegExp(stylesheet.replace('.', '\\.')));
  }
  assert.match(layout, /6\.0\.0-production-hardening/);
});

test('halaman utama memakai hero dan showcase marketplace saat ini', () => {
  const home = read('views/home.ejs');
  assert.match(home, /warung-hero/);
  assert.match(home, /warung-remix-board/);
  assert.match(home, /warung-results-section/);
});

test('footer menggunakan tampilan bersih dan ringan', () => {
  const footer = read('views/partials/footer.ejs');
  assert.match(footer, /clean-footer/);
  assert.match(footer, /clean-footer-grid/);
});

test('layout akun dan drawer mobile dipaksa responsif', () => {
  const css = readStyles();
  assert.match(css, /account-layout[\s\S]*grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(css, /\.nav\{[\s\S]*right:0!important;[\s\S]*left:auto!important/);
});
