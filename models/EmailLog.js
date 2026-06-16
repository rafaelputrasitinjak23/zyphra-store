const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  to: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  template: String,
  status: { type: String, enum: ['sent', 'failed'], required: true, index: true },
  error: String,
  metadata: mongoose.Schema.Types.Mixed,
  retryType: { type: String, enum: ['invoice', 'simple'], select: false },
  retryPayload: { type: mongoose.Schema.Types.Mixed, select: false },
  retryCount: { type: Number, default: 0 },
  lastRetryAt: Date,
  sentAt: Date
}, { timestamps: true });
module.exports = mongoose.model('EmailLog', schema);
