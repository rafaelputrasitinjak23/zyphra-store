const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./helpers/projectFiles');
const { availableStock, hasAvailableStock } = require('../utils/inventory');
const { reservationQuantity, hasItemReservations } = require('../services/stockReservationService');

test('stok tersedia mengurangi reservasi aktif tanpa menghasilkan nilai negatif', () => {
  assert.equal(availableStock({ unlimitedStock: false, stock: 10, reservedStock: 4 }), 6);
  assert.equal(availableStock({ unlimitedStock: false, stock: 2, reservedStock: 5 }), 0);
  assert.equal(availableStock({ unlimitedStock: true, stock: 0, reservedStock: 99 }), Number.POSITIVE_INFINITY);
  assert.equal(hasAvailableStock({ unlimitedStock: false, stock: 10, reservedStock: 4 }, 6), true);
  assert.equal(hasAvailableStock({ unlimitedStock: false, stock: 10, reservedStock: 4 }, 7), false);
});

test('reservasi stok dicatat per item', () => {
  assert.equal(reservationQuantity({ quantity: 2, stockReservationQuantity: 2 }), 2);
  assert.equal(reservationQuantity({ quantity: 2, stockReservationQuantity: -1 }), 0);
  assert.equal(hasItemReservations({ items: [{ stockReservationQuantity: 0 }, { stockReservationQuantity: 1 }] }), true);
  assert.equal(hasItemReservations({ items: [{ stockReservationQuantity: 0 }] }), false);
});

test('commit dan release memakai kuantitas reservasi item, bukan status unlimited terbaru', () => {
  const service = read('services/stockReservationService.js');
  const order = read('models/Order.js');
  assert.match(order, /stockReservationQuantity/);
  assert.match(service, /reservedQuantity !== Number\(item\.quantity\)/);
  assert.match(service, /reservedStock: \{ \$gte: reservedQuantity \}/);
  assert.match(service, /\$subtract: \['\$stock', \{ \$ifNull: \['\$reservedStock'/);
  assert.doesNotMatch(service, /if \(!product \|\| product\.unlimitedStock\) continue/);
});

test('keranjang dan admin menghormati stok yang sedang direservasi', () => {
  const cart = read('services/cartService.js');
  const cartController = read('controllers/cartController.js');
  const admin = read('controllers/adminController.js');
  assert.match(cart, /select: '\+reservedStock'/);
  assert.match(cart, /hasAvailableStock/);
  assert.match(cartController, /nextQuantity/);
  assert.match(admin, /STOCK_BELOW_RESERVED/);
  assert.match(admin, /\+reservedStock/);
});
