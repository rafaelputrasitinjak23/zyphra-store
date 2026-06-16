const crypto = require('crypto');
const { AppError } = require('../utils/errors');
function csrfMiddleware(req, res, next) {
  req.session.csrfToken ||= crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.startsWith('/webhooks/')) return next();
  const token = req.body?._csrf || req.get('x-csrf-token');
  if (!token || token.length !== req.session.csrfToken.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(req.session.csrfToken))) return next(new AppError('Sesi formulir tidak valid. Muat ulang halaman.', 403, 'CSRF_INVALID'));
  next();
}
module.exports = { csrfMiddleware };
