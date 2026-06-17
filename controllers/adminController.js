const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const WebhookLog = require('../models/WebhookLog');
const EmailLog = require('../models/EmailLog');
const StoreSetting = require('../models/StoreSetting');
const DiscountCode = require('../models/DiscountCode');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const WalletDeposit = require('../models/WalletDeposit');
const { getStoreSettings } = require('../services/settingService');
const { slugify } = require('../utils/helpers');
const { AppError } = require('../utils/errors');
const { assertSafeExternalUrl } = require('../utils/urlSafety');
const pakasir = require('../services/pakasirService');
const orderService = require('../services/orderService');
const emailService = require('../services/emailService');
const cancellationService = require('../services/orderCancellationService');
const walletService = require('../services/walletService');

function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.round(parsed) : fallback; }
function bool(value) { return value === 'on' || value === 'true' || value === true; }
function dateOrNull(value) { const raw = String(value || '').trim(); if (!raw) return null; const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00+07:00` : raw; const date = new Date(normalized); return !Number.isNaN(date.getTime()) ? date : null; }
function array(value) { return Array.isArray(value) ? value : value ? [value] : []; }
function productPayload(body) {
  const gallery = String(body.gallery || '').split(/\r?\n|,/).map((v) => v.trim()).filter(Boolean);
  const tags = String(body.tags || '').split(',').map((v) => v.trim()).filter(Boolean);
  return {
    name: String(body.name || '').trim(), slug: slugify(body.slug || body.name), shortDescription: String(body.shortDescription || '').trim(), description: String(body.description || '').trim(),
    price: number(body.price), promoPrice: body.promoPrice === '' ? null : number(body.promoPrice), category: body.category, thumbnail: String(body.thumbnail || '').trim(), gallery,
    unlimitedStock: bool(body.unlimitedStock), stock: number(body.stock), allowMultipleQuantity: bool(body.allowMultipleQuantity), version: String(body.version || '1.0.0').trim(),
    changelog: String(body.changelog || '').trim(), tags, active: bool(body.active), featured: bool(body.featured), digitalFileUrl: assertSafeExternalUrl(String(body.digitalFileUrl || '').trim()),
    fileName: String(body.fileName || '').trim(), instructions: String(body.instructions || '').trim(), downloadLimit: Math.max(1, number(body.downloadLimit, 5)),
    flashSale: {
      enabled: bool(body.flashSaleEnabled),
      price: body.flashSalePrice === '' ? null : Math.max(0, number(body.flashSalePrice)),
      startsAt: dateOrNull(body.flashSaleStartsAt),
      endsAt: dateOrNull(body.flashSaleEndsAt)
    }
  };
}

function validateFlashSale(payload) {
  const flash = payload.flashSale;
  if (!flash?.enabled) return;
  const basePrice = payload.promoPrice !== null && payload.promoPrice < payload.price ? payload.promoPrice : payload.price;
  if (flash.price === null || flash.price < 0 || flash.price >= basePrice) throw new AppError('Harga flash sale harus mulai Rp0 dan lebih rendah dari harga aktif produk.', 400, 'INVALID_FLASH_PRICE');
  if (!flash.startsAt || !flash.endsAt || flash.endsAt <= flash.startsAt) throw new AppError('Waktu mulai dan selesai flash sale tidak valid.', 400, 'INVALID_FLASH_PERIOD');
}

function discountPayload(body) {
  const benefitType = body.benefitType === 'wallet_credit' ? 'wallet_credit' : 'order_discount';
  const scope = body.scope === 'products' ? 'products' : 'all';
  const discountType = body.discountType === 'fixed' ? 'fixed' : 'percentage';
  const products = scope === 'products' ? array(body.products).filter(Boolean) : [];
  const walletCreditAmount = Math.max(0, number(body.walletCreditAmount, 0));
  const payload = {
    name: String(body.name || '').trim(),
    code: String(body.code || '').trim().toUpperCase().replace(/\s+/g, ''),
    kind: benefitType === 'wallet_credit' ? 'voucher' : (body.kind === 'voucher' ? 'voucher' : 'promo'),
    benefitType,
    walletCreditAmount,
    description: String(body.description || '').trim(),
    discountType: benefitType === 'wallet_credit' ? 'fixed' : discountType,
    value: benefitType === 'wallet_credit' ? Math.max(1, walletCreditAmount) : Math.max(1, number(body.value, 1)),
    maxDiscount: benefitType === 'wallet_credit' ? 0 : Math.max(0, number(body.maxDiscount, 0)),
    minSubtotal: benefitType === 'wallet_credit' ? 0 : Math.max(0, number(body.minSubtotal, 0)),
    scope: benefitType === 'wallet_credit' ? 'all' : scope,
    products: benefitType === 'wallet_credit' ? [] : products,
    usageLimit: Math.max(0, number(body.usageLimit, 0)),
    perUserLimit: Math.max(1, number(body.perUserLimit, 1)),
    startsAt: dateOrNull(body.startsAt),
    endsAt: dateOrNull(body.endsAt),
    active: bool(body.active)
  };
  if (!payload.name || !payload.code) throw new AppError('Nama dan kode wajib diisi.', 400, 'DISCOUNT_REQUIRED_FIELDS');
  if (benefitType === 'wallet_credit' && walletCreditAmount <= 0) throw new AppError('Nominal saldo voucher harus lebih dari Rp0.', 400, 'INVALID_WALLET_CREDIT');
  if (benefitType === 'order_discount' && discountType === 'percentage' && payload.value > 100) throw new AppError('Persentase diskon maksimal 100%.', 400, 'INVALID_DISCOUNT_PERCENT');
  if (!payload.startsAt || !payload.endsAt || payload.endsAt <= payload.startsAt) throw new AppError('Periode voucher/kode promo tidak valid.', 400, 'INVALID_DISCOUNT_PERIOD');
  if (benefitType === 'order_discount' && scope === 'products' && products.length === 0) throw new AppError('Pilih minimal satu produk untuk cakupan produk tertentu.', 400, 'DISCOUNT_PRODUCTS_REQUIRED');
  return payload;
}

async function discounts(req, res) {
  const discounts = await DiscountCode.find().populate('products', 'name slug').sort({ createdAt: -1 });
  res.render('admin/discounts/list', { title: 'Voucher & kode promo', discounts });
}
async function newDiscount(req, res) {
  res.render('admin/discounts/form', { title: 'Tambah voucher/kode promo', discount: null, products: await Product.find({ active: true }).sort({ name: 1 }) });
}
async function createDiscount(req, res) {
  await DiscountCode.create(discountPayload(req.body));
  req.flash('success', 'Voucher atau kode promo berhasil dibuat.');
  res.redirect('/admin/discounts');
}
async function editDiscount(req, res) {
  const discount = await DiscountCode.findById(req.params.id);
  if (!discount) throw new AppError('Voucher atau kode promo tidak ditemukan.', 404);
  res.render('admin/discounts/form', { title: 'Edit voucher/kode promo', discount, products: await Product.find({ active: true }).sort({ name: 1 }) });
}
async function updateDiscount(req, res) {
  const discount = await DiscountCode.findById(req.params.id);
  if (!discount) throw new AppError('Voucher atau kode promo tidak ditemukan.', 404);
  Object.assign(discount, discountPayload(req.body));
  await discount.save();
  req.flash('success', 'Voucher atau kode promo diperbarui.');
  res.redirect('/admin/discounts');
}
async function toggleDiscount(req, res) {
  const discount = await DiscountCode.findById(req.params.id);
  if (!discount) throw new AppError('Voucher atau kode promo tidak ditemukan.', 404);
  discount.active = !discount.active;
  await discount.save();
  req.flash('success', 'Status voucher atau kode promo diperbarui.');
  res.redirect('/admin/discounts');
}

async function dashboard(req, res) {
  const [users, products, orders, revenue, recent, chart] = await Promise.all([
    User.countDocuments(), Product.countDocuments(), Order.countDocuments(),
    Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, gross: { $sum: '$subtotal' }, userFees: { $sum: '$userFee' }, merchantFees: { $sum: '$merchantFee' }, net: { $sum: '$merchantNet' }, count: { $sum: 1 } } }]),
    Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(8),
    Order.aggregate([{ $match: { paymentStatus: 'paid', paidAt: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Asia/Jakarta' } }, total: { $sum: '$total' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }])
  ]);
  res.render('admin/dashboard', { title: 'Dashboard admin', stats: { users, products, orders, ...(revenue[0] || { gross: 0, userFees: 0, merchantFees: 0, net: 0, count: 0 }) }, recent, chart });
}
async function products(req, res) { res.render('admin/products/list', { title: 'Kelola produk', products: await Product.find().populate('category').sort({ createdAt: -1 }) }); }
async function newProduct(req, res) { res.render('admin/products/form', { title: 'Tambah produk', product: null, categories: await Category.find().sort({ name: 1 }) }); }
async function createProduct(req, res) { const payload = productPayload(req.body); if (!payload.name || !payload.slug || !payload.digitalFileUrl || !payload.category || payload.price < 0) throw new AppError('Data produk wajib belum lengkap.', 400); validateFlashSale(payload); await Product.create(payload); req.flash('success', 'Produk berhasil ditambahkan.'); res.redirect('/admin/products'); }
async function editProduct(req, res) { const product = await Product.findById(req.params.id).select('+digitalFileUrl'); if (!product) throw new AppError('Produk tidak ditemukan.', 404); res.render('admin/products/form', { title: 'Edit produk', product, categories: await Category.find().sort({ name: 1 }) }); }
async function updateProduct(req, res) { const product = await Product.findById(req.params.id).select('+digitalFileUrl'); if (!product) throw new AppError('Produk tidak ditemukan.', 404); const payload = productPayload(req.body); validateFlashSale(payload); Object.assign(product, payload); await product.save(); req.flash('success', 'Produk diperbarui.'); res.redirect('/admin/products'); }
async function toggleProduct(req, res) { const product = await Product.findById(req.params.id); if (!product) throw new AppError('Produk tidak ditemukan.', 404); product.active = !product.active; await product.save(); req.flash('success', 'Status produk diperbarui.'); res.redirect('/admin/products'); }
async function categories(req, res) { res.render('admin/categories', { title: 'Kategori', categories: await Category.find().sort({ name: 1 }) }); }
async function createCategory(req, res) { const name = String(req.body.name || '').trim(); if (!name) throw new AppError('Nama kategori wajib diisi.', 400); await Category.create({ name, slug: slugify(req.body.slug || name), description: String(req.body.description || ''), active: true }); req.flash('success', 'Kategori ditambahkan.'); res.redirect('/admin/categories'); }
async function updateCategory(req, res) { const category = await Category.findById(req.params.id); if (!category) throw new AppError('Kategori tidak ditemukan.', 404); category.name = String(req.body.name || category.name).trim(); category.slug = slugify(req.body.slug || category.name); category.description = String(req.body.description || ''); category.active = bool(req.body.active); await category.save(); req.flash('success', 'Kategori diperbarui.'); res.redirect('/admin/categories'); }
async function users(req, res) { res.render('admin/users', { title: 'Pengguna', users: await User.find().sort({ createdAt: -1 }).limit(300) }); }
async function updateUser(req, res) { const user = await User.findById(req.params.id); if (!user) throw new AppError('Pengguna tidak ditemukan.', 404); if (String(user._id) === String(req.user._id) && req.body.status === 'blocked') throw new AppError('Admin tidak dapat memblokir dirinya sendiri.', 400); user.role = ['user', 'admin'].includes(req.body.role) ? req.body.role : user.role; user.status = ['active', 'blocked', 'pending'].includes(req.body.status) ? req.body.status : user.status; user.sessionVersion += 1; await user.save(); req.flash('success', 'Pengguna diperbarui.'); res.redirect('/admin/users'); }
async function orders(req, res) { const query = req.query.status ? { paymentStatus: req.query.status } : {}; res.render('admin/orders/list', { title: 'Pesanan', orders: await Order.find(query).populate('user', 'name email').sort({ createdAt: -1 }).limit(500), status: req.query.status || '' }); }
async function orderDetail(req, res) { const order = await Order.findOne({ orderNumber: req.params.orderNumber }).populate('user', 'name email'); if (!order) throw new AppError('Pesanan tidak ditemukan.', 404); const payment = await Payment.findOne({ order: order._id }); res.render('admin/orders/detail', { title: order.orderNumber, order, payment }); }
async function recheckOrder(req, res) {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber });
  if (!order) throw new AppError('Pesanan tidak ditemukan.', 404);
  if (order.paymentChannel === 'free' || order.total === 0) {
    if (order.paymentStatus !== 'paid') await orderService.fulfillFreeOrder(order._id);
    req.flash('success', 'Pesanan berhasil dikonfirmasi.');
    return res.redirect(`/admin/orders/${order.orderNumber}`);
  }
  if (order.paymentChannel === 'wallet') {
    if (order.paymentStatus !== 'paid') await orderService.fulfillWalletOrder(order._id);
    req.flash('success', 'Pembayaran saldo berhasil dikonfirmasi.');
    return res.redirect(`/admin/orders/${order.orderNumber}`);
  }
  const transaction = await pakasir.getTransactionDetail({ orderId: order.orderNumber, amount: order.pakasirAmount });
  if (['completed', 'paid'].includes(transaction.status)) await orderService.markPaid(order._id, transaction);
  else if (['failed', 'expired', 'cancelled'].includes(transaction.status)) await orderService.updateNonPaidStatus(order, transaction.status, transaction);
  req.flash('success', `Status Pakasir: ${transaction.status}`);
  return res.redirect(`/admin/orders/${order.orderNumber}`);
}
async function cancelOrder(req, res) {
  const order = await cancellationService.cancelOrder({ orderNumber: req.params.orderNumber, userId: req.user._id, isAdmin: true, reason: req.body.reason || 'Dibatalkan oleh admin' });
  req.flash('success', `Transaksi ${order.orderNumber} berhasil dibatalkan.`);
  res.redirect(`/admin/orders/${order.orderNumber}`);
}
async function resendInvoice(req, res) { const order = await Order.findOne({ orderNumber: req.params.orderNumber }).populate('user'); if (!order) throw new AppError('Pesanan tidak ditemukan.', 404); const result = await emailService.sendInvoice(order.user.email, order); if (!result.sent) throw new AppError('Invoice gagal dikirim. Lihat log email.', 503); req.flash('success', 'Invoice dikirim ulang.'); res.redirect(`/admin/orders/${order.orderNumber}`); }
async function settings(req, res) { res.render('admin/settings', { title: 'Pengaturan toko', settings: await getStoreSettings() }); }
async function updateSettings(req, res) {
  const settings = await getStoreSettings();
  const threshold = number(req.body.feeSplitThreshold, settings.feeSplitThreshold);
  if (threshold < 0) throw new AppError('Batas fee tidak valid.', 400);
  settings.feeSplitThreshold = threshold;
  settings.paymentFees.forEach((fee) => {
    fee.active = bool(req.body[`active_${fee.method}`]);
    if (fee.type === 'fixed') fee.fixed = Math.max(0, number(req.body[`fixed_${fee.method}`], fee.fixed));
    else { fee.percentage = Math.max(0, Number(req.body[`percentage_${fee.method}`] || fee.percentage)); fee.fixed = Math.max(0, number(req.body[`fixed_${fee.method}`], fee.fixed)); if (fee.type === 'tiered_qris') { fee.highPercentage = Math.max(0, Number(req.body[`highPercentage_${fee.method}`] || fee.highPercentage)); fee.highThreshold = Math.max(0, number(req.body[`highThreshold_${fee.method}`], fee.highThreshold)); } }
  });
  settings.wallet.enabled = bool(req.body.walletEnabled);
  settings.wallet.minDeposit = Math.max(1000, number(req.body.walletMinDeposit, settings.wallet.minDeposit));
  settings.wallet.maxDeposit = Math.max(settings.wallet.minDeposit, number(req.body.walletMaxDeposit, settings.wallet.maxDeposit));
  await settings.save(); req.flash('success', 'Pengaturan disimpan.'); res.redirect('/admin/settings');
}
async function wallets(req, res) {
  const [walletList, totals, depositStats, recentTransactions, recentDeposits] = await Promise.all([
    Wallet.find().populate('user', 'name email status avatar').sort({ balance: -1 }).limit(300),
    Wallet.aggregate([{ $group: { _id: null, available: { $sum: '$balance' }, held: { $sum: '$heldBalance' }, deposited: { $sum: '$totalDeposited' }, spent: { $sum: '$totalSpent' }, rewards: { $sum: '$totalRewards' }, users: { $sum: 1 } } }]),
    WalletDeposit.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    WalletTransaction.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(30),
    WalletDeposit.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(30)
  ]);
  res.render('admin/wallets', {
    title: 'Dompet pengguna',
    wallets: walletList,
    stats: { ...(totals[0] || { available: 0, held: 0, deposited: 0, spent: 0, rewards: 0, users: 0 }), depositCount: depositStats[0]?.count || 0, depositTotal: depositStats[0]?.total || 0 },
    transactions: recentTransactions,
    deposits: recentDeposits
  });
}

async function adjustWallet(req, res) {
  const user = await User.findById(req.params.userId);
  if (!user) throw new AppError('Pengguna tidak ditemukan.', 404);
  await walletService.adminAdjustBalance({
    userId: user._id,
    amount: req.body.amount,
    direction: req.body.direction === 'debit' ? 'debit' : 'credit',
    adminId: req.user._id,
    reason: req.body.reason || 'Penyesuaian saldo oleh admin'
  });
  req.flash('success', `Saldo ${user.name} berhasil diperbarui.`);
  res.redirect('/admin/wallets');
}


async function updateWalletStatus(req, res) {
  const wallet = await Wallet.findOne({ user: req.params.userId }).populate('user', 'name');
  if (!wallet) throw new AppError('Dompet pengguna tidak ditemukan.', 404, 'WALLET_NOT_FOUND');
  wallet.status = req.body.status === 'locked' ? 'locked' : 'active';
  await wallet.save();
  req.flash('success', `Dompet ${wallet.user?.name || 'pengguna'} ${wallet.status === 'locked' ? 'dinonaktifkan sementara' : 'diaktifkan kembali'}.`);
  res.redirect('/admin/wallets');
}

async function webhookLogs(req, res) { res.render('admin/logs/webhooks', { title: 'Log webhook', logs: await WebhookLog.find().sort({ createdAt: -1 }).limit(200) }); }
async function emailLogs(req, res) { res.render('admin/logs/emails', { title: 'Log email', logs: await EmailLog.find().select('+retryType').sort({ createdAt: -1 }).limit(200) }); }

async function retryEmail(req, res) {
  const log = await EmailLog.findById(req.params.id).select('+retryType +retryPayload');
  if (!log || log.status !== 'failed' || !log.retryType) throw new AppError('Email ini tidak dapat dicoba ulang.', 400, 'EMAIL_NOT_RETRYABLE');
  let result;
  if (log.retryType === 'invoice') {
    const order = await Order.findOne({ orderNumber: log.retryPayload?.orderNumber }).populate('user');
    if (!order?.user) throw new AppError('Order untuk retry invoice tidak ditemukan.', 404);
    result = await emailService.sendInvoice(order.user.email, order);
  } else {
    result = await emailService.sendSimple(log.to, log.subject, log.retryPayload.data, log.retryPayload.template);
  }
  log.retryCount += 1; log.lastRetryAt = new Date(); await log.save();
  if (!result.sent) throw new AppError('Percobaan ulang email masih gagal.', 503, 'EMAIL_RETRY_FAILED');
  req.flash('success', 'Email berhasil dikirim ulang.');
  res.redirect('/admin/logs/emails');
}

module.exports = { dashboard, products, newProduct, createProduct, editProduct, updateProduct, toggleProduct, discounts, newDiscount, createDiscount, editDiscount, updateDiscount, toggleDiscount, categories, createCategory, updateCategory, users, updateUser, orders, orderDetail, recheckOrder, cancelOrder, resendInvoice, settings, updateSettings, wallets, adjustWallet, updateWalletStatus, webhookLogs, emailLogs, retryEmail };
