const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { AppError } = require('../utils/errors');
const emailService = require('./emailService');
const walletService = require('./walletService');
const { commitDiscountUsage } = require('./discountService');

function paymentUpsert(transaction, order) {
  const provider = transaction.provider === 'internal' ? 'internal' : 'pakasir';
  const insert = {
    provider,
    method: order.paymentMethod,
    amount: Number(transaction.amount ?? order.pakasirAmount ?? 0),
    fee: Number(transaction.fee ?? order.gatewayFee ?? 0),
    totalPayment: Number(transaction.total_payment ?? Math.max(0, order.total - order.walletAmount) ?? 0),
    paymentNumber: order.paymentNumber || undefined,
    expiresAt: order.expiresAt || undefined
  };
  const transactionId = transaction.transaction_id || transaction.provider_transaction_id || order.pakasirTransactionId;
  if (transactionId) insert.providerTransactionId = transactionId;
  return {
    $set: { status: 'completed', lastCheckResponse: transaction, lastCheckedAt: new Date() },
    $setOnInsert: insert
  };
}

async function markPaid(orderId, transaction) {
  const session = await mongoose.startSession();
  let paidOrder;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new AppError('Pesanan tidak ditemukan.', 404, 'ORDER_NOT_FOUND');
      if (order.paymentStatus === 'paid') {
        paidOrder = order;
        return;
      }

      if (Number(transaction.amount) !== order.pakasirAmount || transaction.order_id !== order.orderNumber) {
        throw new AppError('Nominal atau ID transaksi tidak cocok.', 400, 'PAYMENT_MISMATCH');
      }

      for (const item of order.items) {
        const product = await Product.findById(item.product).session(session);
        if (!product || !product.active) throw new AppError(`Produk ${item.name} tidak tersedia.`, 409, 'PRODUCT_UNAVAILABLE');
        if (!product.unlimitedStock) {
          const updated = await Product.findOneAndUpdate(
            { _id: product._id, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity, soldCount: item.quantity } },
            { new: true, session }
          );
          if (!updated) throw new AppError(`Stok ${item.name} habis saat pesanan diproses.`, 409, 'STOCK_COMMIT_FAILED');
        } else {
          await Product.updateOne({ _id: product._id }, { $inc: { soldCount: item.quantity } }, { session });
        }
      }

      if (order.walletAmount > 0) await walletService.commitReservedForOrder(order, session);

      order.paymentStatus = 'paid';
      order.orderStatus = 'fulfilled';
      order.paidAt = transaction.completed_at ? new Date(transaction.completed_at) : new Date();
      order.stockCommitted = true;
      order.accessGranted = true;
      order.lastWebhookData = transaction;
      await order.save({ session });

      await Payment.updateOne({ order: order._id }, paymentUpsert(transaction, order), { session, upsert: true });
      await Cart.updateOne(
        { user: order.user },
        { $pull: { items: { product: { $in: order.items.map((item) => item.product) } } } },
        { session }
      );
      await commitDiscountUsage(order._id, session);
      paidOrder = order;
    });
  } finally {
    await session.endSession();
  }

  if (!paidOrder) throw new AppError('Pesanan gagal diproses.', 500, 'PAYMENT_PROCESS_FAILED');

  const claimed = await Order.findOneAndUpdate(
    { _id: paidOrder._id, 'notifications.paidSent': false },
    { $set: { 'notifications.paidSent': true, 'notifications.invoiceSent': true } },
    { new: true }
  ).populate('user');

  if (claimed?.user) {
    const isFree = claimed.paymentChannel === 'free' || claimed.total === 0;
    const isWallet = claimed.paymentChannel === 'wallet';
    await Promise.all([
      emailService.sendInvoice(claimed.user.email, claimed),
      emailService.sendSimple(
        claimed.user.email,
        isFree ? 'Produk berhasil diklaim' : 'Pesanan berhasil',
        {
          name: claimed.user.name,
          message: isFree
            ? `Pesanan ${claimed.orderNumber} berhasil dikonfirmasi. Produk Anda sudah tersedia.`
            : isWallet
              ? `Pembayaran pesanan ${claimed.orderNumber} menggunakan saldo berhasil. Produk Anda sudah tersedia.`
              : `Pembayaran pesanan ${claimed.orderNumber} berhasil. Produk Anda sudah tersedia.`,
          action: { label: 'Buka produk saya', url: `${require('../config/env').env.appUrl}/account/purchases` }
        },
        isFree ? 'free_order_success' : 'payment_success'
      )
    ]);
  }
  return paidOrder;
}

