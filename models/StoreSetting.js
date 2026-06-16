const mongoose = require('mongoose');
const feeSchema = new mongoose.Schema({
  method: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['fixed', 'percentage_plus_fixed', 'tiered_qris'], required: true },
  fixed: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  highPercentage: { type: Number, default: 0 },
  highThreshold: { type: Number, default: 105000 },
  active: { type: Boolean, default: true }
}, { _id: false });
const schema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'store', index: true },
  storeName: { type: String, default: 'Zyphra Store' },
  feeSplitThreshold: { type: Number, default: 50000 },
  paymentFees: [feeSchema]
}, { timestamps: true });
module.exports = mongoose.model('StoreSetting', schema);
