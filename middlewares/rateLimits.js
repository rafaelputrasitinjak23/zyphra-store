const rateLimit = require('express-rate-limit');
const common = { standardHeaders: 'draft-7', legacyHeaders: false, handler: (req, res) => { req.flash?.('error', 'Terlalu banyak permintaan. Silakan coba lagi nanti.'); res.status(429).redirect(req.get('referer') || '/'); } };
const globalLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 500 });
const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 20 });
const otpLimiter = rateLimit({ ...common, windowMs: 10 * 60 * 1000, limit: 8 });
const checkoutLimiter = rateLimit({ ...common, windowMs: 10 * 60 * 1000, limit: 10 });
module.exports = { globalLimiter, authLimiter, otpLimiter, checkoutLimiter };
