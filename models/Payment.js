const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
  provider: { type: String, default: 'pakasir' },
  providerTransactionId: { type: String, unique: true, index: true, sparse: true },
  method: String,
  amount: Number,
  fee: Number,
  totalPayment: Number,
  status: { type: String, default: 'pending', index: true },
  paymentNumber: String,
  expiresAt: Date,
  createRequest: mongoose.Schema.Types.Mixed,
  createResponse: mongoose.Schema.Types.Mixed,
  lastCheckResponse: mongoose.Schema.Types.Mixed,
  lastCheckedAt: Date,
  cancelResponse: mongoose.Schema.Types.Mixed,
  cancelledAt: Date
}, { timestamps: true });
module.exports = mongoose.model('Payment', schema);
