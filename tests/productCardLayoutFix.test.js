const test = require('node:test');
const assert = require('node:assert/strict');
const { read, readStyles } = require('./helpers/projectFiles');

test('thumbnail kartu produk memiliki tinggi stabil dan gambar contain', () => {
  const css = readStyles();
  assert.match(css, /\.product-image\s*\{[^}]*height:230px[^}]*flex:0 0 230px/s);
  assert.match(css, /\.product-image img\s*\{[^}]*object-fit:contain/s);
});

test('stylesheet menggunakan cache busting produksi', () => {
  const layout = read('views/layouts/main.ejs');
  assert.match(layout, /app\.css\?v=6\.0\.0-production-hardening/);
});
