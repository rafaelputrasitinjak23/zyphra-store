const { env } = require('../config/env');

const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel = levels[env.logLevel] || levels.info;

function normalizeError(error) {
  if (!error) return undefined;
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    stack: env.isProduction ? undefined : error.stack
  };
}

function write(level, message, metadata = {}) {
  if ((levels[level] || levels.info) < configuredLevel) return;
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata
  };
  if (payload.error instanceof Error) payload.error = normalizeError(payload.error);
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

module.exports = {
  debug: (message, metadata) => write('debug', message, metadata),
  info: (message, metadata) => write('info', message, metadata),
  warn: (message, metadata) => write('warn', message, metadata),
  error: (message, metadata) => write('error', message, metadata),
  normalizeError
};
