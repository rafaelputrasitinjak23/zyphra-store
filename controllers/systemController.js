const crypto = require('crypto');
const mongoose = require('mongoose');
const { env } = require('../config/env');
const maintenanceService = require('../services/maintenanceService');
const { AppError } = require('../utils/errors');

function health(req, res) {
  res.status(200).json({ ok: true, service: 'tokozyphra', timestamp: new Date().toISOString(), requestId: req.id });
}

async function readiness(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) await require('../config/database').connectDatabase();
  } catch (_) {}
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ok: ready, database: ready ? 'connected' : 'unavailable', requestId: req.id });
}

function safeEqual(value, expected) {
  const left = Buffer.from(String(value || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function maintenance(req, res) {
  const authorization = String(req.get('authorization') || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : String(req.get('x-cron-secret') || '');
  if (!env.cronSecret || !safeEqual(token, env.cronSecret)) throw new AppError('Akses maintenance ditolak.', 401, 'MAINTENANCE_UNAUTHORIZED');
  await require('../config/database').connectDatabase();
  const result = await maintenanceService.runMaintenance({ limit: env.maintenanceBatchSize });
  res.json({ ok: true, data: result, requestId: req.id });
}

module.exports = { health, readiness, maintenance, safeEqual };
