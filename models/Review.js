const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  comment: { type: String, trim: true, maxlength: 1200, default: '' },
  verifiedPurchase: { type: Boolean, default: true },
  status: { type: String, enum: ['published', 'hidden'], default: 'published', index: true },
  moderatedAt: { type: Date, default: null },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

schema.index({ product: 1, user: 1 }, { unique: true });
schema.index({ product: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Review', schema);
