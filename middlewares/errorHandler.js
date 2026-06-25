const { env } = require('../config/env');
const logger = require('../utils/logger');

function notFound(req, res) {
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhooks/') || req.accepts(['html', 'json']) === 'json') {
    return res.status(404).json({ ok: false, message: 'Endpoint tidak ditemukan.', code: 'NOT_FOUND', requestId: req.id });
  }
  return res.status(404).render('errors/404', { title: 'Halaman tidak ditemukan' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.statusCode || 500;
  if (!error.isOperational || status >= 500) {
    logger.error('request.failed', { requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0], status, error });
  }
  const message = status >= 500 && env.isProduction ? 'Terjadi kesalahan pada server.' : error.message;
  const isMachineEndpoint = req.path.startsWith('/api/') || req.path.startsWith('/webhooks/');
  if (!isMachineEndpoint && req.accepts('html')) {
    return res.status(status).render('errors/error', {
      title: 'Terjadi kesalahan',
      status,
      message,
      requestId: req.id,
      stack: env.isProduction ? null : error.stack
    });
  }
  return res.status(status).json({ ok: false, message, error: message, code: error.code || 'INTERNAL_ERROR', requestId: req.id });
}

module.exports = { notFound, errorHandler };
