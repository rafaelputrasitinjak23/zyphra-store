const axios = require('axios');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');

async function verifyTurnstile(token, ip) {
  if (!env.turnstile.secretKey) {
    if (env.isProduction) throw new AppError('Turnstile belum dikonfigurasi.', 503, 'CAPTCHA_NOT_CONFIGURED');
    return true;
  }
  if (!token) throw new AppError('Silakan selesaikan CAPTCHA.', 400, 'CAPTCHA_REQUIRED');
  const body = new URLSearchParams({ secret: env.turnstile.secretKey, response: token });
  if (ip) body.set('remoteip', ip);
  const { data } = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', body, { timeout: 10000 });
  if (!data.success) throw new AppError('Verifikasi CAPTCHA gagal. Silakan coba lagi.', 400, 'CAPTCHA_FAILED');
  return true;
}
module.exports = { verifyTurnstile };
