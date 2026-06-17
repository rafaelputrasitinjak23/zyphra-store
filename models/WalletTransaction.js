const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  transactionNumber: { type: String, required: true, unique: true, index: true },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  type: {
    type: String,
    enum: ['deposit', 'purchase', 'reward', 'refund', 'adjustment', 'release'],
    required: true,
    index: true
  },
  direction: { type: String, enum: ['credit', 'debit'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'reversed'], default: 'completed', index: true },
  amount: { type: Number, required: true, min: 1 },
  balanceBefore: { type: Number, required: true, min: 0 },
  balanceAfter: { type: Number, required: true, min: 0 },
  referenceType: { type: String, enum: ['deposit', 'order', 'voucher', 'admin', 'system'], required: true },
  referenceId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 300, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  completedAt: Date,
  reversedAt: Date
}, { timestamps: true });

schema.index({ user: 1, createdAt: -1 });
schema.index({ referenceType: 1, referenceId: 1 });

module.exports = mongoose.model('WalletTransaction', schema);
