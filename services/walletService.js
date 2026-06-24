const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const WalletDeposit = require('../models/WalletDeposit');
const WalletVoucherClaim = require('../models/WalletVoucherClaim');
const DiscountCode = require('../models/DiscountCode');
const { AppError } = require('../utils/errors');
const { randomId } = require('../utils/helpers');
const { isDiscountCurrentlyActive, normalizeCode } = require('./discountService');
const emailService = require('./emailService');
const { env } = require('../config/env');

async function ensureWallet(userId, session = null) {
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  if (session) options.session = session;
  return Wallet.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, balance: 0, heldBalance: 0, status: 'active', version: 0 } },
    options
  );
}

async function getWallet(userId) {
  return ensureWallet(userId);
}

async function creditInSession({ userId, amount, type, referenceType, referenceId, title, description = '', idempotencyKey, metadata = {}, session }) {
  const normalizedAmount = Math.round(Number(amount));
  if (!Number.isInteger(normalizedAmount) || normalizedAmount <= 0) throw new AppError('Nominal saldo tidak valid.', 400, 'INVALID_WALLET_AMOUNT');

  const existing = await WalletTransaction.findOne({ idempotencyKey }).session(session);
  if (existing) return existing;

  await ensureWallet(userId, session);
  const before = await Wallet.findOne({ user: userId }).session(session);
  if (!before || before.status !== 'active') throw new AppError('Dompet sedang tidak tersedia.', 409, 'WALLET_UNAVAILABLE');

  const wallet = await Wallet.findOneAndUpdate(
    { _id: before._id, status: 'active' },
    {
      $inc: {
        balance: normalizedAmount,
        totalDeposited: type === 'deposit' ? normalizedAmount : 0,
        totalRewards: type === 'reward' ? normalizedAmount : 0,
        version: 1
      }
    },
    { new: true, session }
  );

  const [transaction] = await WalletTransaction.create([{
    wallet: wallet._id,
    user: userId,
    transactionNumber: randomId('WTR-'),
    idempotencyKey,
    type,
    direction: 'credit',
    status: 'completed',
    amount: normalizedAmount,
    balanceBefore: before.balance,
    balanceAfter: wallet.balance,
    referenceType,
    referenceId: String(referenceId),
    title,
    description,
    metadata,
    completedAt: new Date()
  }], { session });

  return transaction;
}

async function creditWallet(args) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await creditInSession({ ...args, session });
    });
  } finally {
    await session.endSession();
  }
  return result;
}

async function reserveForOrder({ userId, orderId, orderNumber, amount }) {
  const normalizedAmount = Math.round(Number(amount));
  if (normalizedAmount <= 0) return null;
  const idempotencyKey = `order-wallet:${orderId}`;
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const existing = await WalletTransaction.findOne({ idempotencyKey }).session(session);
      if (existing) {
        result = existing;
        return;
      }
      await ensureWallet(userId, session);
      const wallet = await Wallet.findOneAndUpdate(
        { user: userId, status: 'active', balance: { $gte: normalizedAmount } },
        { $inc: { balance: -normalizedAmount, heldBalance: normalizedAmount, version: 1 } },
        { new: true, session }
      );
      if (!wallet) throw new AppError('Saldo dompet tidak mencukupi.', 400, 'WALLET_INSUFFICIENT');
      const [transaction] = await WalletTransaction.create([{
        wallet: wallet._id,
        user: userId,
        transactionNumber: randomId('WTR-'),
        idempotencyKey,
        type: 'purchase',
        direction: 'debit',
        status: 'pending',
        amount: normalizedAmount,
        balanceBefore: wallet.balance + normalizedAmount,
        balanceAfter: wallet.balance,
        referenceType: 'order',
        referenceId: String(orderId),
        title: `Pembayaran ${orderNumber}`,
        description: 'Saldo disiapkan untuk menyelesaikan pesanan.'
      }], { session });
      result = transaction;
    });
  } finally {
    await session.endSession();
  }
  return result;
}

async function commitReservedForOrder(order, session) {
  const amount = Math.round(Number(order.walletAmount || 0));
  if (amount <= 0 || order.walletCommitted) return null;
  const idempotencyKey = `order-wallet:${order._id}`;
  const transaction = await WalletTransaction.findOne({ idempotencyKey }).session(session);
  if (!transaction) throw new AppError('Reservasi saldo pesanan tidak ditemukan.', 409, 'WALLET_RESERVATION_MISSING');
  if (transaction.status === 'completed') {
    order.walletCommitted = true;
    return transaction;
  }
  if (transaction.status !== 'pending') throw new AppError('Reservasi saldo sudah tidak aktif.', 409, 'WALLET_RESERVATION_INACTIVE');

  const wallet = await Wallet.findOneAndUpdate(
    { _id: transaction.wallet, heldBalance: { $gte: amount } },
    { $inc: { heldBalance: -amount, totalSpent: amount, version: 1 } },
    { new: true, session }
  );
  if (!wallet) throw new AppError('Saldo tertahan tidak mencukupi.', 409, 'WALLET_HOLD_MISMATCH');

  transaction.status = 'completed';
  transaction.title = `Pembayaran ${order.orderNumber}`;
  transaction.description = 'Pembayaran pesanan berhasil.';
  transaction.completedAt = new Date();
  await transaction.save({ session });
  order.walletCommitted = true;
  order.walletReleased = false;
  return transaction;
}

