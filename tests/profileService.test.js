const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, normalizeBio, validateAvatarData } = require('../services/profileService');

test('nomor telepon profil dinormalisasi', () => {
  assert.equal(normalizePhone('+62 812-3456-7890'), '+6281234567890');
  assert.equal(normalizePhone(''), '');
  assert.throws(() => normalizePhone('abc'), /tidak valid/);
});

test('bio profil dibatasi 160 karakter', () => {
  assert.equal(normalizeBio('  Developer  '), 'Developer');
  assert.throws(() => normalizeBio('x'.repeat(161)), /maksimal 160/);
});

test('foto profil hanya menerima data image yang benar', () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const avatar = `data:image/png;base64,${pngHeader.toString('base64')}`;
  assert.equal(validateAvatarData(avatar), avatar);
  assert.throws(() => validateAvatarData('data:image/png;base64,SGFsbw=='), /tidak sesuai/);
  assert.throws(() => validateAvatarData('data:text/plain;base64,SGFsbw=='), /PNG, JPG, atau WebP/);
});
