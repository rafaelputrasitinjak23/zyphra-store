const test = require('node:test');
const assert = require('node:assert/strict');
const { read, readStyles } = require('./helpers/projectFiles');

test('tema final tidak meninggalkan grid background pada halaman', () => {
  const css = readStyles();
  const main = read('views/layouts/main.ejs');
  assert.match(css, /--grid-bg:#ffffff!important/);
  assert.match(css, /background-image:none!important/);
  assert.match(css, /background-attachment:scroll!important/);
  assert.match(main, /6\.0\.0-production-hardening/);
});
