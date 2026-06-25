const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true, index: true, maxlength: 120 },
  entityType: { type: String, required: true, index: true, maxlength: 80 },
  entityId: { type: String, required: true, index: true, maxlength: 160 },
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  metadata: mongoose.Schema.Types.Mixed,
  requestId: { type: String, index: true },
  ip: String,
  userAgent: String
}, { timestamps: true });

schema.index({ createdAt: -1 });
module.exports = mongoose.model('AuditLog', schema);
