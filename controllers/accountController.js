const bcrypt = require('bcryptjs');
const Order = require('../models/Order');
const User = require('../models/User');
const { AppError } = require('../utils/errors');
const { normalizePhone, normalizeBio, validateAvatarData } = require('../services/profileService');

async function dashboard(req, res) {
  const [aggregateResult, latestOrders] = await Promise.all([
    Order.aggregate([
      { $match: { user: req.user._id } },
      {
        $facet: {
          overview: [{
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              paidOrders: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
              pendingOrders: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] } },
              totalSpent: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0] } }
            }
          }],
          products: [
            { $match: { paymentStatus: 'paid', accessGranted: true } },
            { $unwind: '$items' },
            { $group: { _id: null, purchasedProducts: { $sum: '$items.quantity' } } }
          ]
        }
      }
    ]),
    Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5).lean()
  ]);

  const overview = aggregateResult[0]?.overview?.[0] || {};
  const products = aggregateResult[0]?.products?.[0] || {};
  const stats = {
    totalOrders: overview.totalOrders || 0,
    paidOrders: overview.paidOrders || 0,
    pendingOrders: overview.pendingOrders || 0,
    totalSpent: overview.totalSpent || 0,
    purchasedProducts: products.purchasedProducts || 0
  };

  res.render('account/dashboard', { title: 'Akun saya', stats, latestOrders });
}

async function profile(req, res) {
  res.render('account/profile', { title: 'Profil dan keamanan' });
}

async function updateProfile(req, res) {
  const name = String(req.body.name || '').trim();
  if (name.length < 2 || name.length > 80) throw new AppError('Nama harus 2-80 karakter.', 400);

  req.user.name = name;
  req.user.phone = normalizePhone(req.body.phone);
  req.user.bio = normalizeBio(req.body.bio);
  req.user.notificationPreferences = {
    orderUpdates: req.body.orderUpdates === 'on',
    productNews: req.body.productNews === 'on'
  };

  if (req.body.removeAvatar === '1') {
    req.user.avatar = undefined;
    req.user.avatarUpdatedAt = new Date();
  } else if (req.body.avatarData) {
    req.user.avatar = validateAvatarData(req.body.avatarData);
    req.user.avatarUpdatedAt = new Date();
  }

  await req.user.save();
  req.flash('success', 'Profil dan preferensi berhasil diperbarui.');
  res.redirect('/account/profile');
}

async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user.passwordHash) throw new AppError('Password belum tersedia. Gunakan menu lupa password untuk membuat password baru.', 400);
  if (!await bcrypt.compare(req.body.currentPassword || '', user.passwordHash)) throw new AppError('Password saat ini salah.', 400);
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(req.body.newPassword || '')) throw new AppError('Password baru minimal 8 karakter dan harus memiliki huruf besar, kecil, dan angka.', 400);
  if (req.body.newPassword !== req.body.confirmPassword) throw new AppError('Konfirmasi password tidak cocok.', 400);

  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  user.sessionVersion += 1;
  await user.save();
  req.session.destroy(() => res.redirect('/auth/login'));
}

async function logoutAll(req, res) {
  req.user.sessionVersion += 1;
  await req.user.save();
  req.session.destroy(() => res.redirect('/auth/login'));
}

module.exports = { dashboard, profile, updateProfile, changePassword, logoutAll };
