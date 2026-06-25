const crypto = require('crypto');
const Order = require('../models/Order');
const WalletDeposit = require('../models/WalletDeposit');
const Payment = require('../models/Payment');
const pakasir = require('./pakasirService');
const orderService = require('./orderService');
const walletService = require('./walletService');
const { env } = require('../config/env');
const logger = require('../utils/logger');

function normalizeStatus(status) {
  if (status === 'completed' || status === 'paid') return 'paid';
  if (['expired', 'failed', 'cancelled'].includes(status)) return status;
  return 'pending';
}

async function claimOrder(orderId, lockId) {
  const staleLock = new Date(Date.now() - 10 * 60 * 1000);
  return Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentStatus: { $in: ['initializing', 'pending', 'compensation_required'] },
      $or: [{ maintenanceLockedAt: null }, { maintenanceLockedAt: { $lt: staleLock } }]
    },
    { $set: { maintenanceLockedAt: new Date(), maintenanceLockId: lockId } },
    { new: true }
  ).select('+maintenanceLockedAt +maintenanceLockId');
}

async function releaseOrderLock(orderId, lockId) {
  await Order.updateOne(
    { _id: orderId, maintenanceLockId: lockId },
    { $set: { maintenanceLockedAt: null, maintenanceLockId: '' } }
  ).catch(() => {});
}

async function processOrder(candidate, stats) {
  const lockId = crypto.randomUUID();
  const order = await claimOrder(candidate._id, lockId);
  if (!order) { stats.skipped += 1; return; }

  try {
    if (order.paymentStatus === 'initializing' && !order.pakasirTransactionId) {
      await orderService.updateNonPaidStatus(order, 'failed', {
        provider: 'internal', order_id: order.orderNumber, amount: order.pakasirAmount, status: 'failed', reason: 'Checkout initialization timeout'
      });
      stats.failed += 1;
      return;
    }

    let transaction;
    try {
      transaction = await pakasir.getTransactionDetail({ orderId: order.orderNumber, amount: order.pakasirAmount });
    } catch (error) {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            paymentStatus: order.paymentStatus === 'compensation_required' ? 'compensation_required' : order.paymentStatus,
            'compensation.required': order.paymentStatus === 'compensation_required',
            'compensation.lastError': error.message,
            'compensation.lastAttemptAt': new Date()
          },
          $inc: { 'compensation.attempts': 1 }
        }
      );
      stats.retryRequired += 1;
      return;
    }

    const status = normalizeStatus(transaction.status);
    if (status === 'paid') {
      await orderService.markPaid(order._id, transaction);
      stats.paid += 1;
      return;
    }
    if (status !== 'pending') {
      await orderService.updateNonPaidStatus(order, status, transaction);
      stats[status] = (stats[status] || 0) + 1;
      return;
    }

    const mustClose = order.paymentStatus === 'compensation_required' || (order.expiresAt && order.expiresAt <= new Date());
    if (!mustClose) { stats.pending += 1; return; }

    try {
      const cancelResponse = await pakasir.cancelTransaction({ orderId: order.orderNumber, amount: order.pakasirAmount });
      await orderService.updateNonPaidStatus(order, order.paymentStatus === 'compensation_required' ? 'cancelled' : 'expired', {
        ...transaction,
        status: order.paymentStatus === 'compensation_required' ? 'cancelled' : 'expired',
        cancelResponse
      });
      stats.closed += 1;
    } catch (error) {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            paymentStatus: 'compensation_required',
            'compensation.required': true,
            'compensation.lastError': error.message,
            'compensation.lastAttemptAt': new Date()
          },
          $inc: { 'compensation.attempts': 1 }
        }
      );
      stats.retryRequired += 1;
    }
  } catch (error) {
    stats.errors += 1;
    logger.error('maintenance.order_failed', { orderNumber: order.orderNumber, error });
  } finally {
    await releaseOrderLock(order._id, lockId);
  }
}

async function cleanupOrders({ limit = env.maintenanceBatchSize } = {}) {
  const now = new Date();
  const initializationCutoff = new Date(Date.now() - env.orderInitializationTimeoutMinutes * 60 * 1000);
  const candidates = await Order.find({
    $or: [
      { paymentStatus: 'initializing', createdAt: { $lte: initializationCutoff } },
      { paymentStatus: 'pending', expiresAt: { $lte: now } },
      { paymentStatus: 'compensation_required' }
    ]
  }).select('_id').sort({ createdAt: 1 }).limit(limit);

  const stats = { scanned: candidates.length, paid: 0, pending: 0, failed: 0, expired: 0, cancelled: 0, closed: 0, retryRequired: 0, skipped: 0, errors: 0 };
  for (const candidate of candidates) await processOrder(candidate, stats);
  return stats;
}

async function cleanupDeposits({ limit = env.maintenanceBatchSize } = {}) {
  const now = new Date();
  const deposits = await WalletDeposit.find({ status: 'pending', expiresAt: { $lte: now } }).sort({ createdAt: 1 }).limit(limit);
  const stats = { scanned: deposits.length, paid: 0, expired: 0, pending: 0, errors: 0 };
  for (const deposit of deposits) {
    try {
      const transaction = await pakasir.getTransactionDetail({ orderId: deposit.depositNumber, amount: deposit.amount });
      const status = normalizeStatus(transaction.status);
      if (status === 'paid') {
        await walletService.creditPaidDeposit(deposit._id, transaction);
        stats.paid += 1;
      } else if (status === 'pending') {
        try { await pakasir.cancelTransaction({ orderId: deposit.depositNumber, amount: deposit.amount }); } catch (_) {}
        await walletService.updateDepositStatus(deposit, 'expired', { ...transaction, status: 'expired' });
        stats.expired += 1;
      } else {
        await walletService.updateDepositStatus(deposit, status, transaction);
        stats[status] = (stats[status] || 0) + 1;
      }
    } catch (error) {
      stats.errors += 1;
      logger.error('maintenance.deposit_failed', { depositNumber: deposit.depositNumber, error });
    }
  }
  return stats;
}

async function runMaintenance(options = {}) {
  const startedAt = new Date();
  const [orders, deposits] = await Promise.all([cleanupOrders(options), cleanupDeposits(options)]);
  await Payment.updateMany(
    { status: 'pending', expiresAt: { $lte: new Date() } },
    { $set: { status: 'expired', lastCheckedAt: new Date() } }
  ).catch(() => {});
  return { startedAt, completedAt: new Date(), orders, deposits };
}

module.exports = { normalizeStatus, cleanupOrders, cleanupDeposits, runMaintenance };
