const Notification = require('../models/Notification');
const User = require('../models/User');

async function notifyUser(userId, payload = {}) {
  if (!userId) return null;
  return Notification.create({
    user: userId,
    type: payload.type || 'system',
    title: payload.title || 'Notifikasi baru',
    message: payload.message || 'Ada pembaruan untuk Anda.',
    url: payload.url || '/',
    data: payload.data || {}
  });
}

async function notifyAdmins(payload = {}) {
  const admins = await User.find({ role: 'admin', status: { $ne: 'blocked' } }).select('_id');
  if (!admins.length) return [];
  return Notification.insertMany(admins.map(admin => ({
    user: admin._id,
    type: payload.type || 'system',
    title: payload.title || 'Aktivitas baru',
    message: payload.message || 'Ada aktivitas baru di toko.',
    url: payload.url || '/admin',
    data: payload.data || {}
  })));
}

module.exports = { notifyUser, notifyAdmins };
