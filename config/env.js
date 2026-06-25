const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const csv = (value) => String(value || '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT || 3000),
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  mongoUri: process.env.MONGODB_URI || '',
  sessionSecret: process.env.SESSION_SECRET || (isProduction ? '' : 'development-session-secret-change-me'),
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS || 7),
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  cronSecret: process.env.CRON_SECRET || '',
  maintenanceBatchSize: Math.max(1, Math.min(500, Number(process.env.MAINTENANCE_BATCH_SIZE || 100))),
  orderInitializationTimeoutMinutes: Math.max(5, Number(process.env.ORDER_INITIALIZATION_TIMEOUT_MINUTES || 20)),
  smtpRequired: bool(process.env.SMTP_REQUIRED, isProduction),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool(process.env.SMTP_SECURE),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: process.env.SMTP_FROM_NAME || 'TOKOZYPHRA',
    fromEmail: process.env.SMTP_FROM_EMAIL || '',
    adminEmail: process.env.ADMIN_EMAIL || ''
  },
  pakasir: {
    enabled: bool(process.env.PAKASIR_ENABLED, false),
    slug: process.env.PAKASIR_SLUG || '',
    apiKey: process.env.PAKASIR_API_KEY || '',
    baseUrl: (process.env.PAKASIR_BASE_URL || 'https://app.pakasir.com').replace(/\/$/, ''),
    webhookSecret: process.env.PAKASIR_WEBHOOK_SECRET || ''
  },
  feeSplitThreshold: Number(process.env.FEE_SPLIT_THRESHOLD || 50000),
  downloadTokenSecret: process.env.DOWNLOAD_TOKEN_SECRET || process.env.SESSION_SECRET || (isProduction ? '' : 'development-download-secret-change-me'),
  downloadTokenTtl: process.env.DOWNLOAD_TOKEN_TTL || '5m',
  downloadAllowedHosts: csv(process.env.DOWNLOAD_ALLOWED_HOSTS),
  downloadDeliveryMode: process.env.DOWNLOAD_DELIVERY_MODE === 'redirect' ? 'redirect' : 'proxy',
  downloadTimeoutMs: Math.max(5000, Number(process.env.DOWNLOAD_TIMEOUT_MS || 30000)),
  downloadMaxRedirects: Math.max(0, Math.min(10, Number(process.env.DOWNLOAD_MAX_REDIRECTS || 3))),
  objectStorage: {
    enabled: bool(process.env.OBJECT_STORAGE_ENABLED, false),
    endpoint: String(process.env.OBJECT_STORAGE_ENDPOINT || '').replace(/\/$/, ''),
    region: process.env.OBJECT_STORAGE_REGION || 'us-east-1',
    bucket: process.env.OBJECT_STORAGE_BUCKET || '',
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY || '',
    forcePathStyle: bool(process.env.OBJECT_STORAGE_FORCE_PATH_STYLE, false),
    publicBaseUrl: String(process.env.OBJECT_STORAGE_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
    avatarPrefix: String(process.env.OBJECT_STORAGE_AVATAR_PREFIX || 'avatars').replace(/^\/+|\/+$/g, ''),
    productPrefix: String(process.env.OBJECT_STORAGE_PRODUCT_PREFIX || 'products').replace(/^\/+|\/+$/g, ''),
    signedUrlTtlSeconds: Math.max(60, Math.min(3600, Number(process.env.OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS || 300)))
  },
  ai: {
    enabled: bool(process.env.AI_ENABLED, true),
    baseUrl: (process.env.AI_BASE_URL || 'https://api.siputzx.my.id').replace(/\/$/, ''),
    path: process.env.AI_PATH || '/api/ai/glm47flash',
    temperature: Number(process.env.AI_TEMPERATURE || 0.7),
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 30000)
  }
};

function assertRuntimeConfig() {
  const missing = [];
  if (!env.mongoUri) missing.push('MONGODB_URI');
  if (!env.sessionSecret) missing.push('SESSION_SECRET');
  if (!env.downloadTokenSecret) missing.push('DOWNLOAD_TOKEN_SECRET');
  if (!env.appUrl) missing.push('APP_URL');

  if (env.isProduction && !env.appUrl.startsWith('https://')) {
    throw new Error('APP_URL production harus menggunakan HTTPS.');
  }

  if (env.pakasir.enabled) {
    if (!env.pakasir.slug) missing.push('PAKASIR_SLUG');
    if (!env.pakasir.apiKey) missing.push('PAKASIR_API_KEY');
    if (env.isProduction && !env.pakasir.baseUrl.startsWith('https://')) {
      throw new Error('PAKASIR_BASE_URL production harus menggunakan HTTPS.');
    }
  }

  if (env.objectStorage.enabled) {
    if (env.isProduction && env.objectStorage.endpoint && !env.objectStorage.endpoint.startsWith('https://')) {
      throw new Error('OBJECT_STORAGE_ENDPOINT production harus menggunakan HTTPS.');
    }
    if (env.objectStorage.publicBaseUrl && !env.objectStorage.publicBaseUrl.startsWith('https://')) {
      throw new Error('OBJECT_STORAGE_PUBLIC_BASE_URL harus menggunakan HTTPS.');
    }
    for (const [key, value] of Object.entries({
      OBJECT_STORAGE_BUCKET: env.objectStorage.bucket,
      OBJECT_STORAGE_ACCESS_KEY_ID: env.objectStorage.accessKeyId,
      OBJECT_STORAGE_SECRET_ACCESS_KEY: env.objectStorage.secretAccessKey
    })) {
      if (!value) missing.push(key);
    }
  }

  if (env.smtpRequired) {
    for (const [key, value] of Object.entries({
      SMTP_HOST: env.smtp.host,
      SMTP_USER: env.smtp.user,
      SMTP_PASS: env.smtp.pass,
      SMTP_FROM_EMAIL: env.smtp.fromEmail
    })) {
      if (!value) missing.push(key);
    }
  }

  if (env.isProduction && !env.cronSecret) missing.push('CRON_SECRET');
  if (missing.length) throw new Error(`Environment wajib belum diisi: ${[...new Set(missing)].join(', ')}`);

  if (env.isProduction && new Set([env.sessionSecret, env.downloadTokenSecret, env.cronSecret]).size !== 3) {
    throw new Error('SESSION_SECRET, DOWNLOAD_TOKEN_SECRET, dan CRON_SECRET production harus berbeda.');
  }

  const weakSecrets = ['change-this', 'change-me', 'development-', 'secret123', 'replace-with'];
  for (const [name, value] of [['SESSION_SECRET', env.sessionSecret], ['DOWNLOAD_TOKEN_SECRET', env.downloadTokenSecret], ['CRON_SECRET', env.cronSecret]]) {
    if (env.isProduction && (value.length < 32 || weakSecrets.some((part) => value.toLowerCase().includes(part)))) {
      throw new Error(`${name} production harus acak dan minimal 32 karakter.`);
    }
  }

  if (!Number.isFinite(env.sessionTtlDays) || env.sessionTtlDays <= 0) throw new Error('SESSION_TTL_DAYS tidak valid.');
  if (!Number.isFinite(env.port) || env.port <= 0) throw new Error('PORT tidak valid.');
}

module.exports = { env, assertRuntimeConfig };
