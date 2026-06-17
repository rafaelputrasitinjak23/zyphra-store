const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const reviewService = require('../services/reviewService');
const { escapeRegex } = require('../utils/helpers');
const { AppError } = require('../utils/errors');

async function home(req, res) {
  const now = new Date();
  const [featured, categories, popular, flashSales] = await Promise.all([
    Product.find({ active: true, featured: true }).populate('category').sort({ soldCount: -1, createdAt: -1 }).limit(8),
    Category.find({ active: true }).sort({ name: 1 }).limit(12),
    Product.find({ active: true }).populate('category').sort({ soldCount: -1, viewCount: -1, createdAt: -1 }).limit(4),
    Product.find({ active: true, 'flashSale.enabled': true, 'flashSale.startsAt': { $lte: now }, 'flashSale.endsAt': { $gt: now } }).populate('category').sort({ 'flashSale.endsAt': 1 }).limit(8)
  ]);
  res.render('home', { title: 'Produk digital untuk proyek Anda', featured, categories, popular, flashSales });
}

async function list(req, res) {
  const query = { active: true };
  if (req.query.q) {
    const regex = new RegExp(escapeRegex(req.query.q), 'i');
    query.$or = [{ name: regex }, { shortDescription: regex }, { description: regex }, { tags: regex }];
  }
  if (req.query.category) {
    const category = await Category.findOne({ slug: req.query.category, active: true });
    query.category = category?._id || null;
  }
  const sortMap = {
    newest: { featured: -1, createdAt: -1 },
    popular: { soldCount: -1, viewCount: -1, createdAt: -1 },
    rating: { ratingAverage: -1, ratingCount: -1, createdAt: -1 },
    price_low: { promoPrice: 1, price: 1, createdAt: -1 },
    price_high: { promoPrice: -1, price: -1, createdAt: -1 }
  };
  const sort = sortMap[req.query.sort] || sortMap.newest;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = 12;
  const [products, categories, total] = await Promise.all([
    Product.find(query).populate('category').sort(sort).skip((page - 1) * limit).limit(limit),
    Category.find({ active: true }).sort({ name: 1 }),
    Product.countDocuments(query)
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  res.render('products/list', { title: 'Produk', products, categories, filters: req.query, pagination: { page, totalPages, total } });
}

async function detail(req, res) {
  const product = await Product.findOne({ slug: req.params.slug, active: true }).populate('category');
  if (!product) throw new AppError('Produk tidak ditemukan.', 404);
  await Product.updateOne({ _id: product._id }, { $inc: { viewCount: 1 } });

  const recentIds = Array.isArray(req.session.recentProductIds) ? req.session.recentProductIds : [];
  req.session.recentProductIds = [String(product._id), ...recentIds.filter((id) => id !== String(product._id))].slice(0, 8);
  const relatedQuery = { _id: { $ne: product._id }, active: true, $or: [{ category: product.category?._id }, { tags: { $in: product.tags || [] } }] };

  const reviewPage = Math.max(1, Number.parseInt(req.query.reviewPage, 10) || 1);
  const reviewLimit = 10;
  const reviewFilter = { product: product._id, status: 'published' };

  const [related, recentlyViewed, reviews, reviewTotal, ratingRows, currentUserReview, verifiedOrder] = await Promise.all([
    Product.find(relatedQuery).populate('category').sort({ soldCount: -1, featured: -1 }).limit(4),
    Product.find({ _id: { $in: recentIds.slice(0, 4) }, active: true }).populate('category').limit(4),
    Review.find(reviewFilter).populate('user', 'name avatar').sort({ createdAt: -1 }).skip((reviewPage - 1) * reviewLimit).limit(reviewLimit),
    Review.countDocuments(reviewFilter),
    Review.aggregate([{ $match: reviewFilter }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
    req.user ? Review.findOne({ product: product._id, user: req.user._id }) : null,
    req.user ? reviewService.findVerifiedPurchase(req.user._id, product._id) : null
  ]);

  const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratingRows.forEach((row) => { ratingBreakdown[row._id] = row.count; });
  const reviewPages = Math.max(1, Math.ceil(reviewTotal / reviewLimit));

  res.render('products/detail', {
    title: product.name,
    product,
    related,
    recentlyViewed,
    reviews,
    reviewTotal,
    ratingBreakdown,
    reviewPagination: { page: reviewPage, totalPages: reviewPages },
    currentUserReview,
    canReview: Boolean(verifiedOrder)
  });
}

module.exports = { home, list, detail };
