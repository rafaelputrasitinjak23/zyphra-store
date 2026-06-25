const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { AppError } = require('../utils/errors');

function reservationQuantity(item) {
  const value = Number(item?.stockReservationQuantity || 0);
  if (!Number.isSafeInteger(value) || value < 0) return 0;
  return value;
}

function hasItemReservations(order) {
  return Boolean(order?.items?.some((item) => reservationQuantity(item) > 0));
}

async function reserveOrderStock(orderId, providedSession = null) {
  const execute = async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new AppError('Pesanan tidak ditemukan.', 404, 'ORDER_NOT_FOUND');
    if (order.stockCommitted) return order;
    if (order.stockReserved && hasItemReservations(order)) return order;

    let hasReservation = false;
    for (const item of order.items) {
      const product = await Product.findById(item.product).select('+reservedStock').session(session);
      if (!product || !product.active) throw new AppError(`Produk ${item.name} tidak tersedia.`, 409, 'PRODUCT_UNAVAILABLE');

      item.stockReservationQuantity = 0;
      if (product.unlimitedStock) continue;

      const reserved = await Product.findOneAndUpdate(
        {
          _id: product._id,
          active: true,
          unlimitedStock: false,
          $expr: { $gte: [{ $subtract: ['$stock', { $ifNull: ['$reservedStock', 0] }] }, item.quantity] }
        },
        { $inc: { reservedStock: item.quantity } },
        { new: true, session }
      ).select('+reservedStock');
      if (!reserved) throw new AppError(`Stok ${item.name} tidak mencukupi.`, 409, 'STOCK_RESERVATION_FAILED');

      item.stockReservationQuantity = item.quantity;
      hasReservation = true;
    }

    order.stockReserved = hasReservation;
    order.stockReleased = false;
    await order.save({ session });
    return order;
  };

  if (providedSession) return execute(providedSession);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await execute(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

async function commitOrderStock(order, session) {
  if (order.stockCommitted) return order;

  for (const item of order.items) {
    const product = await Product.findById(item.product).select('+reservedStock').session(session);
    if (!product) throw new AppError(`Produk ${item.name} tidak tersedia.`, 409, 'PRODUCT_UNAVAILABLE');

    const reservedQuantity = reservationQuantity(item);
    if (reservedQuantity > 0) {
      if (reservedQuantity !== Number(item.quantity)) {
        throw new AppError(`Reservasi stok ${item.name} tidak cocok dengan jumlah pesanan.`, 409, 'STOCK_RESERVATION_MISMATCH');
      }
      const committed = await Product.findOneAndUpdate(
        {
          _id: product._id,
          stock: { $gte: item.quantity },
          reservedStock: { $gte: reservedQuantity }
        },
        {
          $inc: {
            stock: -item.quantity,
            reservedStock: -reservedQuantity,
            soldCount: item.quantity
          }
        },
        { new: true, session }
      ).select('+reservedStock');
      if (!committed) throw new AppError(`Reservasi stok ${item.name} tidak dapat dikomit.`, 409, 'STOCK_COMMIT_FAILED');
      continue;
    }

    if (product.unlimitedStock) {
      await Product.updateOne({ _id: product._id }, { $inc: { soldCount: item.quantity } }, { session });
      continue;
    }

    // Order lama atau item yang semula unlimited tidak boleh mengambil stok yang
    // sudah dicadangkan untuk order lain.
    const committed = await Product.findOneAndUpdate(
      {
        _id: product._id,
        unlimitedStock: false,
        $expr: { $gte: [{ $subtract: ['$stock', { $ifNull: ['$reservedStock', 0] }] }, item.quantity] }
      },
      { $inc: { stock: -item.quantity, soldCount: item.quantity } },
      { new: true, session }
    ).select('+reservedStock');
    if (!committed) throw new AppError(`Stok ${item.name} tidak dapat dikomit.`, 409, 'STOCK_COMMIT_FAILED');
  }

  order.items.forEach((item) => { item.stockReservationQuantity = 0; });
  order.stockCommitted = true;
  order.stockReserved = false;
  order.stockReleased = false;
  return order;
}

async function releaseOrderStock(order, reason = 'Pesanan tidak dilanjutkan.', providedSession = null) {
  if (!order || order.stockCommitted || order.stockReleased || (!order.stockReserved && !hasItemReservations(order))) return order;

  const execute = async (session) => {
    const current = await Order.findById(order._id).session(session);
    if (!current || current.stockCommitted || current.stockReleased || (!current.stockReserved && !hasItemReservations(current))) return current;

    for (const item of current.items) {
      const reservedQuantity = reservationQuantity(item);
      if (reservedQuantity <= 0) continue;
      if (reservedQuantity !== Number(item.quantity)) {
        throw new AppError(`Reservasi stok ${item.name} tidak cocok dengan jumlah pesanan.`, 409, 'STOCK_RESERVATION_MISMATCH');
      }

      const released = await Product.findOneAndUpdate(
        { _id: item.product, reservedStock: { $gte: reservedQuantity } },
        { $inc: { reservedStock: -reservedQuantity } },
        { new: true, session }
      ).select('+reservedStock');
      if (!released) throw new AppError(`Reservasi stok ${item.name} tidak konsisten.`, 409, 'STOCK_RELEASE_MISMATCH');
    }

    current.items.forEach((item) => { item.stockReservationQuantity = 0; });
    current.stockReserved = false;
    current.stockReleased = true;
    current.cancellationReason ||= String(reason || '').slice(0, 300);
    await current.save({ session });
    return current;
  };

  if (providedSession) return execute(providedSession);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await execute(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { reserveOrderStock, commitOrderStock, releaseOrderStock, reservationQuantity, hasItemReservations };
