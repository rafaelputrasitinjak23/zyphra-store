const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const template = fs.readFileSync(
  path.join(__dirname, '..', 'views', 'partials', 'product-card.ejs'),
  'utf8'
);

test('kartu produk selalu menampilkan nama dan harga script', () => {
  assert.match(template, /Nama script/);
  assert.match(template, /Harga script/);
  assert.match(template, /product\.name/);
  assert.match(template, /pricing\.effectivePrice/);
});
