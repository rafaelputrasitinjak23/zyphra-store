const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['user', 'admin'], required: true },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  attachments: [{ name: String, url: String }]
}, { timestamps: true });

const ticketSchema = new mongoose.Schema({
  ticketNumber: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, enum: ['produk', 'pembayaran', 'akun', 'instalasi', 'lainnya'], default: 'produk', index: true },
  priority: { type: String, enum: ['normal', 'tinggi'], default: 'normal', index: true },
  status: { type: String, enum: ['open', 'answered', 'closed'], default: 'open', index: true },
  messages: [messageSchema],
  latestMessageAt: { type: Date, default: Date.now, index: true },
  closedAt: Date
}, { timestamps: true });

ticketSchema.index({ user: 1, latestMessageAt: -1 });
ticketSchema.index({ status: 1, latestMessageAt: -1 });

module.exports = mongoose.model('SupportTicket', ticketSchema);
