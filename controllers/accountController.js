const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { AppError } = require('../utils/errors');
async function dashboard(req, res) { res.render('account/dashboard', { title: 'Akun saya' }); }
async function profile(req, res) { const user = await User.findById(req.user._id).select('+passwordHash'); res.render('account/profile', { title: 'Profil', hasPassword: Boolean(user?.passwordHash) }); }
async function updateProfile(req, res) { const name = String(req.body.name || '').trim(); if (name.length < 2 || name.length > 80) throw new AppError('Nama harus 2-80 karakter.', 400); req.user.name = name; await req.user.save(); req.flash('success', 'Profil diperbarui.'); res.redirect('/account/profile'); }
async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user.passwordHash) throw new AppError('Akun OAuth belum memiliki password manual.', 400);
  if (!await bcrypt.compare(req.body.currentPassword || '', user.passwordHash)) throw new AppError('Password saat ini salah.', 400);
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(req.body.newPassword || '')) throw new AppError('Password baru minimal 8 karakter dan harus memiliki huruf besar, kecil, dan angka.', 400);
  if (req.body.newPassword !== req.body.confirmPassword) throw new AppError('Konfirmasi password tidak cocok.', 400);
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12); user.sessionVersion += 1; await user.save();
  req.logout(() => req.session.destroy(() => res.redirect('/auth/login')));
}
async function logoutAll(req, res) { req.user.sessionVersion += 1; await req.user.save(); req.logout(() => req.session.destroy(() => res.redirect('/auth/login'))); }
module.exports = { dashboard, profile, updateProfile, changePassword, logoutAll };
