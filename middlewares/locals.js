const { rupiah, formatDate, datetimeLocal } = require('../utils/helpers');
const { env } = require('../config/env');
const { getProductPriceInfo } = require('../services/productPricingService');
const { availableStock } = require('../utils/inventory');

function absoluteUrl(value) {
  if (!value) return '';
  try { return new URL(value, env.appUrl).toString(); } catch { return ''; }
}

function localsMiddleware(req, res, next) {
  res.locals.currentUser = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.rupiah = rupiah;
  res.locals.formatDate = formatDate;
  res.locals.datetimeLocal = datetimeLocal;
  res.locals.appUrl = env.appUrl;
  res.locals.currentUrl = absoluteUrl(req.originalUrl.split('?')[0]);
  res.locals.productPrice = getProductPriceInfo;
  res.locals.availableStock = availableStock;
  res.locals.seo = {
    title: null,
    description: 'TOKOZYPHRA - marketplace script, bot, template, API, dan source code digital.',
    canonical: absoluteUrl(req.path),
    image: absoluteUrl('/public/icons/icon-512.svg'),
    type: 'website',
    robots: req.path.startsWith('/admin') || req.path.startsWith('/account') || req.path.startsWith('/checkout') || req.path.startsWith('/orders') || req.path.startsWith('/wallet') || req.path.startsWith('/payments') || req.path.startsWith('/downloads') || req.path.startsWith('/auth') || req.path.startsWith('/notifications') ? 'noindex,nofollow' : 'index,follow',
    jsonLd: null
  };
  next();
}

module.exports = { localsMiddleware, absoluteUrl };
