const Notification = require('../models/Notification');
const { AppError } = require('../utils/errors');

async function list(req, res) {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = 20;
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments({ user: req.user._id }),
    Notification.countDocuments({ user: req.user._id, readAt: null })
  ]);
  res.render('notifications/index', {
    title: 'Notifikasi',
    notifications,
    unreadCount,
    pagination: { page, totalPages: Math.max(1, Math.ceil(total / limit)), total }
  });
}

async function markRead(req, res) {
  const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!notification) throw new AppError('Notifikasi tidak ditemukan.', 404, 'NOTIFICATION_NOT_FOUND');
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  res.redirect(notification.url || '/notifications');
}

async function markAll(req, res) {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  req.flash('success', 'Semua notifikasi ditandai sudah dibaca.');
  res.redirect('/notifications');
}

module.exports = { list, markRead, markAll };
