const crypto = require('crypto');
const QRCode = require('qrcode');
const WalletDeposit = require('../models/WalletDeposit');
const WalletTransaction = require('../models/WalletTransaction');
const walletService = require('../services/walletService');
const pakasir = require('../services/pakasirService');
const { getStoreSettings } = require('../services/settingService');
const { calculateGatewayFee } = require('../services/feeService');
const { randomId } = require('../utils/helpers');
const { AppError } = require('../utils/errors');

function normalizeProviderStatus(status) {
  if (status === 'completed' || status === 'paid') return 'paid';
  if (['expired', 'failed', 'cancelled'].includes(status)) return status;
  return 'pending';
}

async function dashboard(req, res) {
  const [wallet, transactions, deposits, settings] = await Promise.all([
    walletService.getWallet(req.user._id),
    WalletTransaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30).lean(),
    WalletDeposit.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(8).lean(),
    getStoreSettings()
  ]);
  res.render('wallet/index', { title: 'Dompet', wallet, transactions, deposits, walletEnabled: settings.wallet?.enabled !== false && wallet.status === 'active' });
}

async function depositForm(req, res) {
  const settings = await getStoreSettings();
  if (!settings.wallet?.enabled) throw new AppError('Fitur deposit sedang tidak tersedia.', 503, 'WALLET_DISABLED');
  const wallet = await walletService.getWallet(req.user._id);
  if (wallet.status !== 'active') throw new AppError('Dompet Anda sedang dinonaktifkan.', 403, 'WALLET_LOCKED');
  const methods = settings.paymentFees.filter((item) => item.active).map((item) => item.toObject?.() || item);
  const nonce = crypto.randomBytes(24).toString('hex');
  req.session.walletDepositNonce = nonce;
  res.render('wallet/deposit', {
    title: 'Isi saldo',
    methods,
    minDeposit: settings.wallet.minDeposit,
    maxDeposit: settings.wallet.maxDeposit,
    nonce
  });
}

async function createDeposit(req, res) {
  const nonce = String(req.body.depositNonce || '');
  if (!nonce || nonce !== req.session.walletDepositNonce) throw new AppError('Permintaan deposit sudah diproses atau sesi tidak valid.', 409, 'DEPOSIT_REPLAY');
  delete req.session.walletDepositNonce;

  const settings = await getStoreSettings();
  if (!settings.wallet?.enabled) throw new AppError('Fitur deposit sedang tidak tersedia.', 503, 'WALLET_DISABLED');
  const wallet = await walletService.getWallet(req.user._id);
  if (wallet.status !== 'active') throw new AppError('Dompet Anda sedang dinonaktifkan.', 403, 'WALLET_LOCKED');
  const amount = Math.round(Number(req.body.amount));
  if (!Number.isInteger(amount) || amount < settings.wallet.minDeposit || amount > settings.wallet.maxDeposit) {
    throw new AppError(`Nominal deposit harus antara Rp${settings.wallet.minDeposit.toLocaleString('id-ID')} dan Rp${settings.wallet.maxDeposit.toLocaleString('id-ID')}.`, 400, 'INVALID_DEPOSIT_AMOUNT');
  }
  const rule = settings.paymentFees.find((item) => item.method === req.body.paymentMethod && item.active);
  if (!rule) throw new AppError('Metode pembayaran tidak tersedia.', 400, 'PAYMENT_METHOD_UNAVAILABLE');

  const idempotencyKey = `${req.user._id}:${nonce}`;
  const existing = await WalletDeposit.findOne({ idempotencyKey });
  if (existing) return res.redirect(`/wallet/deposits/${existing.depositNumber}`);

  const depositNumber = randomId('DEP-');
  const quotedFee = calculateGatewayFee(amount, rule);
  const deposit = await WalletDeposit.create({
    depositNumber,
    idempotencyKey,
    user: req.user._id,
    amount,
    gatewayFee: quotedFee,
    totalPayment: amount + quotedFee,
    paymentMethod: rule.method
  });

  try {
    const result = await pakasir.createTransaction({ method: rule.method, orderId: depositNumber, amount });
    const payment = result.payment;
    deposit.providerTransactionId = payment.transaction_id || payment.order_id;
    deposit.gatewayFee = Number(payment.fee || 0);
    deposit.totalPayment = Number(payment.total_payment || (amount + deposit.gatewayFee));
    deposit.paymentNumber = payment.payment_number;
    deposit.expiresAt = payment.expired_at ? new Date(payment.expired_at) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    deposit.createRequest = result.safeRequest;
    deposit.createResponse = result.raw;
    if (rule.method === 'qris' && payment.payment_number) {
      deposit.paymentQrDataUrl = await QRCode.toDataURL(payment.payment_number, { margin: 1, width: 320 });
    }
    await deposit.save();
    return res.redirect(`/wallet/deposits/${depositNumber}`);
  } catch (error) {
    deposit.status = 'failed';
    await deposit.save();
    throw error;
  }
}

