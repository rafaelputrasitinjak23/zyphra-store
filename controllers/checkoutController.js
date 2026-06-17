const crypto = require('crypto');
const QRCode = require('qrcode');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { getPricedCart } = require('../services/cartService');
const { getStoreSettings } = require('../services/settingService');
const { calculateFeeSplit } = require('../services/feeService');
const { validateDiscountForCart, normalizeCode } = require('../services/discountService');
const pakasir = require('../services/pakasirService');
const orderService = require('../services/orderService');
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

function freeBreakdown() {
  return {
    subtotal: 0,
    gatewayFee: 0,
    userFee: 0,
    merchantFee: 0,
    merchantNet: 0,
    total: 0,
    pakasirAmount: 0
  };
}

async function show(req, res) {
  const { items, subtotal: itemsSubtotal } = await getPricedCart(req.user._id);
  if (!items.length) {
    req.flash('error', 'Keranjang masih kosong.');
    return res.redirect('/cart');
  }

  let discountResult;
  try {
    discountResult = await resolveDiscount(req, items, itemsSubtotal, { strict: true });
  } catch (error) {
    req.flash('error', error.message);
    return res.redirect('/checkout');
  }

  const discountAmount = discountResult?.amount || 0;
  const subtotal = Math.max(0, itemsSubtotal - discountAmount);
  const isFree = subtotal === 0;
  const settings = await getStoreSettings();
  const methods = isFree
    ? []
    : settings.paymentFees
      .filter((rule) => rule.active)
      .map((rule) => ({ ...rule.toObject?.() || rule, quote: calculateFeeSplit(subtotal, rule, settings.feeSplitThreshold) }));

  if (!isFree && !methods.length) {
    throw new AppError('Tidak ada metode pembayaran yang aktif.', 503, 'NO_PAYMENT_METHOD');
  }

  const nonce = crypto.randomBytes(24).toString('hex');
  req.session.checkoutNonce = nonce;
  res.render('checkout/index', {
    title: isFree ? 'Konfirmasi produk gratis' : 'Checkout',
    items,
    itemsSubtotal,
    subtotal,
    methods,
    isFree,
    threshold: settings.feeSplitThreshold,
    nonce,
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
  if (!code) {
    req.flash('error', 'Masukkan voucher atau kode promo.');
    return res.redirect('/checkout');
  }
  try {
    const result = await validateDiscountForCart({ code, userId: req.user._id, items, itemsSubtotal });
    req.session.checkoutDiscountCode = result.discount.code;
    const makesFree = result.amount >= itemsSubtotal;
    req.flash(
      'success',
      makesFree
        ? `${result.discount.kind === 'voucher' ? 'Voucher' : 'Kode promo'} ${result.discount.code} berhasil diterapkan. Total produk menjadi gratis.`
        : `${result.discount.kind === 'voucher' ? 'Voucher' : 'Kode promo'} ${result.discount.code} berhasil diterapkan. Hemat ${result.amount.toLocaleString('id-ID')} rupiah.`
    );
  } catch (error) {
    delete req.session.checkoutDiscountCode;
    req.flash('error', error.message);
  }
  return res.redirect('/checkout');
}

function removeDiscount(req, res) {
  delete req.session.checkoutDiscountCode;
  req.flash('success', 'Voucher atau kode promo dihapus dari checkout.');
  res.redirect('/checkout');
}

async function create(req, res) {
  const nonce = String(req.body.checkoutNonce || '');
  if (!nonce || nonce !== req.session.checkoutNonce) {
    throw new AppError('Checkout sudah diproses atau sesi tidak valid.', 409, 'CHECKOUT_REPLAY');
  }
  delete req.session.checkoutNonce;

  const idempotencyKey = `${req.user._id}:${nonce}`;
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) {
    return res.redirect(existing.paymentMethod === 'free' ? `/orders/${existing.orderNumber}` : `/payments/${existing.orderNumber}`);
  }

  const { items, subtotal: itemsSubtotal } = await getPricedCart(req.user._id);
  if (!items.length) throw new AppError('Keranjang kosong.', 400);

  let discountResult;
  try {
    discountResult = await resolveDiscount(req, items, itemsSubtotal, { strict: true });
  } catch (error) {
    req.flash('error', error.message);
    return res.redirect('/checkout');
  }

  const discountAmount = discountResult?.amount || 0;
  const subtotal = Math.max(0, itemsSubtotal - discountAmount);
  const isFree = subtotal === 0;
  const settings = await getStoreSettings();

  let rule = null;
  let breakdown;
  let paymentMethod;

  if (isFree) {
    breakdown = freeBreakdown();
    paymentMethod = 'free';
  } else {
    rule = settings.paymentFees.find((entry) => entry.method === req.body.paymentMethod && entry.active);
    if (!rule) throw new AppError('Metode pembayaran tidak tersedia.', 400);
    breakdown = calculateFeeSplit(subtotal, rule, settings.feeSplitThreshold);
    paymentMethod = rule.method;
  }

  const orderNumber = randomId('ORD-');
  const invoiceNumber = randomId('INV-');
  const order = await Order.create({
    orderNumber,
    invoiceNumber,
    idempotencyKey,
    user: req.user._id,
    buyerSnapshot: { name: req.user.name, email: req.user.email },
    items: items.map(({ product, quantity, unitPrice, lineTotal }) => ({
      product: product._id,
      name: product.name,
      slug: product.slug,
      thumbnail: product.thumbnail,
      unitPrice,
      quantity,
      lineTotal,
      version: product.version,
      downloadLimit: product.downloadLimit
    })),
    itemsSubtotal,
    ...(discountResult?.snapshot || {}),
    ...breakdown,
    paymentMethod
  });

  delete req.session.checkoutDiscountCode;

  if (isFree) {
    try {
      await orderService.fulfillFreeOrder(order._id);
      if (env.smtp.adminEmail) {
        await emailService.sendSimple(
          env.smtp.adminEmail,
          'Pesanan gratis baru',
          {
            name: 'Admin',
            message: `Pesanan ${orderNumber} dikonfirmasi otomatis tanpa payment gateway karena totalnya Rp0.`,
            action: { label: 'Lihat pesanan', url: `${env.appUrl}/admin/orders/${orderNumber}` }
          },
          'admin_new_free_order'
        );
      }
      req.flash('success', 'Pesanan gratis berhasil dikonfirmasi. Produk sudah tersedia di akun Anda.');
      return res.redirect(`/orders/${orderNumber}`);
    } catch (error) {
      await Order.updateOne(
        { _id: order._id, paymentStatus: { $ne: 'paid' } },
        { $set: { paymentStatus: 'failed', orderStatus: 'cancelled' } }
      ).catch(() => {});
      throw error;
    }
  }

  try {
    const result = await pakasir.createReconciledTransaction({
      method: rule.method,
      orderId: orderNumber,
      subtotal,
      threshold: settings.feeSplitThreshold,
      initialAmount: breakdown.pakasirAmount
    });
    const payment = result.payment;
    Object.assign(order, result.split, {
      pakasirTransactionId: payment.transaction_id || payment.order_id,
      paymentNumber: payment.payment_number,
      expiresAt: payment.expired_at ? new Date(payment.expired_at) : new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    if (rule.method === 'qris' && payment.payment_number) {
      order.paymentQrDataUrl = await QRCode.toDataURL(payment.payment_number, { margin: 1, width: 320 });
    }
    await order.save();
    await Payment.create({
      order: order._id,
      providerTransactionId: order.pakasirTransactionId,
      method: rule.method,
      amount: payment.amount,
      fee: payment.fee,
      totalPayment: payment.total_payment,
      status: payment.status || 'pending',
      paymentNumber: payment.payment_number,
      expiresAt: order.expiresAt,
      createRequest: result.safeRequest,
      createResponse: result.raw
    });
    if (env.smtp.adminEmail) {
      await emailService.sendSimple(
        env.smtp.adminEmail,
        'Pesanan baru',
        {
          name: 'Admin',
          message: `Pesanan ${orderNumber} dibuat dengan total ${order.total}.`,
          action: { label: 'Lihat pesanan', url: `${env.appUrl}/admin/orders/${orderNumber}` }
        },
        'admin_new_order'
      );
    }
    return res.redirect(`/payments/${orderNumber}`);
  } catch (error) {
    order.paymentStatus = 'failed';
    order.orderStatus = 'cancelled';
    await order.save();
    throw error;
  }
}

module.exports = { show, applyDiscount, removeDiscount, create, freeBreakdown };
