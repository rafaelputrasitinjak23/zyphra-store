const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { AppError } = require('../utils/errors');

function parseReviewPayload(body = {}) {
  const rating = Number.parseInt(body.rating, 10);
  const comment = String(body.comment || '').replace(/\u0000/g, '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError('Pilih rating antara 1 sampai 5 bintang.', 400, 'INVALID_REVIEW_RATING');
  }
  if (comment.length > 1200) {
    throw new AppError('Ulasan maksimal 1.200 karakter.', 400, 'REVIEW_TOO_LONG');
  }
  return { rating, comment };
}

async function findVerifiedPurchase(userId, productId) {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(productId)) return null;
  return Order.findOne({
    user: userId,
    paymentStatus: 'paid',
    accessGranted: true,
    'items.product': productId
  }).sort({ paidAt: -1, createdAt: -1 });
}

async function recalculateProductRating(productId) {
  const [summary] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), status: 'published' } },
    { $group: { _id: '$product', average: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  const ratingAverage = summary ? Math.round(summary.average * 10) / 10 : 0;
  const ratingCount = summary?.count || 0;
  await Product.updateOne({ _id: productId }, { $set: { ratingAverage, ratingCount } });
  return { ratingAverage, ratingCount };
}

module.exports = { parseReviewPayload, findVerifiedPurchase, recalculateProductRating };