async function releaseReservedForOrder(order, reason = 'Pesanan tidak dilanjutkan', providedSession = null) {
  const amount = Math.round(Number(order.walletAmount || 0));
  if (amount <= 0 || order.walletCommitted || order.walletReleased) return null;

  const execute = async (session) => {
    const transaction = await WalletTransaction.findOne({ idempotencyKey: `order-wallet:${order._id}` }).session(session);
    if (!transaction || transaction.status === 'reversed') {
      order.walletReleased = true;
      await order.save({ session });
      return null;
    }
    if (transaction.status === 'completed') return null;

    const before = await Wallet.findById(transaction.wallet).session(session);
    if (!before || before.heldBalance < amount) throw new AppError('Saldo tertahan tidak sesuai.', 409, 'WALLET_RELEASE_MISMATCH');
    const wallet = await Wallet.findOneAndUpdate(
      { _id: transaction.wallet, heldBalance: { $gte: amount } },
      { $inc: { heldBalance: -amount, balance: amount, version: 1 } },
      { new: true, session }
    );

    transaction.status = 'reversed';
    transaction.description = String(reason || 'Saldo dikembalikan.').slice(0, 300);
    transaction.reversedAt = new Date();
    await transaction.save({ session });

    const releaseKey = `order-wallet-release:${order._id}`;
    const existingRelease = await WalletTransaction.findOne({ idempotencyKey: releaseKey }).session(session);
    if (!existingRelease) {
      await WalletTransaction.create([{
        wallet: wallet._id,
        user: order.user,
        transactionNumber: randomId('WTR-'),
        idempotencyKey: releaseKey,
        type: 'release',
        direction: 'credit',
        status: 'completed',
        amount,
        balanceBefore: before.balance,
        balanceAfter: wallet.balance,
        referenceType: 'order',
        referenceId: String(order._id),
        title: `Pengembalian ${order.orderNumber}`,
        description: String(reason || 'Saldo dikembalikan ke dompet.').slice(0, 300),
        completedAt: new Date()
      }], { session });
    }

    order.walletReleased = true;
    await order.save({ session });
    return wallet;
  };

  if (providedSession) return execute(providedSession);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => { result = await execute(session); });
  } finally {
    await session.endSession();
  }
  return result;
}

async function creditPaidDeposit(depositId, providerTransaction) {
  const session = await mongoose.startSession();
  let paidDeposit;
  try {
    await session.withTransaction(async () => {
      const deposit = await WalletDeposit.findById(depositId).session(session);
      if (!deposit) throw new AppError('Deposit tidak ditemukan.', 404, 'DEPOSIT_NOT_FOUND');
      if (deposit.credited && deposit.status === 'paid') {
        paidDeposit = deposit;
        return;
      }
      if (String(providerTransaction.order_id) !== deposit.depositNumber || Number(providerTransaction.amount) !== deposit.amount) {
        throw new AppError('Data pembayaran deposit tidak cocok.', 400, 'DEPOSIT_PAYMENT_MISMATCH');
      }

      await creditInSession({
        userId: deposit.user,
        amount: deposit.amount,
        type: 'deposit',
        referenceType: 'deposit',
        referenceId: deposit._id,
        title: `Deposit ${deposit.depositNumber}`,
        description: 'Saldo deposit telah masuk ke dompet.',
        idempotencyKey: `deposit-credit:${deposit._id}`,
        metadata: { depositNumber: deposit.depositNumber, paymentMethod: deposit.paymentMethod },
        session
      });

      deposit.status = 'paid';
      deposit.credited = true;
      deposit.paidAt = providerTransaction.completed_at ? new Date(providerTransaction.completed_at) : new Date();
      deposit.lastCheckResponse = providerTransaction;
      await deposit.save({ session });
      paidDeposit = deposit;
    });
  } finally {
    await session.endSession();
  }
  if (paidDeposit) {
    const claimed = await WalletDeposit.findOneAndUpdate(
      { _id: paidDeposit._id, 'notifications.paidSent': false },
      { $set: { 'notifications.paidSent': true } },
      { new: true }
    ).populate('user', 'name email');
    if (claimed?.user) {
      await emailService.sendSimple(
        claimed.user.email,
        'Saldo berhasil ditambahkan',
        {
          name: claimed.user.name,
          message: `Deposit ${claimed.depositNumber} sebesar Rp${claimed.amount.toLocaleString('id-ID')} sudah masuk ke TOKOZYPHRA Wallet.`,
          action: { label: 'Buka dompet', url: `${env.appUrl}/wallet` }
        },
        'wallet_deposit_success'
      );
    }
  }
  return paidDeposit;
}

async function updateDepositStatus(deposit, status, providerTransaction) {
  if (deposit.status === 'paid') return deposit;
  if (!['failed', 'expired', 'cancelled'].includes(status)) return deposit;
  deposit.status = status;
  deposit.lastCheckResponse = providerTransaction;
  if (status === 'cancelled') deposit.cancelledAt = new Date();
  await deposit.save();
  return deposit;
}

