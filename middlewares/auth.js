const User = require('../models/User');
const { AppError } = require('../utils/errors');

async function attachUser(req, res, next) {
  try {
    req.user = null;
    const userId = req.session?.userId;
    if (!userId) return next();

    const user = await User.findById(userId);
    if (!user) {
      delete req.session.userId;
      delete req.session.authVersion;
      return next();
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    req.session.returnTo = req.originalUrl;
    req.flash('error', 'Silakan login terlebih dahulu.');
    return res.redirect('/auth/login');
  }

  if (req.user.status === 'blocked') {
    return req.session.destroy(() => next(new AppError('Akun Anda diblokir.', 403, 'ACCOUNT_BLOCKED')));
  }

  if (req.session.authVersion !== req.user.sessionVersion) {
    return req.session.destroy(() => res.redirect('/auth/login'));
  }

  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, (error) => {
    if (error) return next(error);
    if (req.user.role !== 'admin') return next(new AppError('Akses admin diperlukan.', 403, 'ADMIN_REQUIRED'));
    next();
  });
}

module.exports = { attachUser, requireAuth, requireAdmin };