async function fulfillFreeOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Pesanan tidak ditemukan.', 404, 'ORDER_NOT_FOUND');
  if (!((order.paymentChannel === 'free' || order.paymentMethod === 'free') && order.total === 0 && order.subtotal === 0 && order.pakasirAmount === 0)) {
    throw new AppError('Pesanan ini bukan transaksi gratis.', 400, 'ORDER_NOT_FREE');
  }
  order.paymentChannel = 'free';
  if (['cancelled', 'refunded'].includes(order.paymentStatus)) throw new AppError('Pesanan yang dibatalkan tidak dapat dikonfirmasi ulang.', 409, 'FREE_ORDER_CANNOT_REOPEN');
  return markPaid(order._id, {
    provider: 'internal', transaction_id: `FREE-${order.orderNumber}`, order_id: order.orderNumber,
    amount: 0, fee: 0, total_payment: 0, status: 'completed', completed_at: new Date().toISOString()
  });
}

async function fulfillWalletOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Pesanan tidak ditemukan.', 404, 'ORDER_NOT_FOUND');
  if (order.paymentChannel !== 'wallet' || order.walletAmount !== order.subtotal || order.pakasirAmount !== 0) {
    throw new AppError('Pesanan ini bukan pembayaran dompet penuh.', 400, 'ORDER_NOT_WALLET');
  }
  if (['cancelled', 'refunded'].includes(order.paymentStatus)) throw new AppError('Pesanan yang dibatalkan tidak dapat dikonfirmasi ulang.', 409, 'WALLET_ORDER_CANNOT_REOPEN');
  return markPaid(order._id, {
    provider: 'internal', transaction_id: `WALLET-${order.orderNumber}`, order_id: order.orderNumber,
    amount: 0, fee: 0, total_payment: order.walletAmount, status: 'completed', completed_at: new Date().toISOString()
  });
}

async function updateNonPaidStatus(order, status, transaction) {
  const mapping = { failed: 'failed', expired: 'expired', cancelled: 'cancelled' };
  const normalized = mapping[status];
  if (!normalized || order.paymentStatus === 'paid') return order;

  const session = await mongoose.startSession();
  let updatedOrder;
  try {
    await session.withTransaction(async () => {
      const current = await Order.findById(order._id).session(session);
      if (!current || current.paymentStatus === 'paid') {
        updatedOrder = current;
        return;
      }
      current.paymentStatus = normalized;
      current.orderStatus = 'cancelled';
      current.lastWebhookData = transaction;
      if (current.walletAmount > 0) await walletService.releaseReservedForOrder(current, `Pesanan ${normalized}.`, session);
      await current.save({ session });
      await Payment.updateOne(
        { order: current._id },
        { $set: { status, lastCheckResponse: transaction, lastCheckedAt: new Date() } },
        { session }
      );
      updatedOrder = current;
    });
  } finally {
    await session.endSession();
  }

  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, 'notifications.expiredSent': false },
    { $set: { 'notifications.expiredSent': true } },
    { new: true }
  ).populate('user');
  if (claimed?.user) {
    await emailService.sendSimple(
      claimed.user.email,
      'Pesanan belum selesai',
      {
        name: claimed.user.name,
        message: `Pesanan ${claimed.orderNumber} tidak dapat diselesaikan. Saldo yang sempat digunakan telah dikembalikan secara otomatis.`,
        action: { label: 'Lihat pesanan', url: `${require('../config/env').env.appUrl}/orders/${claimed.orderNumber}` }
      },
      `payment_${normalized}`
    );
  }
  return updatedOrder;
}

module.exports = { markPaid, fulfillFreeOrder, fulfillWalletOrder, updateNonPaidStatus };
