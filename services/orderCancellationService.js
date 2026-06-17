const Order = require('../models/Order');
const Payment = require('../models/Payment');
const pakasir = require('./pakasirService');
const orderService = require('./orderService');
const { AppError } = require('../utils/errors');

function normalizeProviderStatus(status) {
  if (status === 'completed' || status === 'paid') return 'paid';
  if (['failed', 'expired', 'cancelled'].includes(status)) return status;
  return 'pending';
}

function canCancelOrder(order) {
  return Boolean(order && order.paymentStatus === 'pending' && order.orderStatus === 'awaiting_payment' && !order.accessGranted);
}

async function cancelOrder({ orderNumber, userId, isAdmin = false, reason = '' }) {
  const filter = { orderNumber };
  if (!isAdmin) filter.user = userId;
  let order = await Order.findOne(filter).select('+cancellationInProgress');
  if (!order) throw new AppError('Pesanan tidak ditemukan.', 404, 'ORDER_NOT_FOUND');
  if (order.paymentStatus === 'paid' || order.accessGranted) throw new AppError('Transaksi yang sudah dibayar tidak dapat dibatalkan.', 409, 'PAID_ORDER_CANNOT_CANCEL');
  if (order.paymentStatus === 'cancelled') return order;
  if (!canCancelOrder(order)) throw new AppError(`Transaksi berstatus ${order.paymentStatus} tidak dapat dibatalkan.`, 409, 'ORDER_CANNOT_CANCEL');

  order = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'pending', orderStatus: 'awaiting_payment', cancellationInProgress: { $ne: true } },
    { $set: { cancellationInProgress: true } },
    { new: true }
  ).select('+cancellationInProgress');
  if (!order) throw new AppError('Pembatalan transaksi sedang diproses atau status baru saja berubah.', 409, 'CANCEL_IN_PROGRESS');

  try {
    let before;
    try {
      before = await pakasir.getTransactionDetail({ orderId: order.orderNumber, amount: order.pakasirAmount });
      const beforeStatus = normalizeProviderStatus(before.status);
      if (beforeStatus === 'paid') {
        await orderService.markPaid(order._id, before);
        throw new AppError('Pembayaran sudah diterima sehingga transaksi tidak dapat dibatalkan.', 409, 'PAYMENT_ALREADY_COMPLETED');
      }
      if (beforeStatus !== 'pending') {
        await orderService.updateNonPaidStatus(order, beforeStatus, before);
        return Order.findById(order._id);
      }
    } catch (error) {
      if (error.code === 'PAYMENT_ALREADY_COMPLETED') throw error;
      if (!['PAKASIR_DETAIL_FAILED'].includes(error.code)) throw error;
    }

    const cancelResponse = await pakasir.cancelTransaction({ orderId: order.orderNumber, amount: order.pakasirAmount });
    let verified = null;
    try {
      verified = await pakasir.getTransactionDetail({ orderId: order.orderNumber, amount: order.pakasirAmount });
      const verifiedStatus = normalizeProviderStatus(verified.status);
      if (verifiedStatus === 'paid') {
        await orderService.markPaid(order._id, verified);
        throw new AppError('Pembayaran telah diterima sebelum pembatalan selesai.', 409, 'PAYMENT_COMPLETED_DURING_CANCEL');
      }
    } catch (error) {
      if (error.code === 'PAYMENT_COMPLETED_DURING_CANCEL') throw error;
      if (!['PAKASIR_DETAIL_FAILED'].includes(error.code)) throw error;
    }

    const cancellationData = { provider: 'pakasir', cancelResponse, verifiedResponse: verified, requestedAt: new Date() };
    order = await Order.findById(order._id).select('+cancellationInProgress');
    await orderService.updateNonPaidStatus(order, 'cancelled', cancellationData);
    await Promise.all([
      Order.updateOne({ _id: order._id }, {
        $set: {
          cancelledAt: new Date(),
          cancellationReason: String(reason || 'Dibatalkan oleh pengguna').trim().slice(0, 300),
          cancelledBy: isAdmin ? 'admin' : 'user',
          cancellationResponse: cancellationData,
          cancellationInProgress: false
        }
      }),
      Payment.updateOne({ order: order._id }, { $set: { status: 'cancelled', cancelResponse, cancelledAt: new Date() } })
    ]);
    return Order.findById(order._id);
  } finally {
    await Order.updateOne({ _id: order._id, cancellationInProgress: true }, { $set: { cancellationInProgress: false } }).catch(() => {});
  }
}

module.exports = { cancelOrder, canCancelOrder, normalizeProviderStatus };
