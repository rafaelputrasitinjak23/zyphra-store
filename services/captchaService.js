const crypto = require('crypto');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');

const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const CAPTCHA_LENGTH = 5;
const CAPTCHA_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CAPTCHA_ID_PATTERN = /^[a-f0-9]{32}$/;

function createCaptchaId() {
  return crypto.randomBytes(16).toString('hex');
}

function generateCaptchaCode(length = CAPTCHA_LENGTH) {
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += CAPTCHA_CHARSET[crypto.randomInt(0, CAPTCHA_CHARSET.length)];
  }
  return code;
}

function captchaHash(id, code) {
  return crypto
    .createHmac('sha256', env.sessionSecret)
    .update(`${id}:${String(code || '').trim().toUpperCase()}`)
    .digest('hex');
}

function pruneCaptchas(session) {
  const now = Date.now();
  const entries = Object.entries(session.textCaptchas || {})
    .filter(([, challenge]) => challenge?.expiresAt > now)
    .slice(-10);
  session.textCaptchas = Object.fromEntries(entries);
}

function buildCaptchaSvg(code) {
  const width = 210;
  const height = 72;
  const characterWidth = 34;
  const startX = 24;

  const noiseLines = Array.from({ length: 7 }, () => {
    const x1 = crypto.randomInt(0, width);
    const y1 = crypto.randomInt(5, height - 5);
    const x2 = crypto.randomInt(0, width);
    const y2 = crypto.randomInt(5, height - 5);
    const opacity = (crypto.randomInt(18, 42) / 100).toFixed(2);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4f46e5" stroke-width="1.4" opacity="${opacity}"/>`;
  }).join('');

  const dots = Array.from({ length: 28 }, () => {
    const cx = crypto.randomInt(3, width - 3);
    const cy = crypto.randomInt(3, height - 3);
    const radius = crypto.randomInt(1, 3);
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="#94a3b8" opacity="0.45"/>`;
  }).join('');

  const characters = [...code].map((character, index) => {
    const x = startX + index * characterWidth + crypto.randomInt(-2, 3);
    const y = 49 + crypto.randomInt(-4, 5);
    const rotation = crypto.randomInt(-14, 15);
    const fontSize = crypto.randomInt(30, 37);
    return `<text x="${x}" y="${y}" transform="rotate(${rotation} ${x} ${y})" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="800" fill="#111827">${character}</text>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Kode CAPTCHA">
  <rect width="100%" height="100%" rx="12" fill="#f8fafc"/>
  ${dots}
  ${noiseLines}
  ${characters}
  <rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="11.25" fill="none" stroke="#dbe1ea" stroke-width="1.5"/>
</svg>`;
}

async function renderCaptchaSvg(req, res) {
  const id = String(req.query.id || '').trim().toLowerCase();
  if (!CAPTCHA_ID_PATTERN.test(id)) throw new AppError('ID CAPTCHA tidak valid.', 400, 'CAPTCHA_ID_INVALID');

  const code = generateCaptchaCode();
  pruneCaptchas(req.session);
  req.session.textCaptchas[id] = {
    hash: captchaHash(id, code),
    expiresAt: Date.now() + CAPTCHA_TTL_MS
  };

  await new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });

  res.set({
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff'
  });
  res.send(buildCaptchaSvg(code));
}

function verifyTextCaptcha(req, id, value) {
  const normalizedId = String(id || '').trim().toLowerCase();
  const normalizedValue = String(value || '').trim().toUpperCase();
  const challenge = req.session.textCaptchas?.[normalizedId];

  if (req.session.textCaptchas?.[normalizedId]) {
    delete req.session.textCaptchas[normalizedId];
  }

  if (!CAPTCHA_ID_PATTERN.test(normalizedId) || !challenge) {
    throw new AppError('CAPTCHA tidak ditemukan atau sudah digunakan. Muat ulang halaman.', 400, 'CAPTCHA_MISSING');
  }
  if (challenge.expiresAt <= Date.now()) {
    throw new AppError('CAPTCHA sudah kedaluwarsa. Muat ulang kode lalu coba lagi.', 400, 'CAPTCHA_EXPIRED');
  }
  if (!/^[A-Z2-9]{5}$/.test(normalizedValue)) {
    throw new AppError('Masukkan lima karakter CAPTCHA yang terlihat.', 400, 'CAPTCHA_INVALID_FORMAT');
  }

  const expected = Buffer.from(challenge.hash, 'hex');
  const received = Buffer.from(captchaHash(normalizedId, normalizedValue), 'hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw new AppError('Kode CAPTCHA salah. Muat ulang halaman dan coba lagi.', 400, 'CAPTCHA_INCORRECT');
  }
  return true;
}

module.exports = {
  CAPTCHA_TTL_MS,
  createCaptchaId,
  generateCaptchaCode,
  renderCaptchaSvg,
  verifyTextCaptcha
};
