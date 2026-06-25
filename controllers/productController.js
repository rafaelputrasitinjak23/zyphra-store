const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const reviewService = require('../services/reviewService');
const { getProductPriceInfo } = require('../services/productPricingService');
const { escapeRegex } = require('../utils/helpers');
const { AppError } = require('../utils/errors');
const { env } = require('../config/env');
const { availableStock } = require('../utils/inventory');

function absoluteUrl(value) {
  try { return new URL(value, env.appUrl).toString(); } catch { return env.appUrl; }
}

async function home(req, res) {
  const now = new Date();
  const [featured, categories, popular, flashSales] = await Promise.all([
    Product.find({ active: true, featured: true }).select('+reservedStock').populate('category').sort({ soldCount: -1, createdAt: -1 }).limit(8),
    Category.find({ active: true }).sort({ name: 1 }).limit(12),
    Product.find({ active: true }).select('+reservedStock').populate('category').sort({ soldCount: -1, viewCount: -1, createdAt: -1 }).limit(4),
    Product.find({ active: true, 'flashSale.enabled': true, 'flashSale.startsAt': { $lte: now }, 'flashSale.endsAt': { $gt: now } }).select('+reservedStock').populate('category').sort({ 'flashSale.endsAt': 1 }).limit(8)
  ]);
  res.locals.seo = {
    ...res.locals.seo,
    title: 'Produk digital untuk proyek Anda',
    description: 'Temukan script, bot, template, API, dan source code digital di TOKOZYPHRA.',
    canonical: absoluteUrl('/'),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'TOKOZYPHRA',
      url: absoluteUrl('/'),
      potentialAction: { '@type': 'SearchAction', target: `${absoluteUrl('/products')}?q={search_term_string}`, 'query-input': 'required name=search_term_string' }
    }
  };
  res.render('home', { title: 'Produk digital untuk proyek Anda', featured, categories, popular, flashSales });
}

async function getPriceSortedProducts(query, direction, page, limit) {
  const now = new Date();
  const rows = await Product.aggregate([
    { $match: query },
    {
      $addFields: {
        __basePrice: {
          $cond: [
            { $and: [{ $ne: ['$promoPrice', null] }, { $lt: ['$promoPrice', '$price'] }] },
            '$promoPrice',
            '$price'
          ]
        }
      }
    },
    {
      $addFields: {
        __effectivePrice: {
          $cond: [
            {
              $and: [
                '$flashSale.enabled',
                { $ne: ['$flashSale.price', null] },
                { $lte: ['$flashSale.startsAt', now] },
                { $gt: ['$flashSale.endsAt', now] },
                { $lt: ['$flashSale.price', '$__basePrice'] }
              ]
            },
            '$flashSale.price',
            '$__basePrice'
          ]
        }
      }
    },
    { $sort: { __effectivePrice: direction, createdAt: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $project: { _id: 1 } }
  ]);
  const ids = rows.map((row) => row._id);
  const products = await Product.find({ _id: { $in: ids } }).select('+reservedStock').populate('category');
  const byId = new Map(products.map((product) => [String(product._id), product]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
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
    rating: { ratingAverage: -1, ratingCount: -1, createdAt: -1 }
  };
  const sortKey = String(req.query.sort || 'newest');
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = 12;
  const categoriesPromise = Category.find({ active: true }).sort({ name: 1 });
  const totalPromise = Product.countDocuments(query);
  const productsPromise = sortKey === 'price_low' || sortKey === 'price_high'
    ? getPriceSortedProducts(query, sortKey === 'price_low' ? 1 : -1, page, limit)
    : Product.find(query).select('+reservedStock').populate('category').sort(sortMap[sortKey] || sortMap.newest).skip((page - 1) * limit).limit(limit);
  const [products, categories, total] = await Promise.all([productsPromise, categoriesPromise, totalPromise]);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const hasSearch = Boolean(req.query.q || req.query.category || page > 1);
  res.locals.seo = {
    ...res.locals.seo,
    title: req.query.q ? `Hasil pencarian “${String(req.query.q).slice(0, 80)}”` : 'Katalog produk digital',
    description: 'Jelajahi katalog script, bot, template, API, dan source code digital TOKOZYPHRA.',
    canonical: absoluteUrl('/products'),
    robots: hasSearch ? 'noindex,follow' : 'index,follow'
  };
  res.render('products/list', { title: 'Produk', products, categories, filters: req.query, pagination: { page, totalPages, total } });
}

async function detail(req, res) {
  const product = await Product.findOne({ slug: req.params.slug, active: true }).select('+reservedStock').populate('category');
  if (!product) throw new AppError('Produk tidak ditemukan.', 404);
  await Product.updateOne({ _id: product._id }, { $inc: { viewCount: 1 } });

  const recentIds = Array.isArray(req.session.recentProductIds) ? req.session.recentProductIds : [];
  req.session.recentProductIds = [String(product._id), ...recentIds.filter((id) => id !== String(product._id))].slice(0, 8);
  const relatedQuery = { _id: { $ne: product._id }, active: true, $or: [{ category: product.category?._id }, { tags: { $in: product.tags || [] } }] };

  const reviewPage = Math.max(1, Number.parseInt(req.query.reviewPage, 10) || 1);
  const reviewLimit = 10;
  const reviewFilter = { product: product._id, status: 'published' };

  const [related, recentlyViewed, reviews, reviewTotal, ratingRows, currentUserReview, verifiedOrder] = await Promise.all([
    Product.find(relatedQuery).select('+reservedStock').populate('category').sort({ soldCount: -1, featured: -1 }).limit(4),
    Product.find({ _id: { $in: recentIds.slice(0, 4) }, active: true }).select('+reservedStock').populate('category').limit(4),
    Review.find(reviewFilter).populate('user', 'name avatar').sort({ createdAt: -1 }).skip((reviewPage - 1) * reviewLimit).limit(reviewLimit),
    Review.countDocuments(reviewFilter),
    Review.aggregate([{ $match: reviewFilter }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
    req.user ? Review.findOne({ product: product._id, user: req.user._id }) : null,
    req.user ? reviewService.findVerifiedPurchase(req.user._id, product._id) : null
  ]);

  const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratingRows.forEach((row) => { ratingBreakdown[row._id] = row.count; });
  const reviewPages = Math.max(1, Math.ceil(reviewTotal / reviewLimit));
  const priceInfo = getProductPriceInfo(product);
  const canonical = absoluteUrl(`/products/${product.slug}`);
  const image = absoluteUrl(product.thumbnail);
  const offer = {
    '@type': 'Offer',
    url: canonical,
    priceCurrency: 'IDR',
    price: priceInfo.effectivePrice,
    availability: product.unlimitedStock || availableStock(product) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
  };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription,
    image: [image],
    sku: String(product._id),
    category: product.category?.name,
    offers: offer
  };
  if (product.ratingCount > 0) {
    jsonLd.aggregateRating = { '@type': 'AggregateRating', ratingValue: product.ratingAverage, reviewCount: product.ratingCount };
  }
  res.locals.seo = {
    ...res.locals.seo,
    title: product.name,
    description: product.shortDescription,
    canonical,
    image,
    type: 'product',
    jsonLd
  };

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

module.exports = { home, list, detail, getPriceSortedProducts };
