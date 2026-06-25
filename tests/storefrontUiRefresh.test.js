const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./helpers/projectFiles');

const layout = read('views/layouts/main.ejs');
const css = read('public/css/ui-refresh.css');
const productList = read('views/products/list.ejs');
const productCard = read('views/partials/product-card.ejs');
const home = read('views/home.ejs');
const detail = read('views/products/detail.ejs');
const checkout = read('views/checkout/index.ejs');
const checkoutController = read('controllers/checkoutController.js');

test('stylesheet refresh dimuat paling akhir', () => {
  assert.match(layout, /accessibility\.css[\s\S]*ui-refresh\.css\?v=7\.0\.0-storefront-refresh/);
});

test('katalog memakai kartu marketplace dan lima kolom desktop', () => {
  assert.match(productList, /catalog-product-grid/);
  assert.match(productCard, /market-product-card/);
  assert.match(css, /catalog-product-grid[^}]*repeat\(5,minmax\(0,1fr\)\)/s);
});

test('produk tetap dua kolom pada layar mobile kecil', () => {
  assert.match(css, /@media\(max-width:700px\)[\s\S]*market-product-card/s);
  assert.match(css, /@media\(max-width:390px\)[\s\S]*catalog-product-grid[^}]*repeat\(2,minmax\(0,1fr\)\)/s);
});

test('flash sale memakai banner produk utama dengan countdown dan stok', () => {
  assert.match(home, /flash-sale-showcase/);
  assert.match(home, /data-flash-countdown/);
  assert.match(home, /flash-stock-card/);
});

test('detail dan checkout menampilkan produk relevan setelah area pembelian', () => {
  assert.match(detail, /product-checkout-card/);
  assert.match(detail, /Produk relevan untuk Anda/);
  assert.match(checkout, /Produk relevan/);
  assert.match(checkoutController, /relatedProducts/);
});
