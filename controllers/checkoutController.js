const crypto = require('crypto');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { getPricedCart } = require('../services/cartService');
const { getStoreSettings } = require('../services/settingService');
const { calculateFeeSplit } = require('../services/feeService');
const { validateDiscountForCart, normalizeCode, reserveDiscountUsage } = require('../services/discountService');
const walletService = require('../services/walletService');
const stockReservationService = require('../services/stockReservationService');
const logger = require('../utils/logger');
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

function internalBreakdown(subtotal, walletAmount = 0) {
  return {
    subtotal,
    gatewayFee: 0,
    userFee: 0,
    merchantFee: 0,
    merchantNet: subtotal,
    total: subtotal,
    pakasirAmount: 0,
    walletAmount,
    externalSubtotal: 0
  };
}

function freeBreakdown() {
  return { subtotal: 0, gatewayFee: 0, userFee: 0, merchantFee: 0, merchantNet: 0, total: 0, pakasirAmount: 0 };
}

function buildPaymentOptions(settings, subtotal, walletBalance) {
  const options = [];
  const usableWallet = settings.wallet?.enabled === false ? 0 : Math.min(Math.max(0, walletBalance), subtotal);
  if (usableWallet >= subtotal && subtotal > 0) {
    options.push({
      value: 'wallet',
      type: 'wallet',
      label: 'Saldo TOKOZYPHRA',
      description: 'Bayar langsung dari dompet',
      walletAmount: subtotal,
      externalSubtotal: 0,
      total: subtotal
    });
  }

  for (const rawRule of settings.paymentFees.filter((entry) => entry.active)) {
    const rule = rawRule.toObject?.() || rawRule;
    try {
      const quote = calculateFeeSplit(subtotal, rule, settings.feeSplitThreshold);
      options.push({
        value: `gateway:${rule.method}`,
        type: 'gateway',
        method: rule.method,
        label: rule.label,
        description: 'Bayar melalui kanal pembayaran',
        walletAmount: 0,
        externalSubtotal: subtotal,
        quote,
        total: quote.total
      });
    } catch (_) {}

    if (usableWallet > 0 && usableWallet < subtotal) {
      const externalSubtotal = subtotal - usableWallet;
      try {
        const quote = calculateFeeSplit(externalSubtotal, rule, settings.feeSplitThreshold);
        options.push({
          value: `hybrid:${rule.method}`,
          type: 'hybrid',
          method: rule.method,
          label: `Saldo + ${rule.label}`,
          description: `Gunakan saldo Rp${usableWallet.toLocaleString('id-ID')}`,
          walletAmount: usableWallet,
          externalSubtotal,
          quote,
          total: usableWallet + quote.total
        });
      } catch (_) {}
    }
  }
  return options;
}

