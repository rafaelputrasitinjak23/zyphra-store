const SupportTicket = require('../models/SupportTicket');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { randomId } = require('../utils/helpers');
const { AppError } = require('../utils/errors');
const notificationService = require('../services/notificationService');

async function list(req, res) {
  const tickets = await SupportTicket.find({ user: req.user._id }).populate('product').sort({ latestMessageAt: -1 });
  res.render('support/index', { title: 'Bantuan', tickets });
}

async function newForm(req, res) {
  const [products, orders] = await Promise.all([
    Product.find({ active: true }).select('name slug thumbnail').sort({ name: 1 }).limit(100),
    Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30).select('orderNumber items paymentStatus')
  ]);
  res.render('support/new', { title: 'Buat Tiket Bantuan', products, orders, query: req.query });
}

async function create(req, res) {
  const subject = String(req.body.subject || '').trim();
  const body = String(req.body.message || '').trim();
  if (subject.length < 5 || subject.length > 160) throw new AppError('Judul tiket harus 5-160 karakter.', 400, 'INVALID_SUBJECT');
  if (body.length < 10 || body.length > 5000) throw new AppError('Pesan harus 10-5000 karakter.', 400, 'INVALID_MESSAGE');

  const ticket = await SupportTicket.create({
    ticketNumber: randomId('TKT-'),
    user: req.user._id,
    product: req.body.productId || null,
    category: req.body.category || 'produk',
    priority: req.body.priority === 'tinggi' ? 'tinggi' : 'normal',
    subject,
    messages: [{ sender: req.user._id, senderRole: 'user', body }],
    latestMessageAt: new Date()
  });

  await notificationService.notifyAdmins({
    type: 'support',
    title: 'Tiket bantuan baru',
    message: `${req.user.name} membuat tiket: ${subject}`,
    url: `/admin/support/${ticket.ticketNumber}`,
    data: { ticketNumber: ticket.ticketNumber }
  });

  req.flash('success', 'Tiket bantuan berhasil dibuat.');
  res.redirect(`/support/${ticket.ticketNumber}`);
}

async function detail(req, res) {
  const ticket = await SupportTicket.findOne({ ticketNumber: req.params.ticketNumber, user: req.user._id })
    .populate('product')
    .populate('user')
    .populate('messages.sender', 'name avatar email role');
  if (!ticket) throw new AppError('Tiket tidak ditemukan.', 404, 'TICKET_NOT_FOUND');
  res.render('support/detail', { title: ticket.subject, ticket, isAdminView: false });
}

async function reply(req, res) {
  const ticket = await SupportTicket.findOne({ ticketNumber: req.params.ticketNumber, user: req.user._id });
  if (!ticket) throw new AppError('Tiket tidak ditemukan.', 404, 'TICKET_NOT_FOUND');
  if (ticket.status === 'closed') throw new AppError('Tiket sudah ditutup.', 400, 'TICKET_CLOSED');

  const body = String(req.body.message || '').trim();
  if (body.length < 2 || body.length > 5000) throw new AppError('Pesan harus 2-5000 karakter.', 400, 'INVALID_MESSAGE');

  ticket.messages.push({ sender: req.user._id, senderRole: 'user', body });
  ticket.status = 'open';
  ticket.latestMessageAt = new Date();
  await ticket.save();

  await notificationService.notifyAdmins({
    type: 'support',
    title: 'Balasan tiket baru',
    message: `${req.user.name} membalas tiket ${ticket.ticketNumber}.`,
    url: `/admin/support/${ticket.ticketNumber}`,
    data: { ticketNumber: ticket.ticketNumber }
  });

  req.flash('success', 'Balasan berhasil dikirim.');
  res.redirect(`/support/${ticket.ticketNumber}`);
}

async function close(req, res) {
  const ticket = await SupportTicket.findOne({ ticketNumber: req.params.ticketNumber, user: req.user._id });
  if (!ticket) throw new AppError('Tiket tidak ditemukan.', 404, 'TICKET_NOT_FOUND');
  ticket.status = 'closed';
  ticket.closedAt = new Date();
  await ticket.save();
  req.flash('success', 'Tiket ditutup.');
  res.redirect('/support');
}

async function adminList(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const tickets = await SupportTicket.find(filter).populate('user').populate('product').sort({ latestMessageAt: -1 }).limit(100);
  res.render('admin/support/index', { title: 'Tiket Bantuan', tickets, filters: req.query });
}

async function adminDetail(req, res) {
  const ticket = await SupportTicket.findOne({ ticketNumber: req.params.ticketNumber })
    .populate('user')
    .populate('product')
    .populate('messages.sender', 'name avatar email role');
  if (!ticket) throw new AppError('Tiket tidak ditemukan.', 404, 'TICKET_NOT_FOUND');
  res.render('admin/support/detail', { title: ticket.subject, ticket, isAdminView: true });
}

async function adminReply(req, res) {
  const ticket = await SupportTicket.findOne({ ticketNumber: req.params.ticketNumber });
  if (!ticket) throw new AppError('Tiket tidak ditemukan.', 404, 'TICKET_NOT_FOUND');
  if (ticket.status === 'closed') throw new AppError('Tiket sudah ditutup.', 400, 'TICKET_CLOSED');

  const body = String(req.body.message || '').trim();
  if (body.length < 2 || body.length > 5000) throw new AppError('Pesan harus 2-5000 karakter.', 400, 'INVALID_MESSAGE');

  ticket.messages.push({ sender: req.user._id, senderRole: 'admin', body });
  ticket.status = 'answered';
  ticket.latestMessageAt = new Date();
  await ticket.save();

  await notificationService.notifyUser(ticket.user, {
    type: 'support',
    title: 'Tiket bantuan dibalas',
    message: `Admin membalas tiket ${ticket.ticketNumber}.`,
    url: `/support/${ticket.ticketNumber}`,
    data: { ticketNumber: ticket.ticketNumber }
  });

  req.flash('success', 'Balasan admin berhasil dikirim.');
  res.redirect(`/admin/support/${ticket.ticketNumber}`);
}

async function adminClose(req, res) {
  const ticket = await SupportTicket.findOne({ ticketNumber: req.params.ticketNumber });
  if (!ticket) throw new AppError('Tiket tidak ditemukan.', 404, 'TICKET_NOT_FOUND');
  ticket.status = 'closed';
  ticket.closedAt = new Date();
  await ticket.save();

  await notificationService.notifyUser(ticket.user, {
    type: 'support',
    title: 'Tiket bantuan ditutup',
    message: `Tiket ${ticket.ticketNumber} sudah ditutup.`,
    url: `/support/${ticket.ticketNumber}`,
    data: { ticketNumber: ticket.ticketNumber }
  });

  req.flash('success', 'Tiket berhasil ditutup.');
  res.redirect('/admin/support');
}

module.exports = { list, newForm, create, detail, reply, close, adminList, adminDetail, adminReply, adminClose };
