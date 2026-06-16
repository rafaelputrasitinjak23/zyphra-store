const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { createCaptchaId, renderCaptchaSvg, verifyTextCaptcha } = require('../services/captchaService');
const { issueOtp, verifyOtp } = require('../services/otpService');
const emailService = require('../services/emailService');
const { getClientInfo } = require('../utils/device');
const { AppError } = require('../utils/errors');
const { safeReturnTo } = require('../utils/helpers');
const { env } = require('../config/env');

function validationOrThrow(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
}
function verifyCaptchaOrRedirect(req, res, redirectTo) {
  try {
    verifyTextCaptcha(req, req.body.captchaId, req.body.captchaText);
    return true;
  } catch (error) {
    req.flash('error', error.message);
    res.redirect(redirectTo);
    return false;
  }
}
function renderRegister(req, res) { res.render('auth/register', { title: 'Daftar', form: {}, captchaId: createCaptchaId() }); }
function renderLogin(req, res) { res.render('auth/login', { title: 'Login', form: {}, captchaId: createCaptchaId() }); }
function renderOtp(req, res) {
  const flow = req.params.flow;
  const pending = flow === 'register' ? req.session.pendingRegister : flow === 'login' ? req.session.pendingLogin : req.session.pendingReset;
  if (!pending) return res.redirect('/auth/login');
  res.render('auth/otp', { title: 'Verifikasi OTP', flow, email: pending.email });
}

async function register(req, res) {
  validationOrThrow(req);
  if (!verifyCaptchaOrRedirect(req, res, '/auth/register')) return;
  const { name, email, password } = req.body;
  const normalized = email.toLowerCase();
  let user = await User.findOne({ email: normalized }).select('+passwordHash');
  if (user && user.status !== 'pending') throw new AppError('Email sudah digunakan.', 409, 'EMAIL_EXISTS');
  const passwordHash = await bcrypt.hash(password, 12);
  if (!user) user = await User.create({ name, email: normalized, passwordHash, status: 'pending' });
  else { user.name = name; user.passwordHash = passwordHash; await user.save(); }
  await issueOtp({ user, email: normalized, purpose: 'register' });
  req.session.pendingRegister = { userId: String(user._id), email: normalized };
  req.flash('success', 'OTP verifikasi telah dikirim ke email Anda.');
  res.redirect('/auth/otp/register');
}

async function login(req, res) {
  validationOrThrow(req);
  if (!verifyCaptchaOrRedirect(req, res, '/auth/login')) return;
  const email = req.body.email.toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');
  const invalid = () => { throw new AppError('Email atau password salah.', 401, 'INVALID_CREDENTIALS'); };
  if (!user || !user.passwordHash || user.status === 'pending') return invalid();
  if (user.status === 'blocked') throw new AppError('Akun tidak dapat digunakan.', 403, 'ACCOUNT_BLOCKED');
  if (user.lockUntil && user.lockUntil > new Date()) throw new AppError('Login dikunci sementara. Coba lagi nanti.', 429, 'LOGIN_LOCKED');
  const valid = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!valid) {
    user.loginFailures += 1;
    if (user.loginFailures >= 5) { user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); user.loginFailures = 0; }
    await user.save();
    return invalid();
  }
  user.loginFailures = 0; user.lockUntil = undefined; await user.save();
  await issueOtp({ user, email, purpose: 'login' });
  req.session.pendingLogin = { userId: String(user._id), email };
  req.flash('success', 'OTP login telah dikirim.');
  res.redirect('/auth/otp/login');
}

async function establishLogin(req, user) {
  const returnTo = safeReturnTo(req.session.returnTo, '/account');
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenError) => {
      if (regenError) return reject(regenError);
      req.session.userId = String(user._id);
      req.session.authVersion = user.sessionVersion;
      req.session.save((saveError) => saveError ? reject(saveError) : resolve(returnTo));
    });
  });
}

