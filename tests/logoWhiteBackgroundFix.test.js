const test = require('node:test');
const assert = require('node:assert/strict');
const { read, readStyles } = require('./helpers/projectFiles');

test('branding dan halaman tetap memiliki background putih final', () => {
  const css = readStyles();
  const main = read('views/layouts/main.ejs');
  assert.match(css, /background:#ffffff!important/);
  assert.match(css, /background-image:none!important/);
  assert.match(main, /6\.0\.0-production-hardening/);
});
