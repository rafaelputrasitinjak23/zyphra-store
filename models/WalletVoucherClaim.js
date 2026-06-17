const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  voucher: { type: mongoose.Schema.Types.ObjectId, ref: 'DiscountCode', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  claimNumber: { type: String, required: true, unique: true, index: true },
  walletTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', required: true }
}, { timestamps: true });

schema.index({ voucher: 1, user: 1, createdAt: -1 });

module.exports = mongoose.model('WalletVoucherClaim', schema);
