const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { AppError } = require('../utils/errors');
const emailService = require('./emailService');

async function markPaid(orderId, transaction) {
  const session = await mongoose.startSession();
  let paidOrder;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new AppError('Pesanan tidak ditemukan.', 404, 'ORDER_NOT_FOUND');
      if (order.paymentStatus === 'paid') { paidOrder = order; return; }
      if (Number(transaction.amount) !== order.pakasirAmount || transaction.order_id !== order.orderNumber) throw new AppError('Nominal atau ID transaksi tidak cocok.', 400, 'PAYMENT_MISMATCH');
      for (const item of order.items) {
        const product = await Product.findById(item.product).session(session);
        if (!product || !product.active) throw new AppError(`Produk ${item.name} tidak tersedia.`, 409, 'PRODUCT_UNAVAILABLE');
        if (!product.unlimitedStock) {
          const updated = await Product.findOneAndUpdate({ _id: product._id, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity, soldCount: item.quantity } }, { new: true, session });
          if (!updated) throw new AppError(`Stok ${item.name} habis saat pembayaran diproses.`, 409, 'STOCK_COMMIT_FAILED');
        } else {
          await Product.updateOne({ _id: product._id }, { $inc: { soldCount: item.quantity } }, { session });
        }
      }
      order.paymentStatus = 'paid';
      order.orderStatus = 'fulfilled';
      order.paidAt = transaction.completed_at ? new Date(transaction.completed_at) : new Date();
      order.stockCommitted = true;
      order.accessGranted = true;
      order.lastWebhookData = transaction;
      await order.save({ session });
      await Payment.updateOne({ order: order._id }, { $set: { status: 'completed', lastCheckResponse: transaction, lastCheckedAt: new Date() } }, { session });
      await Cart.updateOne({ user: order.user }, { $pull: { items: { product: { $in: order.items.map((item) => item.product) } } } }, { session });
      paidOrder = order;
    });
  } finally { await session.endSession(); }
  if (!paidOrder) throw new AppError('Pembayaran gagal diproses.', 500, 'PAYMENT_PROCESS_FAILED');
  const claimed = await Order.findOneAndUpdate({ _id: paidOrder._id, 'notifications.paidSent': false }, { $set: { 'notifications.paidSent': true, 'notifications.invoiceSent': true } }, { new: true }).populate('user');
  if (claimed?.user) {
    await Promise.all([
      emailService.sendInvoice(claimed.user.email, claimed),
      emailService.sendSimple(claimed.user.email, 'Pembayaran berhasil', { name: claimed.user.name, message: `Pembayaran pesanan ${claimed.orderNumber} berhasil. Produk digital Anda sudah dapat diunduh.`, action: { label: 'Buka produk saya', url: `${require('../config/env').env.appUrl}/account/purchases` } }, 'payment_success')
    ]);
  }
  return paidOrder;
}

async function updateNonPaidStatus(order, status, transaction) {
  const mapping = { failed: 'failed', expired: 'expired', cancelled: 'cancelled' };
  const normalized = mapping[status];
  if (!normalized || order.paymentStatus === 'paid') return order;
  order.paymentStatus = normalized;
  order.orderStatus = 'cancelled';
  order.lastWebhookData = transaction;
  await order.save();
  await Payment.updateOne({ order: order._id }, { $set: { status, lastCheckResponse: transaction, lastCheckedAt: new Date() } });
  const claimed = await Order.findOneAndUpdate({ _id: order._id, 'notifications.expiredSent': false }, { $set: { 'notifications.expiredSent': true } }, { new: true }).populate('user');
  if (claimed?.user) await emailService.sendSimple(claimed.user.email, `Pembayaran ${normalized}`, { name: claimed.user.name, message: `Pembayaran pesanan ${claimed.orderNumber} berstatus ${normalized}. Silakan buat pesanan baru bila masih ingin membeli produk tersebut.`, action: { label: 'Lihat pesanan', url: `${require('../config/env').env.appUrl}/orders/${claimed.orderNumber}` } }, `payment_${normalized}`);
  return order;
}
module.exports = { markPaid, updateNonPaidStatus };
