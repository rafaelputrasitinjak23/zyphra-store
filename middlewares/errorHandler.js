const { env } = require('../config/env');
function notFound(req, res) { res.status(404).render('errors/404', { title: 'Halaman tidak ditemukan' }); }
function errorHandler(error, req, res, next) {
  const status = error.statusCode || 500;
  if (!error.isOperational) console.error(error);
  const message = status >= 500 && env.isProduction ? 'Terjadi kesalahan pada server.' : error.message;
  if (req.accepts('html')) return res.status(status).render('errors/error', { title: 'Terjadi kesalahan', status, message, stack: env.isProduction ? null : error.stack });
  res.status(status).json({ error: message, code: error.code || 'INTERNAL_ERROR' });
}
module.exports = { notFound, errorHandler };
