const Product = require('../models/Product');
const Review = require('../models/Review');
const { AppError } = require('../utils/errors');
const reviewService = require('../services/reviewService');

async function upsertReview(req, res) {
  const product = await Product.findById(req.params.productId).select('name slug active');
  if (!product) throw new AppError('Produk tidak ditemukan.', 404, 'PRODUCT_NOT_FOUND');

  const order = await reviewService.findVerifiedPurchase(req.user._id, product._id);
  if (!order) {
    throw new AppError('Ulasan hanya dapat diberikan setelah produk berhasil dibeli.', 403, 'VERIFIED_PURCHASE_REQUIRED');
  }

  const payload = reviewService.parseReviewPayload(req.body);
  const existing = await Review.findOne({ product: product._id, user: req.user._id });

  if (existing) {
    existing.rating = payload.rating;
    existing.comment = payload.comment;
    existing.order = order._id;
    existing.verifiedPurchase = true;
    await existing.save();
    req.flash('success', 'Ulasan Anda berhasil diperbarui.');
  } else {
    await Review.create({
      product: product._id,
      user: req.user._id,
      order: order._id,
      rating: payload.rating,
      comment: payload.comment,
      verifiedPurchase: true
    });
    req.flash('success', 'Terima kasih, ulasan Anda berhasil diterbitkan.');
  }

  await reviewService.recalculateProductRating(product._id);
  res.redirect(`/products/${product.slug}#reviews`);
}

async function deleteReview(req, res) {
  const review = await Review.findOne({ _id: req.params.id, user: req.user._id }).populate('product', 'slug');
  if (!review) throw new AppError('Ulasan tidak ditemukan.', 404, 'REVIEW_NOT_FOUND');
  const productId = review.product._id;
  const slug = review.product.slug;
  await review.deleteOne();
  await reviewService.recalculateProductRating(productId);
  req.flash('success', 'Ulasan berhasil dihapus.');
  res.redirect(`/products/${slug}#reviews`);
}


module.exports = { upsertReview, deleteReview };