async function redeemWalletVoucher({ userId, code }) {
  const normalized = normalizeCode(code);
  if (!normalized) throw new AppError('Masukkan kode voucher saldo.', 400, 'WALLET_VOUCHER_REQUIRED');

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const voucher = await DiscountCode.findOne({ code: normalized }).session(session);
      if (!voucher || voucher.benefitType !== 'wallet_credit') throw new AppError('Voucher saldo tidak ditemukan.', 404, 'WALLET_VOUCHER_NOT_FOUND');
      if (!isDiscountCurrentlyActive(voucher)) throw new AppError('Voucher saldo belum aktif atau sudah berakhir.', 400, 'WALLET_VOUCHER_INACTIVE');
      const amount = Math.round(Number(voucher.walletCreditAmount || voucher.value || 0));
      if (amount <= 0) throw new AppError('Nominal voucher saldo tidak valid.', 400, 'WALLET_VOUCHER_INVALID');

      const userClaims = await WalletVoucherClaim.countDocuments({ voucher: voucher._id, user: userId }).session(session);
      if (userClaims >= voucher.perUserLimit) throw new AppError('Voucher ini sudah mencapai batas klaim untuk akun Anda.', 409, 'WALLET_VOUCHER_USER_LIMIT');
      if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) throw new AppError('Kuota voucher saldo sudah habis.', 409, 'WALLET_VOUCHER_EXHAUSTED');

      const updatedVoucher = await DiscountCode.findOneAndUpdate(
        {
          _id: voucher._id,
          active: true,
          ...(voucher.usageLimit > 0 ? { usedCount: { $lt: voucher.usageLimit } } : {})
        },
        { $inc: { usedCount: 1 } },
        { new: true, session }
      );
      if (!updatedVoucher) throw new AppError('Kuota voucher saldo baru saja habis.', 409, 'WALLET_VOUCHER_EXHAUSTED');

      const claimNumber = randomId('CLM-');
      const walletTransaction = await creditInSession({
        userId,
        amount,
        type: 'reward',
        referenceType: 'voucher',
        referenceId: voucher._id,
        title: `Klaim ${voucher.code}`,
        description: voucher.description || 'Bonus saldo berhasil diklaim.',
        idempotencyKey: `wallet-voucher:${voucher._id}:${userId}:${userClaims + 1}`,
        metadata: { code: voucher.code, claimNumber },
        session
      });

      await WalletVoucherClaim.create([{
        voucher: voucher._id,
        user: userId,
        amount,
        claimNumber,
        walletTransaction: walletTransaction._id
      }], { session });

      result = { voucher: updatedVoucher, amount, transaction: walletTransaction };
    });
  } finally {
    await session.endSession();
  }
  return result;
}

async function adminAdjustBalance({ userId, amount, direction, adminId, reason }) {
  const normalizedAmount = Math.round(Number(amount));
  if (!Number.isInteger(normalizedAmount) || normalizedAmount <= 0) throw new AppError('Nominal penyesuaian tidak valid.', 400, 'INVALID_ADJUSTMENT_AMOUNT');
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      await ensureWallet(userId, session);
      const before = await Wallet.findOne({ user: userId }).session(session);
      let wallet;
      if (direction === 'debit') {
        wallet = await Wallet.findOneAndUpdate(
          { user: userId, status: 'active', balance: { $gte: normalizedAmount } },
          { $inc: { balance: -normalizedAmount, version: 1 } },
          { new: true, session }
        );
        if (!wallet) throw new AppError('Saldo pengguna tidak mencukupi untuk dikurangi.', 400, 'ADJUSTMENT_INSUFFICIENT');
      } else {
        wallet = await Wallet.findOneAndUpdate(
          { user: userId, status: 'active' },
          { $inc: { balance: normalizedAmount, totalRewards: normalizedAmount, version: 1 } },
          { new: true, session }
        );
      }
      const [transaction] = await WalletTransaction.create([{
        wallet: wallet._id,
        user: userId,
        transactionNumber: randomId('WTR-'),
        idempotencyKey: randomId('admin-adjust:'),
        type: 'adjustment',
        direction: direction === 'debit' ? 'debit' : 'credit',
        status: 'completed',
        amount: normalizedAmount,
        balanceBefore: before.balance,
        balanceAfter: wallet.balance,
        referenceType: 'admin',
        referenceId: String(adminId),
        title: direction === 'debit' ? 'Penyesuaian saldo' : 'Bonus saldo',
        description: String(reason || 'Penyesuaian oleh admin').trim().slice(0, 300),
        completedAt: new Date()
      }], { session });
      result = transaction;
    });
  } finally {
    await session.endSession();
  }
  return result;
}

module.exports = {
  ensureWallet,
  getWallet,
  creditWallet,
  reserveForOrder,
  commitReservedForOrder,
  releaseReservedForOrder,
  creditPaidDeposit,
  updateDepositStatus,
  redeemWalletVoucher,
  adminAdjustBalance
};
