const crypto = require('crypto');
const QRCode = require('qrcode');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { getPricedCart } = require('../services/cartService');
const { getStoreSettings } = require('../services/settingService');
const { calculateFeeSplit } = require('../services/feeService');
const { validateDiscountForCart, normalizeCode } = require('../services/discountService');
const pakasir = require('../services/pakasirService');
const emailService = require('../services/emailService');
const { randomId } = require('../utils/helpers');
const { AppError } = require('../utils/errors');
const { env } = require('../config/env');

async function resolveDiscount(req, items, itemsSubtotal, { strict = false } = {}) {
  const code = normalizeCode(req.session.checkoutDiscountCode);
  if (!code) return null;
  try {
    return await validateDiscountForCart({ code, userId: req.user._id, items, itemsSubtotal });
  } catch (error) {
    delete req.session.checkoutDiscountCode;
    if (strict) throw error;
    req.flash('error', error.message);
    return null;
  }
}

async function show(req, res) {
  const { items, subtotal: itemsSubtotal } = await getPricedCart(req.user._id);
  if (!items.length) { req.flash('error', 'Keranjang masih kosong.'); return res.redirect('/cart'); }
  let discountResult;
  try { discountResult = await resolveDiscount(req, items, itemsSubtotal, { strict: true }); }
  catch (error) { req.flash('error', error.message); return res.redirect('/checkout'); }
  const discountAmount = discountResult?.amount || 0;
  const subtotal = itemsSubtotal - discountAmount;
  if (subtotal < 1) {
    delete req.session.checkoutDiscountCode;
    req.flash('error', 'Diskon membuat total produk tidak valid. Gunakan kode lain.');
    return res.redirect('/checkout');
  }
  const settings = await getStoreSettings();
  const methods = settings.paymentFees.filter((rule) => rule.active).map((rule) => ({ ...rule.toObject?.() || rule, quote: calculateFeeSplit(subtotal, rule, settings.feeSplitThreshold) }));
  const nonce = crypto.randomBytes(24).toString('hex');
  req.session.checkoutNonce = nonce;
  res.render('checkout/index', {
    title: 'Checkout', items, itemsSubtotal, subtotal, methods,
    threshold: settings.feeSplitThreshold, nonce,
    appliedDiscount: discountResult ? {
      code: discountResult.discount.code,
      name: discountResult.discount.name,
      kind: discountResult.discount.kind,
      scope: discountResult.discount.scope,
      amount: discountAmount
    } : null
  });
}

async function applyDiscount(req, res) {
  const { items, subtotal: itemsSubtotal } = await getPricedCart(req.user._id);
  if (!items.length) throw new AppError('Keranjang kosong.', 400);
  const code = normalizeCode(req.body.discountCode);
  if (!code) { req.flash('error', 'Masukkan voucher atau kode promo.'); return res.redirect('/checkout'); }
  try {
    const result = await validateDiscountForCart({ code, userId: req.user._id, items, itemsSubtotal });
    req.session.checkoutDiscountCode = result.discount.code;
    req.flash('success', `${result.discount.kind === 'voucher' ? 'Voucher' : 'Kode promo'} ${result.discount.code} berhasil diterapkan. Hemat ${result.amount.toLocaleString('id-ID')} rupiah.`);
  } catch (error) {
    delete req.session.checkoutDiscountCode;
    req.flash('error', error.message);
  }
  res.redirect('/checkout');
}

function removeDiscount(req, res) {
  delete req.session.checkoutDiscountCode;
  req.flash('success', 'Voucher atau kode promo dihapus dari checkout.');
  res.redirect('/checkout');
}

async function create(req, res) {
  const nonce = String(req.body.checkoutNonce || '');
  if (!nonce || nonce !== req.session.checkoutNonce) throw new AppError('Checkout sudah diproses atau sesi tidak valid.', 409, 'CHECKOUT_REPLAY');
  delete req.session.checkoutNonce;
  const existing = await Order.findOne({ idempotencyKey: `${req.user._id}:${nonce}` });
  if (existing) return res.redirect(`/payments/${existing.orderNumber}`);
  const { items, subtotal: itemsSubtotal } = await getPricedCart(req.user._id);
  if (!items.length) throw new AppError('Keranjang kosong.', 400);
  let discountResult;
  try { discountResult = await resolveDiscount(req, items, itemsSubtotal, { strict: true }); }
  catch (error) { req.flash('error', error.message); return res.redirect('/checkout'); }
  const discountAmount = discountResult?.amount || 0;
  const subtotal = itemsSubtotal - discountAmount;
  if (subtotal < 1) throw new AppError('Total setelah diskon harus minimal Rp1.', 400, 'INVALID_DISCOUNT_TOTAL');
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
    itemsSubtotal,
    ...(discountResult?.snapshot || {}),
    ...initial,
    paymentMethod: rule.method
  });
  delete req.session.checkoutDiscountCode;
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
module.exports = { show, applyDiscount, removeDiscount, create };
