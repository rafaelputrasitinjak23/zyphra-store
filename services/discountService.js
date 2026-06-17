const DiscountCode = require('../models/DiscountCode');
const Order = require('../models/Order');
const { AppError } = require('../utils/errors');

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function isDiscountCurrentlyActive(discount, now = new Date()) {
  if (!discount?.active) return false;
  const time = new Date(now).getTime();
  return time >= new Date(discount.startsAt).getTime() && time < new Date(discount.endsAt).getTime();
}

function eligibleSubtotalForItems(discount, items) {
  if (discount.scope === 'all') return items.reduce((sum, item) => sum + item.lineTotal, 0);
  const allowed = new Set((discount.products || []).map((id) => String(id?._id || id)));
  return items.reduce((sum, item) => allowed.has(String(item.product?._id || item.product)) ? sum + item.lineTotal : sum, 0);
}

function calculateDiscountAmount(discount, items, itemsSubtotal) {
  const eligibleSubtotal = eligibleSubtotalForItems(discount, items);
  if (itemsSubtotal < Number(discount.minSubtotal || 0)) {
    throw new AppError(`Minimal belanja untuk kode ini adalah Rp${Number(discount.minSubtotal || 0).toLocaleString('id-ID')}.`, 400, 'DISCOUNT_MINIMUM_NOT_MET');
  }
  if (eligibleSubtotal <= 0) throw new AppError('Kode ini tidak berlaku untuk produk di keranjang Anda.', 400, 'DISCOUNT_NOT_APPLICABLE');
  let amount;
  if (discount.discountType === 'percentage') {
    amount = Math.floor(eligibleSubtotal * Number(discount.value) / 100);
    if (discount.maxDiscount > 0) amount = Math.min(amount, Number(discount.maxDiscount));
  } else {
    amount = Math.min(Number(discount.value), eligibleSubtotal);
  }
  amount = Math.max(0, Math.min(Math.round(amount), itemsSubtotal));
  if (amount <= 0) throw new AppError('Nilai diskon tidak valid untuk keranjang ini.', 400, 'DISCOUNT_ZERO');
  return { amount, eligibleSubtotal };
}

async function validateDiscountForCart({ code, userId, items, itemsSubtotal }) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const discount = await DiscountCode.findOne({ code: normalized }).populate('products', 'name slug active');
  if (!discount) throw new AppError('Voucher atau kode promo tidak ditemukan.', 404, 'DISCOUNT_NOT_FOUND');
  if (!isDiscountCurrentlyActive(discount)) throw new AppError('Voucher atau kode promo belum aktif atau sudah berakhir.', 400, 'DISCOUNT_INACTIVE');
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - 10 * 60 * 1000);
  const activePendingQuery = { paymentStatus: 'pending', $or: [{ expiresAt: { $gt: now } }, { expiresAt: null, createdAt: { $gt: staleCutoff } }] };
  if (discount.usageLimit > 0) {
    const pendingReservations = await Order.countDocuments({ discountCode: discount._id, ...activePendingQuery });
    if (discount.usedCount + pendingReservations >= discount.usageLimit) throw new AppError('Kuota voucher atau kode promo sudah habis.', 400, 'DISCOUNT_QUOTA_EXHAUSTED');
  }
  const userUsage = await Order.countDocuments({
    user: userId,
    discountCode: discount._id,
    $or: [{ paymentStatus: 'paid' }, activePendingQuery]
  });
  if (userUsage >= discount.perUserLimit) throw new AppError('Batas penggunaan kode untuk akun Anda sudah tercapai.', 400, 'DISCOUNT_USER_LIMIT');
  const result = calculateDiscountAmount(discount, items, itemsSubtotal);
  return {
    discount,
    amount: result.amount,
    eligibleSubtotal: result.eligibleSubtotal,
    snapshot: {
      discountCode: discount._id,
      discountCodeText: discount.code,
      discountName: discount.name,
      discountKind: discount.kind,
      discountType: discount.discountType,
      discountValue: discount.value,
      discountScope: discount.scope,
      discountAmount: result.amount
    }
  };
}

async function commitDiscountUsage(orderId, session) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, discountCode: { $ne: null }, discountCommitted: false },
    { $set: { discountCommitted: true } },
    { new: true, session }
  );
  if (!order?.discountCode) return false;
  await DiscountCode.updateOne({ _id: order.discountCode }, { $inc: { usedCount: 1 } }, { session });
  return true;
}

module.exports = {
  normalizeCode,
  isDiscountCurrentlyActive,
  eligibleSubtotalForItems,
  calculateDiscountAmount,
  validateDiscountForCart,
  commitDiscountUsage
};
