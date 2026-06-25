const crypto = require('crypto');
const logger = require('../utils/logger');

function requestContext(req, res, next) {
  const incoming = String(req.get('x-request-id') || '').trim();
  req.id = /^[A-Za-z0-9._:-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const metadata = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip
    };
    if (res.statusCode >= 500) logger.error('request.completed', metadata);
    else if (res.statusCode >= 400 || durationMs >= 1500) logger.warn('request.completed', metadata);
    else logger.info('request.completed', metadata);
  });
  next();
}

module.exports = { requestContext };
