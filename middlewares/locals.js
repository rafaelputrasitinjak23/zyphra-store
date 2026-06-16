const { rupiah, formatDate } = require('../utils/helpers');
const { env } = require('../config/env');
function localsMiddleware(req, res, next) {
  res.locals.currentUser = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.rupiah = rupiah;
  res.locals.formatDate = formatDate;
  res.locals.appUrl = env.appUrl;
  next();
}
module.exports = { localsMiddleware };
