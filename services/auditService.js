const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

const REDACTED_KEYS = new Set([
  'password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'otp', 'otpHash',
  'secret', 'sessionSecret', 'downloadTokenSecret', 'apiKey', 'smtpPass', 'digitalFileUrl', 'digitalStorageKey',
  'retryPayload', 'lastWebhookData'
]);

function sanitize(value, depth = 0) {
  if (value == null || depth > 8) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.slice(0, 200).map((entry) => sanitize(entry, depth + 1));
  if (typeof value !== 'object') return value;

  const source = typeof value.toObject === 'function'
    ? value.toObject({ depopulate: true, versionKey: false })
    : value;
  const output = {};
  for (const [key, entry] of Object.entries(source)) {
    if (REDACTED_KEYS.has(key) || /(?:password|secret|token|api.?key|authorization)/i.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = sanitize(entry, depth + 1);
    }
  }
  return output;
}

async function record({ req, action, entityType, entityId, before, after, metadata }) {
  try {
    return await AuditLog.create({
      actor: req?.user?._id,
      action,
      entityType,
      entityId: String(entityId),
      before: sanitize(before),
      after: sanitize(after),
      metadata: sanitize(metadata),
      requestId: req?.id,
      ip: req?.ip,
      userAgent: String(req?.get?.('user-agent') || '').slice(0, 500)
    });
  } catch (error) {
    logger.error('audit.write_failed', { error, action, entityType, entityId: String(entityId), requestId: req?.id });
    throw error;
  }
}

module.exports = { record, sanitize };
