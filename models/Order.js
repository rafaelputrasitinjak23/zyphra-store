const mongoose = require('mongoose');
const itemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true },
  thumbnail: String,
  unitPrice: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  lineTotal: { type: Number, required: true },
  version: String,
  downloadLimit: { type: Number, default: 5 },
  downloadsUsed: { type: Number, default: 0 }
}, { _id: false });
const schema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  buyerSnapshot: { name: String, email: String },
  items: [itemSchema],
  subtotal: { type: Number, required: true, min: 0 },
  gatewayFee: { type: Number, required: true, min: 0 },
  userFee: { type: Number, required: true, min: 0 },
  merchantFee: { type: Number, required: true, min: 0 },
  merchantNet: { type: Number, required: true },
  total: { type: Number, required: true, min: 0 },
  pakasirAmount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, required: true },
  pakasirTransactionId: { type: String, unique: true, index: true, sparse: true },
  paymentNumber: String,
  paymentQrDataUrl: { type: String, select: false },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded'], default: 'pending', index: true },
  orderStatus: { type: String, enum: ['awaiting_payment', 'processing', 'fulfilled', 'cancelled', 'refund'], default: 'awaiting_payment', index: true },
  expiresAt: Date,
  paidAt: Date,
  lastWebhookData: mongoose.Schema.Types.Mixed,
  stockCommitted: { type: Boolean, default: false },
  accessGranted: { type: Boolean, default: false },
  notifications: {
    paidSent: { type: Boolean, default: false },
    expiredSent: { type: Boolean, default: false },
    invoiceSent: { type: Boolean, default: false }
  }
}, { timestamps: true });
module.exports = mongoose.model('Order', schema);