async function verifyOtpFlow(req, res) {
  const flow = req.params.flow;
  if (!['register', 'login', 'reset'].includes(flow)) throw new AppError('Alur OTP tidak valid.', 400);
  const key = flow === 'register' ? 'pendingRegister' : flow === 'login' ? 'pendingLogin' : 'pendingReset';
  const pending = req.session[key];
  if (!pending) throw new AppError('Sesi OTP tidak ditemukan.', 400, 'OTP_SESSION_MISSING');
  const purpose = flow === 'reset' ? 'password_reset' : flow;
  await verifyOtp({ email: pending.email, purpose, code: req.body.code, userId: pending.userId });
  const user = await User.findById(pending.userId);
  if (!user) throw new AppError('Akun tidak ditemukan.', 404);
  delete req.session[key];
  if (flow === 'register') {
    user.status = 'active'; user.emailVerifiedAt = new Date(); await user.save();
    await emailService.sendSimple(user.email, 'Registrasi berhasil', { name: user.name, message: `Akun ${env.smtp.fromName} Anda sudah aktif.` }, 'register_success');
    req.flash('success', 'Akun berhasil diverifikasi. Silakan login.');
    return res.redirect('/auth/login');
  }
  if (flow === 'reset') {
    req.session.resetAuthorized = { userId: String(user._id), expiresAt: Date.now() + 10 * 60 * 1000 };
    return res.redirect('/auth/reset-password');
  }
  const client = getClientInfo(req);
  user.lastLoginAt = new Date(); user.lastLoginIp = client.ip; await user.save();
  const target = await establishLogin(req, user);
  await emailService.sendLoginNotice(user.email, { name: user.name, ...client, time: new Date() });
  res.redirect(target);
}

async function resendOtp(req, res) {
  const flow = req.params.flow;
  const key = flow === 'register' ? 'pendingRegister' : flow === 'login' ? 'pendingLogin' : 'pendingReset';
  const pending = req.session[key];
  if (!pending) throw new AppError('Sesi OTP tidak ditemukan.', 400);
  const user = await User.findById(pending.userId);
  await issueOtp({ user, email: pending.email, purpose: flow === 'reset' ? 'password_reset' : flow });
  req.flash('success', 'OTP baru telah dikirim.');
  res.redirect(`/auth/otp/${flow}`);
}

function renderForgot(req, res) { res.render('auth/forgot-password', { title: 'Lupa password', captchaId: createCaptchaId() }); }
async function forgot(req, res) {
  validationOrThrow(req);
  if (!verifyCaptchaOrRedirect(req, res, '/auth/forgot-password')) return;
  const email = req.body.email.toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');
  let resetStarted = false;
  if (user && user.status === 'active') {
    try {
      await issueOtp({ user, email, purpose: 'password_reset' });
      req.session.pendingReset = { userId: String(user._id), email };
      resetStarted = true;
    } catch (error) {
      if (error.code !== 'EMAIL_SEND_FAILED') throw error;
    }
  }
  req.flash('success', 'Jika email terdaftar, instruksi reset telah dikirim.');
  res.redirect(resetStarted ? '/auth/otp/reset' : '/auth/forgot-password');
}
function renderReset(req, res) {
  const auth = req.session.resetAuthorized;
  if (!auth || auth.expiresAt < Date.now()) return res.redirect('/auth/forgot-password');
  res.render('auth/reset-password', { title: 'Reset password' });
}
async function resetPassword(req, res) {
  validationOrThrow(req);
  const auth = req.session.resetAuthorized;
  if (!auth || auth.expiresAt < Date.now()) throw new AppError('Sesi reset password kedaluwarsa.', 400);
  const user = await User.findById(auth.userId).select('+passwordHash');
  if (!user) throw new AppError('Akun tidak ditemukan.', 404);
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.sessionVersion += 1;
  await user.save();
  delete req.session.resetAuthorized;
  await emailService.sendSimple(user.email, 'Password berhasil diubah', { name: user.name, message: 'Password akun Anda berhasil diubah. Seluruh sesi lama telah dinonaktifkan.' }, 'password_changed');
  req.flash('success', 'Password berhasil diubah. Silakan login kembali.');
  res.redirect('/auth/login');
}
async function captchaImage(req, res) { await renderCaptchaSvg(req, res); }
function logout(req, res) { req.session.destroy(() => res.redirect('/')); }
module.exports = { captchaImage, renderRegister, renderLogin, renderOtp, register, login, verifyOtpFlow, resendOtp, renderForgot, forgot, renderReset, resetPassword, logout, establishLogin };
