const test = require('node:test');
const assert = require('node:assert/strict');
const { freeBreakdown } = require('../controllers/checkoutController');
const { priceCartRow } = require('../services/cartService');

test('checkout gratis menggunakan seluruh nominal nol tanpa gateway fee', () => {
  assert.deepEqual(freeBreakdown(), {
    subtotal: 0,
    gatewayFee: 0,
    userFee: 0,
    merchantFee: 0,
    merchantNet: 0,
    total: 0,
    pakasirAmount: 0
  });
});

test('produk gratis tetap dapat masuk keranjang dan memiliki line total nol', () => {
  const product = {
    name: 'Script Gratis',
    price: 0,
    promoPrice: null,
    flashSale: { enabled: false },
    allowMultipleQuantity: false,
    unlimitedStock: true,
    stock: 0
  };
  const row = priceCartRow(product, 1);
  assert.equal(row.unitPrice, 0);
  assert.equal(row.lineTotal, 0);
});
