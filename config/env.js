const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const bool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 3000),
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  mongoUri: process.env.MONGODB_URI || '',
  sessionSecret: process.env.SESSION_SECRET || 'change-this-development-secret',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS || 7),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || `${process.env.APP_URL || 'http://localhost:3000'}/auth/google/callback`
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackUrl: process.env.GITHUB_CALLBACK_URL || `${process.env.APP_URL || 'http://localhost:3000'}/auth/github/callback`
  },
  turnstile: {
    siteKey: process.env.TURNSTILE_SITE_KEY || '',
    secretKey: process.env.TURNSTILE_SECRET_KEY || ''
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool(process.env.SMTP_SECURE),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: process.env.SMTP_FROM_NAME || 'Zyphra Store',
    fromEmail: process.env.SMTP_FROM_EMAIL || '',
    adminEmail: process.env.ADMIN_EMAIL || ''
  },
  pakasir: {
    slug: process.env.PAKASIR_SLUG || '',
    apiKey: process.env.PAKASIR_API_KEY || '',
    baseUrl: (process.env.PAKASIR_BASE_URL || 'https://app.pakasir.com').replace(/\/$/, ''),
    webhookSecret: process.env.PAKASIR_WEBHOOK_SECRET || ''
  },
  feeSplitThreshold: Number(process.env.FEE_SPLIT_THRESHOLD || 50000),
  downloadTokenSecret: process.env.DOWNLOAD_TOKEN_SECRET || process.env.SESSION_SECRET || 'change-download-secret',
  downloadTokenTtl: process.env.DOWNLOAD_TOKEN_TTL || '5m'
};

function assertRuntimeConfig() {
  const required = ['mongoUri', 'sessionSecret'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Environment wajib belum diisi: ${missing.join(', ')}`);
  if (env.isProduction && env.sessionSecret.includes('change-this')) {
    throw new Error('SESSION_SECRET production harus diganti.');
  }
}

module.exports = { env, assertRuntimeConfig };
