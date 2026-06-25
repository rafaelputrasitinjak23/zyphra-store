const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
  discount: { type: mongoose.Schema.Types.ObjectId, ref: 'DiscountCode', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  usageSlot: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['reserved', 'committed', 'released'], default: 'reserved', index: true },
  active: { type: Boolean, default: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  committedAt: Date,
  releasedAt: Date
}, { timestamps: true });

schema.index({ discount: 1, user: 1, usageSlot: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ status: 1, expiresAt: 1 });
module.exports = mongoose.model('DiscountReservation', schema);