async function show(req, res) {
  const [{ items, subtotal: itemsSubtotal }, wallet] = await Promise.all([
    getPricedCart(req.user._id),
    walletService.getWallet(req.user._id)
  ]);
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
  const walletBalance = settings.wallet?.enabled === false || wallet.status !== 'active' ? 0 : wallet.balance;
  const paymentOptions = isFree ? [] : buildPaymentOptions(settings, subtotal, walletBalance);

  if (!isFree && !paymentOptions.length) throw new AppError('Belum ada pilihan pembayaran yang tersedia.', 503, 'NO_PAYMENT_METHOD');

  const nonce = crypto.randomBytes(24).toString('hex');
  req.session.checkoutNonce = nonce;
  res.render('checkout/index', {
    title: isFree ? 'Konfirmasi pesanan' : 'Checkout',
    items,
    itemsSubtotal,
    subtotal,
    isFree,
    wallet: { ...wallet.toObject(), balance: walletBalance },
    walletEnabled: settings.wallet?.enabled !== false && wallet.status === 'active',
    paymentOptions,
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
    req.flash('success', result.amount >= itemsSubtotal
      ? `${result.discount.code} berhasil diterapkan. Pesanan ini menjadi gratis.`
      : `${result.discount.code} berhasil diterapkan. Anda hemat Rp${result.amount.toLocaleString('id-ID')}.`);
  } catch (error) {
    delete req.session.checkoutDiscountCode;
    req.flash('error', error.message);
  }
  return res.redirect('/checkout');
}

function removeDiscount(req, res) {
  delete req.session.checkoutDiscountCode;
  req.flash('success', 'Kode promo dihapus dari checkout.');
  res.redirect('/checkout');
}

async function create(req, res) {
  const nonce = String(req.body.checkoutNonce || '');
  if (!nonce || nonce !== req.session.checkoutNonce) throw new AppError('Checkout sudah diproses atau sesi tidak valid.', 409, 'CHECKOUT_REPLAY');
  delete req.session.checkoutNonce;

  const idempotencyKey = `${req.user._id}:${nonce}`;
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) {
    return res.redirect(['free', 'wallet'].includes(existing.paymentMethod) ? `/orders/${existing.orderNumber}` : `/payments/${existing.orderNumber}`);
  }

  const [{ items, subtotal: itemsSubtotal }, wallet] = await Promise.all([
    getPricedCart(req.user._id),
    walletService.getWallet(req.user._id)
  ]);
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
  const settings = await getStoreSettings();
  const option = String(req.body.paymentOption || '');
  const walletEnabled = settings.wallet?.enabled !== false && wallet.status === 'active';

  let paymentMethod = 'free';
  let paymentChannel = 'free';
  let walletAmount = 0;
  let externalSubtotal = 0;
  let rule = null;
  let breakdown = freeBreakdown();

  if (subtotal > 0) {
    if (option === 'wallet') {
      if (!walletEnabled) throw new AppError('Pembayaran dengan saldo sedang tidak tersedia.', 503, 'WALLET_DISABLED');
      if (wallet.balance < subtotal) throw new AppError('Saldo dompet tidak mencukupi.', 400, 'WALLET_INSUFFICIENT');
      walletAmount = subtotal;
      breakdown = internalBreakdown(subtotal, walletAmount);
      paymentMethod = 'wallet';
      paymentChannel = 'wallet';
    } else {
      const [type, method] = option.split(':');
      if (!['gateway', 'hybrid'].includes(type) || !method) throw new AppError('Pilih metode pembayaran.', 400, 'PAYMENT_OPTION_REQUIRED');
      rule = settings.paymentFees.find((entry) => entry.method === method && entry.active);
      if (!rule) throw new AppError('Metode pembayaran tidak tersedia.', 400, 'PAYMENT_METHOD_UNAVAILABLE');

      if (type === 'hybrid') {
        if (!walletEnabled) throw new AppError('Pembayaran gabungan sedang tidak tersedia.', 503, 'WALLET_DISABLED');
        walletAmount = Math.min(wallet.balance, subtotal);
        if (walletAmount <= 0 || walletAmount >= subtotal) throw new AppError('Pilihan kombinasi saldo tidak tersedia.', 400, 'HYBRID_NOT_AVAILABLE');
        paymentChannel = 'hybrid';
      } else {
        paymentChannel = 'gateway';
      }

      externalSubtotal = subtotal - walletAmount;
      const gateway = calculateFeeSplit(externalSubtotal, rule, settings.feeSplitThreshold);
      breakdown = {
        subtotal,
        gatewayFee: gateway.gatewayFee,
        userFee: gateway.userFee,
        merchantFee: gateway.merchantFee,
        merchantNet: walletAmount + gateway.merchantNet,
        total: walletAmount + gateway.total,
        pakasirAmount: gateway.pakasirAmount,
        walletAmount,
        externalSubtotal
      };
      paymentMethod = rule.method;
    }
  }

  const orderNumber = randomId('ORD-');
  const invoiceNumber = randomId('INV-');
  const provisionalExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
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
    paymentMethod,
    paymentChannel,
    paymentStatus: 'initializing',
    expiresAt: provisionalExpiry
  });

  delete req.session.checkoutDiscountCode;
  let gatewayCreated = false;
  let gatewayCancelAmount = breakdown.pakasirAmount;
  let gatewaySnapshot = null;

  try {
    const reservationSession = await mongoose.startSession();
    try {
      await reservationSession.withTransaction(async () => {
        await stockReservationService.reserveOrderStock(order._id, reservationSession);
        await reserveDiscountUsage(order._id, reservationSession);
      });
    } finally {
      await reservationSession.endSession();
    }

    if (walletAmount > 0) {
      await walletService.reserveForOrder({ userId: req.user._id, orderId: order._id, orderNumber, amount: walletAmount });
    }

    if (paymentChannel === 'free') {
      await orderService.fulfillFreeOrder(order._id);
      req.flash('success', 'Pesanan berhasil dikonfirmasi. Produk sudah tersedia di akun Anda.');
      return res.redirect(`/orders/${orderNumber}`);
    }

    if (paymentChannel === 'wallet') {
      await orderService.fulfillWalletOrder(order._id);
      req.flash('success', 'Pembayaran dengan saldo berhasil. Produk sudah tersedia di akun Anda.');
      return res.redirect(`/orders/${orderNumber}`);
    }

    const result = await pakasir.createReconciledTransaction({
      method: rule.method,
      orderId: orderNumber,
      subtotal: externalSubtotal,
      threshold: settings.feeSplitThreshold,
      initialAmount: breakdown.pakasirAmount
    });
    gatewayCreated = true;
    const payment = result.payment;
    gatewayCancelAmount = Number(payment.amount || result.split.pakasirAmount);
    gatewaySnapshot = {
      pakasirAmount: gatewayCancelAmount,
      pakasirTransactionId: payment.transaction_id || payment.order_id,
      paymentNumber: payment.payment_number,
      expiresAt: payment.expired_at ? new Date(payment.expired_at) : provisionalExpiry,
      gatewayFee: result.split.gatewayFee,
      userFee: result.split.userFee,
      merchantFee: result.split.merchantFee,
      merchantNet: walletAmount + result.split.merchantNet,
      total: walletAmount + result.split.total
    };

    Object.assign(order, {
      gatewayFee: result.split.gatewayFee,
      userFee: result.split.userFee,
      merchantFee: result.split.merchantFee,
      merchantNet: walletAmount + result.split.merchantNet,
      total: walletAmount + result.split.total,
      pakasirAmount: result.split.pakasirAmount,
      pakasirTransactionId: payment.transaction_id || payment.order_id,
      paymentNumber: payment.payment_number,
      expiresAt: payment.expired_at ? new Date(payment.expired_at) : provisionalExpiry,
      paymentStatus: 'pending'
    });
    if (rule.method === 'qris' && payment.payment_number) {
      order.paymentQrDataUrl = await QRCode.toDataURL(payment.payment_number, { margin: 1, width: 320 });
    }

    const persistenceSession = await mongoose.startSession();
    try {
      await persistenceSession.withTransaction(async () => {
        await order.save({ session: persistenceSession });
        await Payment.updateOne(
          { order: order._id },
          {
            $set: {
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
            },
            $setOnInsert: { provider: 'pakasir' }
          },
          { upsert: true, session: persistenceSession }
        );
      });
    } finally {
      await persistenceSession.endSession();
    }

    if (env.smtp.adminEmail) {
      await emailService.sendSimple(env.smtp.adminEmail, 'Pesanan baru', {
        name: 'Admin',
        message: `Pesanan ${orderNumber} baru saja dibuat.`,
        action: { label: 'Lihat pesanan', url: `${env.appUrl}/admin/orders/${orderNumber}` }
      }, 'admin_new_order');
    }
    return res.redirect(`/payments/${orderNumber}`);
  } catch (error) {
    let compensationSucceeded = !gatewayCreated;
    if (gatewayCreated) {
      try {
        await pakasir.cancelTransaction({ orderId: orderNumber, amount: gatewayCancelAmount });
        compensationSucceeded = true;
      } catch (compensationError) {
        logger.error('checkout.compensation_failed', {
          requestId: req.id,
          orderNumber,
          error: compensationError
        });
        await Order.updateOne(
          { _id: order._id, paymentStatus: { $ne: 'paid' } },
          {
            $set: {
              ...(gatewaySnapshot || {}),
              paymentStatus: 'compensation_required',
              orderStatus: 'awaiting_payment',
              'compensation.required': true,
              'compensation.lastError': compensationError.message,
              'compensation.lastAttemptAt': new Date()
            },
            $inc: { 'compensation.attempts': 1 }
          }
        ).catch(() => {});
      }
    }

    if (compensationSucceeded) {
      const current = await Order.findById(order._id).catch(() => null);
      if (current && current.paymentStatus !== 'paid') {
        await orderService.updateNonPaidStatus(current, 'failed', {
          provider: gatewayCreated ? 'pakasir' : 'internal',
          order_id: orderNumber,
          amount: gatewayCancelAmount,
          status: 'failed',
          reason: error.message
        }).catch((cleanupError) => logger.error('checkout.cleanup_failed', { requestId: req.id, orderNumber, error: cleanupError }));
      }
    }
    throw error;
  }
}

module.exports = { show, applyDiscount, removeDiscount, create, freeBreakdown, internalBreakdown, buildPaymentOptions };
