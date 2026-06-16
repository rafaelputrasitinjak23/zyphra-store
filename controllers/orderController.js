const Order = require('../models/Order');
const { AppError } = require('../utils/errors');
async function list(req, res) { const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }); res.render('orders/list', { title: 'Riwayat pesanan', orders }); }
async function detail(req, res) { const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id }).select('+paymentQrDataUrl'); if (!order) throw new AppError('Pesanan tidak ditemukan.', 404); res.render('orders/detail', { title: order.orderNumber, order }); }
async function invoice(req, res) { const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id }); if (!order) throw new AppError('Invoice tidak ditemukan.', 404); res.render('orders/invoice', { layout: false, title: order.invoiceNumber, order }); }
async function purchases(req, res) { const orders = await Order.find({ user: req.user._id, paymentStatus: 'paid', accessGranted: true }).sort({ paidAt: -1 }); res.render('account/purchases', { title: 'Produk saya', orders }); }
module.exports = { list, detail, invoice, purchases };
