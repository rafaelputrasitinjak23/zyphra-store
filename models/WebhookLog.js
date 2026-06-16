const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  eventKey: { type: String, required: true, unique: true, index: true },
  provider: { type: String, default: 'pakasir' },
  orderNumber: { type: String, index: true },
  headers: mongoose.Schema.Types.Mixed,
  payload: mongoose.Schema.Types.Mixed,
  verifiedResponse: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['received', 'processed', 'ignored', 'failed'], default: 'received', index: true },
  error: String,
  processedAt: Date
}, { timestamps: true });
module.exports = mongoose.model('WebhookLog', schema);
