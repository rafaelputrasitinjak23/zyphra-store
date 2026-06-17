const { rupiah, formatDate, datetimeLocal } = require('../utils/helpers');
const { env } = require('../config/env');
const { getProductPriceInfo } = require('../services/productPricingService');
function localsMiddleware(req, res, next) {
  res.locals.currentUser = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.rupiah = rupiah;
  res.locals.formatDate = formatDate;
  res.locals.datetimeLocal = datetimeLocal;
  res.locals.appUrl = env.appUrl;
  res.locals.productPrice = getProductPriceInfo;
  next();
}
module.exports = { localsMiddleware };
