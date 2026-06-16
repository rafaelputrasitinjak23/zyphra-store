const Order = require('../models/Order');
const Payment = require('../models/Payment');
const WebhookLog = require('../models/WebhookLog');
const pakasir = require('../services/pakasirService');
const orderService = require('../services/orderService');
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
  res.render('payments/show', { title: 'Pembayaran', order });
}
async function check(req, res) {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
  if (!order) throw new AppError('Pesanan tidak ditemukan.', 404);
  const transaction = await pakasir.getTransactionDetail({ orderId: order.orderNumber, amount: order.pakasirAmount });
  const status = normalizeStatus(transaction.status);
  if (status === 'paid') await orderService.markPaid(order._id, transaction);
  else if (status !== 'pending') await orderService.updateNonPaidStatus(order, status, transaction);
  await Payment.updateOne({ order: order._id }, { $set: { lastCheckResponse: transaction, lastCheckedAt: new Date(), status: transaction.status } });
  req.flash('success', `Status pembayaran: ${status}.`);
  res.redirect(`/orders/${order.orderNumber}`);
}
async function webhook(req, res) {
  const payload = req.body;
  const eventKey = webhookEventKey(payload);
  let log = await WebhookLog.findOne({ eventKey });
  if (log && ['processed', 'ignored'].includes(log.status)) return res.status(200).json({ received: true, duplicate: true });
  if (log && log.status === 'received') return res.status(202).json({ received: true, processing: true });
  if (log) {
    log.status = 'received'; log.error = undefined; log.payload = payload; await log.save();
  } else {
    try { log = await WebhookLog.create({ eventKey, orderNumber: payload?.order_id, headers: { 'user-agent': req.get('user-agent'), 'x-webhook-secret': req.get('x-webhook-secret') ? '[provided]' : undefined }, payload }); }
    catch (error) {
      if (error.code !== 11000) throw error;
      log = await WebhookLog.findOne({ eventKey });
      if (!log || ['processed', 'ignored'].includes(log.status)) return res.status(200).json({ received: true, duplicate: true });
      return res.status(202).json({ received: true, processing: true });
    }
  }
  try {
    if (!pakasir.validateWebhookShape(payload, req.get('x-webhook-secret'))) throw new AppError('Webhook tidak valid.', 400, 'WEBHOOK_INVALID');
    const order = await Order.findOne({ orderNumber: payload.order_id });
    if (!order || Number(payload.amount) !== order.pakasirAmount) throw new AppError('Pesanan atau nominal webhook tidak cocok.', 400, 'WEBHOOK_MISMATCH');
    const transaction = await pakasir.getTransactionDetail({ orderId: order.orderNumber, amount: order.pakasirAmount });
    if (transaction.order_id !== order.orderNumber || Number(transaction.amount) !== order.pakasirAmount) throw new AppError('Verifikasi transaksi gagal.', 400, 'TRANSACTION_MISMATCH');
    const status = normalizeStatus(transaction.status);
    if (status === 'paid') await orderService.markPaid(order._id, transaction);
    else if (status !== 'pending') await orderService.updateNonPaidStatus(order, status, transaction);
    log.status = status === 'pending' ? 'ignored' : 'processed'; log.verifiedResponse = transaction; log.processedAt = new Date(); await log.save();
    res.status(200).json({ received: true });
  } catch (error) {
    log.status = 'failed'; log.error = error.message; log.processedAt = new Date(); await log.save();
    res.status(error.statusCode || 400).json({ received: false });
  }
}
module.exports = { show, check, webhook, normalizeStatus };
