const DiscountCode = require('../models/DiscountCode');
const DiscountReservation = require('../models/DiscountReservation');
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
  if (discount.benefitType === 'wallet_credit') throw new AppError('Kode ini digunakan melalui menu Dompet.', 400, 'WALLET_VOUCHER_USE_WALLET');
  if (!isDiscountCurrentlyActive(discount)) throw new AppError('Voucher atau kode promo belum aktif atau sudah berakhir.', 400, 'DISCOUNT_INACTIVE');

  if (discount.usageLimit > 0 && Number(discount.usedCount || 0) + Number(discount.reservedCount || 0) >= discount.usageLimit) {
    throw new AppError('Kuota voucher atau kode promo sudah habis.', 400, 'DISCOUNT_QUOTA_EXHAUSTED');
  }

  const [reservedOrCommitted, legacyUsage] = await Promise.all([
    DiscountReservation.countDocuments({ discount: discount._id, user: userId, active: true, status: { $in: ['reserved', 'committed'] } }),
    Order.countDocuments({
      user: userId,
      discountCode: discount._id,
      discountReserved: { $ne: true },
      paymentStatus: { $in: ['initializing', 'pending', 'paid', 'compensation_required'] }
    })
  ]);
  if (reservedOrCommitted + legacyUsage >= discount.perUserLimit) {
    throw new AppError('Batas penggunaan kode untuk akun Anda sudah tercapai.', 400, 'DISCOUNT_USER_LIMIT');
  }

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

async function reserveDiscountUsage(orderId, session) {
  const order = await Order.findById(orderId).session(session);
  if (!order?.discountCode || order.discountReserved || order.discountCommitted) return order;
  const discount = await DiscountCode.findById(order.discountCode).session(session);
  if (!discount || !isDiscountCurrentlyActive(discount)) throw new AppError('Kode diskon tidak lagi tersedia.', 409, 'DISCOUNT_INACTIVE');

  const activeSlots = await DiscountReservation.find({
    discount: discount._id,
    user: order.user,
    active: true, status: { $in: ['reserved', 'committed'] }
  }).select('usageSlot').session(session);
  const occupied = new Set(activeSlots.map((entry) => entry.usageSlot));
  let usageSlot = null;
  for (let slot = 1; slot <= discount.perUserLimit; slot += 1) {
    if (!occupied.has(slot)) { usageSlot = slot; break; }
  }
  if (!usageSlot) throw new AppError('Batas penggunaan kode untuk akun Anda sudah tercapai.', 409, 'DISCOUNT_USER_LIMIT');

  const quotaFilter = { _id: discount._id, active: true };
  if (discount.usageLimit > 0) {
    quotaFilter.$expr = { $lt: [{ $add: ['$usedCount', { $ifNull: ['$reservedCount', 0] }] }, '$usageLimit'] };
  }
  const reservedDiscount = await DiscountCode.findOneAndUpdate(quotaFilter, { $inc: { reservedCount: 1 } }, { new: true, session });
  if (!reservedDiscount) throw new AppError('Kuota voucher atau kode promo baru saja habis.', 409, 'DISCOUNT_QUOTA_EXHAUSTED');

  await DiscountReservation.create([{
    order: order._id,
    discount: discount._id,
    user: order.user,
    usageSlot,
    expiresAt: order.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000)
  }], { session });

  order.discountReserved = true;
  order.discountReleased = false;
  await order.save({ session });
  return order;
}

async function commitDiscountUsage(orderId, session) {
  const order = await Order.findById(orderId).session(session);
  if (!order?.discountCode || order.discountCommitted) return false;
  const reservation = await DiscountReservation.findOne({ order: order._id }).session(session);

  if (reservation?.status === 'reserved') {
    const updated = await DiscountCode.findOneAndUpdate(
      { _id: order.discountCode, reservedCount: { $gte: 1 } },
      { $inc: { reservedCount: -1, usedCount: 1 } },
      { new: true, session }
    );
    if (!updated) throw new AppError('Reservasi diskon tidak konsisten.', 409, 'DISCOUNT_RESERVATION_MISMATCH');
    reservation.status = 'committed';
    reservation.committedAt = new Date();
    await reservation.save({ session });
  } else if (!reservation) {
    await DiscountCode.updateOne({ _id: order.discountCode }, { $inc: { usedCount: 1 } }, { session });
  }

  order.discountReserved = false;
  order.discountCommitted = true;
  order.discountReleased = false;
  await order.save({ session });
  return true;
}

async function releaseDiscountUsage(order, session) {
  if (!order?.discountCode || order.discountCommitted || order.discountReleased) return false;
  const reservation = await DiscountReservation.findOne({ order: order._id }).session(session);
  if (reservation?.status === 'reserved') {
    const updated = await DiscountCode.findOneAndUpdate(
      { _id: order.discountCode, reservedCount: { $gte: 1 } },
      { $inc: { reservedCount: -1 } },
      { new: true, session }
    );
    if (!updated) throw new AppError('Reservasi diskon tidak konsisten.', 409, 'DISCOUNT_RESERVATION_MISMATCH');
    reservation.status = 'released';
    reservation.active = false;
    reservation.releasedAt = new Date();
    await reservation.save({ session });
  }
  order.discountReserved = false;
  order.discountReleased = true;
  await order.save({ session });
  return true;
}

module.exports = {
  normalizeCode,
  isDiscountCurrentlyActive,
  eligibleSubtotalForItems,
  calculateDiscountAmount,
  validateDiscountForCart,
  reserveDiscountUsage,
  commitDiscountUsage,
  releaseDiscountUsage
};
