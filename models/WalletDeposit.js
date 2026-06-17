const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  depositNumber: { type: String, required: true, unique: true, index: true },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  gatewayFee: { type: Number, min: 0, default: 0 },
  totalPayment: { type: Number, min: 1, required: true },
  paymentMethod: { type: String, required: true },
  providerTransactionId: { type: String, unique: true, sparse: true, index: true },
  paymentNumber: String,
  paymentQrDataUrl: { type: String, select: false },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'expired', 'cancelled'], default: 'pending', index: true },
  credited: { type: Boolean, default: false, index: true },
  expiresAt: Date,
  paidAt: Date,
  cancelledAt: Date,
  createRequest: mongoose.Schema.Types.Mixed,
  createResponse: mongoose.Schema.Types.Mixed,
  lastCheckResponse: mongoose.Schema.Types.Mixed,
  cancellationResponse: mongoose.Schema.Types.Mixed,
  notifications: {
    paidSent: { type: Boolean, default: false }
  }
}, { timestamps: true });

schema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('WalletDeposit', schema);
