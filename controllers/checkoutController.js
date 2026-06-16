const crypto = require('crypto');
const QRCode = require('qrcode');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { getPricedCart } = require('../services/cartService');
const { getStoreSettings } = require('../services/settingService');
const { calculateFeeSplit } = require('../services/feeService');
const pakasir = require('../services/pakasirService');
const emailService = require('../services/emailService');
const { randomId } = require('../utils/helpers');
const { AppError } = require('../utils/errors');
const { env } = require('../config/env');

async function show(req, res) {
  const { items, subtotal } = await getPricedCart(req.user._id);
  if (!items.length) { req.flash('error', 'Keranjang masih kosong.'); return res.redirect('/cart'); }
  const settings = await getStoreSettings();
  const methods = settings.paymentFees.filter((rule) => rule.active).map((rule) => ({ ...rule.toObject?.() || rule, quote: calculateFeeSplit(subtotal, rule, settings.feeSplitThreshold) }));
  const nonce = crypto.randomBytes(24).toString('hex');
  req.session.checkoutNonce = nonce;
  res.render('checkout/index', { title: 'Checkout', items, subtotal, methods, threshold: settings.feeSplitThreshold, nonce });
}
async function create(req, res) {
  const nonce = String(req.body.checkoutNonce || '');
  if (!nonce || nonce !== req.session.checkoutNonce) throw new AppError('Checkout sudah diproses atau sesi tidak valid.', 409, 'CHECKOUT_REPLAY');
  delete req.session.checkoutNonce;
  const existing = await Order.findOne({ idempotencyKey: `${req.user._id}:${nonce}` });
  if (existing) return res.redirect(`/payments/${existing.orderNumber}`);
  const { items, subtotal } = await getPricedCart(req.user._id);
  if (!items.length) throw new AppError('Keranjang kosong.', 400);
  const settings = await getStoreSettings();
  const rule = settings.paymentFees.find((entry) => entry.method === req.body.paymentMethod && entry.active);
  if (!rule) throw new AppError('Metode pembayaran tidak tersedia.', 400);
  const initial = calculateFeeSplit(subtotal, rule, settings.feeSplitThreshold);
  const orderNumber = randomId('ORD-');
  const invoiceNumber = randomId('INV-');
  const order = await Order.create({
    orderNumber, invoiceNumber, idempotencyKey: `${req.user._id}:${nonce}`, user: req.user._id,
    buyerSnapshot: { name: req.user.name, email: req.user.email },
    items: items.map(({ product, quantity, unitPrice, lineTotal }) => ({ product: product._id, name: product.name, slug: product.slug, thumbnail: product.thumbnail, unitPrice, quantity, lineTotal, version: product.version, downloadLimit: product.downloadLimit })),
    ...initial, paymentMethod: rule.method
  });
  try {
    const result = await pakasir.createReconciledTransaction({ method: rule.method, orderId: orderNumber, subtotal, threshold: settings.feeSplitThreshold, initialAmount: initial.pakasirAmount });
    const p = result.payment;
    Object.assign(order, result.split, { pakasirTransactionId: p.transaction_id || p.order_id, paymentNumber: p.payment_number, expiresAt: p.expired_at ? new Date(p.expired_at) : new Date(Date.now() + 24 * 60 * 60 * 1000) });
    if (rule.method === 'qris' && p.payment_number) order.paymentQrDataUrl = await QRCode.toDataURL(p.payment_number, { margin: 1, width: 320 });
    await order.save();
    await Payment.create({ order: order._id, providerTransactionId: order.pakasirTransactionId, method: rule.method, amount: p.amount, fee: p.fee, totalPayment: p.total_payment, status: p.status || 'pending', paymentNumber: p.payment_number, expiresAt: order.expiresAt, createRequest: result.safeRequest, createResponse: result.raw });
    if (env.smtp.adminEmail) await emailService.sendSimple(env.smtp.adminEmail, 'Pesanan baru', { name: 'Admin', message: `Pesanan ${orderNumber} dibuat dengan total ${order.total}.`, action: { label: 'Lihat pesanan', url: `${env.appUrl}/admin/orders/${orderNumber}` } }, 'admin_new_order');
    res.redirect(`/payments/${orderNumber}`);
  } catch (error) {
    order.paymentStatus = 'failed'; order.orderStatus = 'cancelled'; await order.save(); throw error;
  }
}
module.exports = { show, create };
