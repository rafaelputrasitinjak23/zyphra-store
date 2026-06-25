const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const uri = process.env.TEST_MONGODB_URI;

async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

function orderData({ suffix, user, product, discount = null }) {
  return {
    orderNumber: `TEST-ORD-${suffix}`,
    invoiceNumber: `TEST-INV-${suffix}`,
    idempotencyKey: `TEST-IDEM-${suffix}`,
    user,
    buyerSnapshot: { name: 'Test', email: `test-${suffix}@example.com` },
    items: [{ product, name: 'Concurrency Product', slug: 'concurrency-product', unitPrice: 10000, quantity: 1, lineTotal: 10000, downloadLimit: 5 }],
    itemsSubtotal: 10000,
    discountCode: discount,
    discountCodeText: discount ? 'ONLYONE' : '',
    discountName: discount ? 'Only One' : '',
    discountKind: discount ? 'promo' : '',
    discountType: discount ? 'fixed' : '',
    discountScope: discount ? 'all' : '',
    discountValue: discount ? 1000 : 0,
    discountAmount: discount ? 1000 : 0,
    subtotal: discount ? 9000 : 10000,
    walletAmount: 0,
    externalSubtotal: discount ? 9000 : 10000,
    gatewayFee: 0,
    userFee: 0,
    merchantFee: 0,
    merchantNet: discount ? 9000 : 10000,
    total: discount ? 9000 : 10000,
    pakasirAmount: discount ? 9000 : 10000,
    paymentMethod: 'qris',
    paymentChannel: 'gateway',
    paymentStatus: 'initializing',
    expiresAt: new Date(Date.now() + 3600000)
  };
}

test('reservasi stok dan kuota promo tahan terhadap request bersamaan', { skip: !uri }, async (t) => {
  const databaseName = `zyphra_concurrency_${Date.now()}`;
  await mongoose.connect(uri, { dbName: databaseName });
  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const User = require('../../models/User');
  const Category = require('../../models/Category');
  const Product = require('../../models/Product');
  const Order = require('../../models/Order');
  const DiscountCode = require('../../models/DiscountCode');
  const stockService = require('../../services/stockReservationService');
  const discountService = require('../../services/discountService');

  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  const category = await Category.create({ name: 'Test', slug: `test-${Date.now()}`, active: true });
  const users = await User.create([
    { name: 'User A', email: `a-${Date.now()}@example.com`, role: 'user', status: 'active' },
    { name: 'User B', email: `b-${Date.now()}@example.com`, role: 'user', status: 'active' }
  ]);
  const product = await Product.create({
    name: 'Concurrency Product', slug: `concurrency-${Date.now()}`, shortDescription: 'Test', description: 'Test product',
    price: 10000, category: category._id, thumbnail: 'https://example.com/image.png', unlimitedStock: false, stock: 1,
    digitalFileUrl: 'https://example.com/file.zip', active: true
  });
  const orders = await Order.create([
    orderData({ suffix: `A-${Date.now()}`, user: users[0]._id, product: product._id }),
    orderData({ suffix: `B-${Date.now()}`, user: users[1]._id, product: product._id })
  ]);

  const stockResults = await Promise.allSettled(orders.map((order) => stockService.reserveOrderStock(order._id)));
  assert.equal(stockResults.filter((entry) => entry.status === 'fulfilled').length, 1);
  assert.equal(stockResults.filter((entry) => entry.status === 'rejected').length, 1);
  const stockAfter = await Product.findById(product._id).select('+reservedStock');
  assert.equal(stockAfter.reservedStock, 1);

  const successfulIndex = stockResults.findIndex((entry) => entry.status === 'fulfilled');
  const reservedOrder = await Order.findById(orders[successfulIndex]._id);
  assert.equal(reservedOrder.items[0].stockReservationQuantity, 1);

  // Reservasi per item tetap dapat dilepas walaupun admin mengubah produk menjadi unlimited.
  await Product.updateOne({ _id: product._id }, { $set: { unlimitedStock: true } });
  await stockService.releaseOrderStock(reservedOrder, 'Integration cleanup');
  const releasedProduct = await Product.findById(product._id).select('+reservedStock');
  assert.equal(releasedProduct.reservedStock, 0);

  // Item yang semula unlimited tidak boleh mengambil stok yang sudah dicadangkan order lain
  // ketika produk kemudian diubah menjadi stok terbatas.
  const transitionProduct = await Product.create({
    name: 'Transition Product', slug: `transition-${Date.now()}`, shortDescription: 'Test', description: 'Test product',
    price: 10000, category: category._id, thumbnail: 'https://example.com/image.png', unlimitedStock: true, stock: 1,
    digitalFileUrl: 'https://example.com/file.zip', active: true
  });
  const [transitionOrder] = await Order.create([
    orderData({ suffix: `TRANSITION-${Date.now()}`, user: users[0]._id, product: transitionProduct._id })
  ]);
  await stockService.reserveOrderStock(transitionOrder._id);
  await Product.updateOne({ _id: transitionProduct._id }, { $set: { unlimitedStock: false, stock: 1 } });
  await withTransaction(async (session) => {
    const current = await Order.findById(transitionOrder._id).session(session);
    await stockService.commitOrderStock(current, session);
    await current.save({ session });
  });
  const committedTransition = await Product.findById(transitionProduct._id).select('+reservedStock');
  assert.equal(committedTransition.stock, 0);
  assert.equal(committedTransition.reservedStock, 0);
  assert.equal(committedTransition.soldCount, 1);

  const discount = await DiscountCode.create({
    name: 'Only One', code: `ONLYONE${Date.now()}`, kind: 'promo', benefitType: 'order_discount', discountType: 'fixed', value: 1000,
    scope: 'all', usageLimit: 1, perUserLimit: 1, startsAt: new Date(Date.now() - 60000), endsAt: new Date(Date.now() + 3600000), active: true
  });
  const discountOrders = await Order.create([
    orderData({ suffix: `DA-${Date.now()}`, user: users[0]._id, product: product._id, discount: discount._id }),
    orderData({ suffix: `DB-${Date.now()}`, user: users[1]._id, product: product._id, discount: discount._id })
  ]);
  const discountResults = await Promise.allSettled(discountOrders.map((order) => withTransaction((session) => discountService.reserveDiscountUsage(order._id, session))));
  assert.equal(discountResults.filter((entry) => entry.status === 'fulfilled').length, 1);
  assert.equal(discountResults.filter((entry) => entry.status === 'rejected').length, 1);
  const discountAfter = await DiscountCode.findById(discount._id);
  assert.equal(discountAfter.reservedCount, 1);
});
