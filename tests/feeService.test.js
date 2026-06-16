const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateFeeSplit } = require('../services/feeService');
const fixed = { active: true, type: 'fixed', fixed: 2000 };

test('fee transaksi di bawah Rp50.000 dibagi dua', () => {
  assert.deepEqual(calculateFeeSplit(30000, fixed, 50000), { subtotal: 30000, gatewayFee: 2000, userFee: 1000, merchantFee: 1000, total: 31000, merchantNet: 29000, pakasirAmount: 29000 });
});
test('fee tepat Rp50.000 seluruhnya dibayar pengguna', () => {
  assert.deepEqual(calculateFeeSplit(50000, fixed, 50000), { subtotal: 50000, gatewayFee: 2000, userFee: 2000, merchantFee: 0, total: 52000, merchantNet: 50000, pakasirAmount: 50000 });
});
test('fee di atas Rp50.000 seluruhnya dibayar pengguna', () => {
  assert.equal(calculateFeeSplit(75000, fixed, 50000).total, 77000);
  assert.equal(calculateFeeSplit(75000, fixed, 50000).merchantFee, 0);
});
test('fee ganjil dibulatkan ke atas untuk pengguna', () => {
  const quote = calculateFeeSplit(30000, { active: true, type: 'fixed', fixed: 2001 }, 50000);
  assert.equal(quote.userFee, 1001); assert.equal(quote.merchantFee, 1000); assert.equal(quote.total, 31001);
});