async function depositDetail(req, res) {
  const deposit = await WalletDeposit.findOne({ depositNumber: req.params.depositNumber, user: req.user._id }).select('+paymentQrDataUrl');
  if (!deposit) throw new AppError('Deposit tidak ditemukan.', 404, 'DEPOSIT_NOT_FOUND');
  res.render('wallet/deposit-detail', { title: deposit.depositNumber, deposit });
}

async function checkDeposit(req, res) {
  const deposit = await WalletDeposit.findOne({ depositNumber: req.params.depositNumber, user: req.user._id });
  if (!deposit) throw new AppError('Deposit tidak ditemukan.', 404, 'DEPOSIT_NOT_FOUND');
  if (deposit.status === 'paid') {
    req.flash('success', 'Saldo deposit sudah masuk ke dompet.');
    return res.redirect('/wallet');
  }
  const transaction = await pakasir.getTransactionDetail({ orderId: deposit.depositNumber, amount: deposit.amount });
  const status = normalizeProviderStatus(transaction.status);
  if (status === 'paid') await walletService.creditPaidDeposit(deposit._id, transaction);
  else if (status !== 'pending') await walletService.updateDepositStatus(deposit, status, transaction);
  else { deposit.lastCheckResponse = transaction; await deposit.save(); }
  req.flash('success', status === 'paid' ? 'Saldo berhasil ditambahkan.' : `Status deposit: ${status}.`);
  return res.redirect(status === 'paid' ? '/wallet' : `/wallet/deposits/${deposit.depositNumber}`);
}

async function cancelDeposit(req, res) {
  const deposit = await WalletDeposit.findOne({ depositNumber: req.params.depositNumber, user: req.user._id });
  if (!deposit) throw new AppError('Deposit tidak ditemukan.', 404, 'DEPOSIT_NOT_FOUND');
  if (deposit.status === 'paid') throw new AppError('Deposit yang sudah berhasil tidak dapat dibatalkan.', 409, 'DEPOSIT_ALREADY_PAID');
  if (deposit.status === 'cancelled') return res.redirect('/wallet');
  if (deposit.status !== 'pending') throw new AppError('Deposit ini tidak dapat dibatalkan.', 409, 'DEPOSIT_CANNOT_CANCEL');

  const detail = await pakasir.getTransactionDetail({ orderId: deposit.depositNumber, amount: deposit.amount }).catch(() => null);
  if (detail && normalizeProviderStatus(detail.status) === 'paid') {
    await walletService.creditPaidDeposit(deposit._id, detail);
    req.flash('success', 'Pembayaran sudah diterima dan saldo telah masuk.');
    return res.redirect('/wallet');
  }
  const response = await pakasir.cancelTransaction({ orderId: deposit.depositNumber, amount: deposit.amount });
  const verified = await pakasir.getTransactionDetail({ orderId: deposit.depositNumber, amount: deposit.amount }).catch(() => null);
  if (verified && normalizeProviderStatus(verified.status) === 'paid') {
    await walletService.creditPaidDeposit(deposit._id, verified);
    req.flash('success', 'Pembayaran sudah diterima dan saldo telah masuk.');
    return res.redirect('/wallet');
  }
  deposit.status = 'cancelled';
  deposit.cancelledAt = new Date();
  deposit.cancellationResponse = { response, verified };
  await deposit.save();
  req.flash('success', 'Deposit berhasil dibatalkan.');
  res.redirect('/wallet');
}

async function redeem(req, res) {
  const settings = await getStoreSettings();
  if (!settings.wallet?.enabled) throw new AppError('Fitur dompet sedang tidak tersedia.', 503, 'WALLET_DISABLED');
  const wallet = await walletService.getWallet(req.user._id);
  if (wallet.status !== 'active') throw new AppError('Dompet Anda sedang dinonaktifkan.', 403, 'WALLET_LOCKED');
  const result = await walletService.redeemWalletVoucher({ userId: req.user._id, code: req.body.code });
  req.flash('success', `Voucher berhasil diklaim. Saldo bertambah Rp${result.amount.toLocaleString('id-ID')}.`);
  res.redirect('/wallet');
}

module.exports = { dashboard, depositForm, createDeposit, depositDetail, checkDeposit, cancelDeposit, redeem, normalizeProviderStatus };
