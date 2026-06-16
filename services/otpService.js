const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Otp = require('../models/Otp');
const { AppError } = require('../utils/errors');
const emailService = require('./emailService');

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
function generateCode() { return String(crypto.randomInt(100000, 1000000)); }
function isOtpUsable(otp, now = new Date()) { return Boolean(otp && !otp.consumedAt && otp.expiresAt > now && otp.attempts < otp.maxAttempts); }

async function issueOtp({ user, email, purpose, force = false }) {
  const normalizedEmail = String(email).toLowerCase();
  const latest = await Otp.findOne({ email: normalizedEmail, purpose }).sort({ sentAt: -1 });
  if (!force && latest && Date.now() - latest.sentAt.getTime() < RESEND_COOLDOWN_MS) {
    const seconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - latest.sentAt.getTime())) / 1000);
    throw new AppError(`Tunggu ${seconds} detik sebelum mengirim ulang OTP.`, 429, 'OTP_COOLDOWN');
  }
  await Otp.updateMany({ email: normalizedEmail, purpose, consumedAt: null }, { $set: { consumedAt: new Date() } });
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const otp = await Otp.create({ user: user?._id || user, email: normalizedEmail, purpose, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  const result = await emailService.sendOtp(normalizedEmail, { name: user?.name, code, purpose });
  if (!result.sent) {
    await Otp.deleteOne({ _id: otp._id });
    throw new AppError('Email OTP gagal dikirim. Periksa konfigurasi SMTP atau coba lagi.', 503, 'EMAIL_SEND_FAILED');
  }
  return otp;
}

async function verifyOtp({ email, purpose, code, userId }) {
  const query = { email: String(email).toLowerCase(), purpose, consumedAt: null };
  if (userId) query.user = userId;
  const otp = await Otp.findOne(query).sort({ createdAt: -1 }).select('+codeHash');
  if (!otp || otp.expiresAt <= new Date()) throw new AppError('OTP tidak valid atau sudah kedaluwarsa.', 400, 'OTP_INVALID');
  if (otp.attempts >= otp.maxAttempts) throw new AppError('Batas percobaan OTP telah tercapai.', 429, 'OTP_ATTEMPTS_EXCEEDED');
  const valid = await bcrypt.compare(String(code || ''), otp.codeHash);
  if (!valid) {
    otp.attempts += 1;
    await otp.save();
    throw new AppError('OTP tidak valid atau sudah kedaluwarsa.', 400, 'OTP_INVALID');
  }
  const consumed = await Otp.findOneAndUpdate({ _id: otp._id, consumedAt: null }, { $set: { consumedAt: new Date() } }, { new: true });
  if (!consumed) throw new AppError('OTP sudah digunakan.', 400, 'OTP_ALREADY_USED');
  return consumed;
}
module.exports = { issueOtp, verifyOtp, isOtpUsable, OTP_TTL_MS, RESEND_COOLDOWN_MS };
