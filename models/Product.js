const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 150 },
  slug: { type: String, required: true, unique: true, index: true },
  shortDescription: { type: String, required: true, maxlength: 300 },
  description: { type: String, required: true, maxlength: 20000 },
  price: { type: Number, required: true, min: 0 },
  promoPrice: { type: Number, min: 0, default: null },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  thumbnail: { type: String, required: true },
  gallery: [{ type: String }],
  unlimitedStock: { type: Boolean, default: true },
  stock: { type: Number, min: 0, default: 0 },
  allowMultipleQuantity: { type: Boolean, default: false },
  version: { type: String, default: '1.0.0' },
  changelog: { type: String, default: '' },
  tags: [{ type: String, trim: true }],
  active: { type: Boolean, default: true, index: true },
  featured: { type: Boolean, default: false, index: true },
  digitalFileUrl: { type: String, required: true, select: false },
  fileName: { type: String, default: '' },
  instructions: { type: String, default: '' },
  downloadLimit: { type: Number, min: 1, default: 5 },
  viewCount: { type: Number, min: 0, default: 0, index: true },
  soldCount: { type: Number, min: 0, default: 0, index: true }
}, { timestamps: true });
schema.virtual('effectivePrice').get(function () { return this.promoPrice !== null && this.promoPrice < this.price ? this.promoPrice : this.price; });
schema.set('toJSON', { virtuals: true, transform(doc, ret) { delete ret.digitalFileUrl; return ret; } });
module.exports = mongoose.model('Product', schema);
