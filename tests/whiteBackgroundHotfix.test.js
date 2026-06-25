const test = require('node:test');
const assert = require('node:assert/strict');
const { read, readStyles } = require('./helpers/projectFiles');

test('override terakhir mempertahankan website putih tanpa pola grid', () => {
  const css = readStyles();
  const main = read('views/layouts/main.ejs');
  assert.match(css, /Final override: keep website background clean white/);
  assert.match(css, /background-image:none!important/);
  assert.match(main, /6\.0\.0-production-hardening/);
});
