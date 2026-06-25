const rateLimit = require('express-rate-limit');

function wantsJson(req) {
  return req.path.startsWith('/api/') || req.path.startsWith('/webhooks/') || req.accepts(['html', 'json']) === 'json';
}

function browserHandler(message) {
  return (req, res) => {
    if (wantsJson(req)) return res.status(429).json({ ok: false, message, code: 'RATE_LIMITED', requestId: req.id });
    req.flash?.('error', message);
    return res.status(429).redirect(req.get('referer') || '/');
  };
}

const base = { standardHeaders: 'draft-7', legacyHeaders: false };
const globalLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 600,
  skip: (req) => ['/healthz', '/api/system/ready'].includes(req.path),
  handler: browserHandler('Terlalu banyak permintaan. Silakan coba lagi nanti.')
});
const authLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 20, handler: browserHandler('Terlalu banyak percobaan autentikasi.') });
const otpLimiter = rateLimit({ ...base, windowMs: 10 * 60 * 1000, limit: 8, handler: browserHandler('Terlalu banyak permintaan OTP.') });
const checkoutLimiter = rateLimit({ ...base, windowMs: 10 * 60 * 1000, limit: 10, handler: browserHandler('Terlalu banyak percobaan checkout.') });
const cancelLimiter = rateLimit({ ...base, windowMs: 10 * 60 * 1000, limit: 8, handler: browserHandler('Terlalu banyak permintaan pembatalan.') });
const reviewLimiter = rateLimit({ ...base, windowMs: 10 * 60 * 1000, limit: 12, handler: browserHandler('Terlalu banyak permintaan ulasan.') });
const apiLimiter = rateLimit({ ...base, windowMs: 10 * 60 * 1000, limit: 120, handler: browserHandler('Batas penggunaan API tercapai.') });
const webhookLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 90,
  handler: (req, res) => res.status(429).json({ received: false, code: 'WEBHOOK_RATE_LIMITED', requestId: req.id })
});
const maintenanceLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 6,
  handler: (req, res) => res.status(429).json({ ok: false, message: 'Maintenance terlalu sering dipanggil.', code: 'MAINTENANCE_RATE_LIMITED', requestId: req.id })
});
const aiLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60 * 1000,
  limit: 25,
  handler: (req, res) => res.status(429).json({ ok: false, message: 'Batas penggunaan AI tercapai. Silakan coba lagi beberapa saat.', code: 'AI_RATE_LIMITED', requestId: req.id })
});

module.exports = {
  globalLimiter,
  authLimiter,
  otpLimiter,
  checkoutLimiter,
  aiLimiter,
  cancelLimiter,
  reviewLimiter,
  apiLimiter,
  webhookLimiter,
  maintenanceLimiter
};
