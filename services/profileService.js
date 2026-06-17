const { AppError } = require('../utils/errors');

const MAX_AVATAR_BYTES = 750 * 1024;
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;

function normalizePhone(value) {
  const phone = String(value || '').trim();
  if (!phone) return '';
  if (!/^\+?[0-9\s()-]{9,22}$/.test(phone)) {
    throw new AppError('Nomor telepon tidak valid.', 400, 'INVALID_PHONE');
  }
  return phone.replace(/[\s()-]/g, '');
}

function normalizeBio(value) {
  const bio = String(value || '').trim();
  if (bio.length > 160) throw new AppError('Bio maksimal 160 karakter.', 400, 'BIO_TOO_LONG');
  return bio;
}

function validateAvatarData(value) {
  const avatarData = String(value || '').trim();
  if (!avatarData) return null;

  const match = avatarData.match(AVATAR_PATTERN);
  if (!match) throw new AppError('Foto profil harus berupa PNG, JPG, atau WebP.', 400, 'INVALID_AVATAR');

  let buffer;
  try { buffer = Buffer.from(match[2], 'base64'); } catch { buffer = null; }
  if (!buffer || !buffer.length) throw new AppError('Data foto profil tidak valid.', 400, 'INVALID_AVATAR');
  if (buffer.length > MAX_AVATAR_BYTES) {
    throw new AppError('Ukuran foto profil maksimal 750 KB.', 400, 'AVATAR_TOO_LARGE');
  }

  const type = match[1];
  const isPng = type === 'png' && buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = type === 'jpeg' && buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = type === 'webp' && buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!isPng && !isJpeg && !isWebp) throw new AppError('Isi file foto tidak sesuai dengan formatnya.', 400, 'INVALID_AVATAR_CONTENT');

  return `data:image/${type};base64,${buffer.toString('base64')}`;
}

module.exports = {
  MAX_AVATAR_BYTES,
  normalizePhone,
  normalizeBio,
  validateAvatarData
};
