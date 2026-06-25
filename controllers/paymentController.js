const Order = require('../models/Order');
const Payment = require('../models/Payment');
const WalletDeposit = require('../models/WalletDeposit');
const WebhookLog = require('../models/WebhookLog');
const pakasir = require('../services/pakasirService');
const orderService = require('../services/orderService');
const walletService = require('../services/walletService');
const { webhookEventKey } = require('../utils/webhook');
const { AppError } = require('../utils/errors');

function normalizeStatus(status) {
  if (status === 'completed' || status === 'paid') return 'paid';
  if (['expired', 'failed', 'cancelled'].includes(status)) return status;
  return 'pending';
}

async function show(req, res) {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id }).select('+paymentQrDataUrl');
  if (!order) throw new AppError('Pembayaran tidak ditemukan.', 404);
  if (order.paymentChannel === 'free' || order.total === 0) {
    if (order.paymentStatus !== 'paid') await orderService.fulfillFreeOrder(order._id);
    return res.redirect(`/orders/${order.orderNumber}`);
  }
  if (order.paymentChannel === 'wallet') {
    if (order.paymentStatus !== 'paid') await orderService.fulfillWalletOrder(order._id);
    return res.redirect(`/orders/${order.orderNumber}`);
  }
  return res.render('payments/show', { title: 'Pembayaran', order });
}

async function check(req, res) {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
  if (!order) throw new AppError('Pesanan tidak ditemukan.', 404);

  if (order.paymentChannel === 'free' || order.total === 0) {
    if (order.paymentStatus !== 'paid') await orderService.fulfillFreeOrder(order._id);
    req.flash('success', 'Pesanan sudah dikonfirmasi.');
    return res.redirect(`/orders/${order.orderNumber}`);
  }
  if (order.paymentChannel === 'wallet') {
    if (order.paymentStatus !== 'paid') await orderService.fulfillWalletOrder(order._id);
    req.flash('success', 'Pembayaran saldo berhasil.');
    return res.redirect(`/orders/${order.orderNumber}`);
  }

  const transaction = await pakasir.getTransactionDetail({ orderId: order.orderNumber, amount: order.pakasirAmount });
  const status = normalizeStatus(transaction.status);
  if (status === 'paid') await orderService.markPaid(order._id, transaction);
  else if (status !== 'pending') await orderService.updateNonPaidStatus(order, status, transaction);
  await Payment.updateOne({ order: order._id }, { $set: { lastCheckResponse: transaction, lastCheckedAt: new Date(), status: transaction.status } });
  req.flash('success', status === 'paid' ? 'Pembayaran berhasil dikonfirmasi.' : `Status pembayaran: ${status}.`);
  return res.redirect(`/orders/${order.orderNumber}`);
}

async function processDepositWebhook(payload) {
  const deposit = await WalletDeposit.findOne({ depositNumber: payload.order_id });
  if (!deposit) return null;
  if (Number(payload.amount) !== deposit.amount) throw new AppError('Nominal deposit tidak cocok.', 400, 'DEPOSIT_WEBHOOK_MISMATCH');
  const transaction = await pakasir.getTransactionDetail({ orderId: deposit.depositNumber, amount: deposit.amount });
  if (transaction.order_id !== deposit.depositNumber || Number(transaction.amount) !== deposit.amount) {
    throw new AppError('Verifikasi deposit gagal.', 400, 'DEPOSIT_TRANSACTION_MISMATCH');
  }
  const status = normalizeStatus(transaction.status);
  if (status === 'paid') await walletService.creditPaidDeposit(deposit._id, transaction);
  else if (status !== 'pending') await walletService.updateDepositStatus(deposit, status, transaction);
  else { deposit.lastCheckResponse = transaction; await deposit.save(); }
  return { status, transaction, type: 'deposit' };
}

async function processOrderWebhook(payload) {
  const order = await Order.findOne({ orderNumber: payload.order_id });
  if (!order || ['free', 'wallet'].includes(order.paymentChannel) || Number(payload.amount) !== order.pakasirAmount) {
    throw new AppError('Pesanan atau nominal webhook tidak cocok.', 400, 'WEBHOOK_MISMATCH');
  }
  const transaction = await pakasir.getTransactionDetail({ orderId: order.orderNumber, amount: order.pakasirAmount });
  if (transaction.order_id !== order.orderNumber || Number(transaction.amount) !== order.pakasirAmount) {
    throw new AppError('Verifikasi transaksi gagal.', 400, 'TRANSACTION_MISMATCH');
  }
  const status = normalizeStatus(transaction.status);
  if (status === 'paid') await orderService.markPaid(order._id, transaction);
  else if (status !== 'pending') await orderService.updateNonPaidStatus(order, status, transaction);
  return { status, transaction, type: 'order' };
}

async function webhook(req, res) {
  const payload = req.body;
  if (!pakasir.validateWebhookShape(payload, req.get('x-webhook-secret'))) {
    return res.status(400).json({ received: false, code: 'WEBHOOK_INVALID', requestId: req.id });
  }

  const eventKey = webhookEventKey(payload);
  let log = await WebhookLog.findOne({ eventKey });
  if (log && ['processed', 'ignored'].includes(log.status)) return res.status(200).json({ received: true, duplicate: true });
  if (log && log.status === 'received') return res.status(202).json({ received: true, processing: true });

  if (log) {
    log.status = 'received';
    log.error = undefined;
    log.payload = payload;
    log.headers = { 'user-agent': String(req.get('user-agent') || '').slice(0, 300), requestId: req.id };
    await log.save();
  } else {
    try {
      log = await WebhookLog.create({
        eventKey,
        orderNumber: payload.order_id,
        headers: { 'user-agent': String(req.get('user-agent') || '').slice(0, 300), requestId: req.id },
        payload
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      log = await WebhookLog.findOne({ eventKey });
      if (!log || ['processed', 'ignored'].includes(log.status)) return res.status(200).json({ received: true, duplicate: true });
      return res.status(202).json({ received: true, processing: true });
    }
  }

  try {
    let result = await processDepositWebhook(payload);
    if (!result) result = await processOrderWebhook(payload);
    log.status = result.status === 'pending' ? 'ignored' : 'processed';
    log.verifiedResponse = { type: result.type, transaction: result.transaction };
    log.processedAt = new Date();
    await log.save();
    return res.status(200).json({ received: true, requestId: req.id });
  } catch (error) {
    log.status = 'failed';
    log.error = String(error.message || 'Webhook processing failed').slice(0, 1000);
    log.processedAt = new Date();
    await log.save();
    return res.status(error.statusCode || 400).json({ received: false, code: error.code || 'WEBHOOK_FAILED', requestId: req.id });
  }
}

module.exports = { show, check, webhook, normalizeStatus, processDepositWebhook, processOrderWebhook };
