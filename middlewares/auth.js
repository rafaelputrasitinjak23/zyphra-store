const { AppError } = require('../utils/errors');
function requireAuth(req, res, next) {
  if (!req.isAuthenticated?.()) { req.session.returnTo = req.originalUrl; req.flash('error', 'Silakan login terlebih dahulu.'); return res.redirect('/auth/login'); }
  if (req.user.status === 'blocked') { req.logout(() => {}); return next(new AppError('Akun Anda diblokir.', 403, 'ACCOUNT_BLOCKED')); }
  if (req.session.authVersion !== req.user.sessionVersion) { req.logout(() => {}); req.session.destroy(() => {}); return res.redirect('/auth/login'); }
  next();
}
function requireAdmin(req, res, next) { requireAuth(req, res, (error) => { if (error) return next(error); if (req.user.role !== 'admin') return next(new AppError('Akses admin diperlukan.', 403, 'ADMIN_REQUIRED')); next(); }); }
module.exports = { requireAuth, requireAdmin };
