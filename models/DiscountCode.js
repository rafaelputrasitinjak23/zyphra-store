const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  code: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true, maxlength: 40 },
  kind: { type: String, enum: ['voucher', 'promo'], required: true, default: 'promo', index: true },
  benefitType: { type: String, enum: ['order_discount', 'wallet_credit'], default: 'order_discount', index: true },
  walletCreditAmount: { type: Number, min: 0, default: 0 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true, default: 'percentage' },
  value: { type: Number, required: true, min: 1 },
  maxDiscount: { type: Number, min: 0, default: 0 },
  minSubtotal: { type: Number, min: 0, default: 0 },
  scope: { type: String, enum: ['all', 'products'], required: true, default: 'all', index: true },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  usageLimit: { type: Number, min: 0, default: 0 },
  perUserLimit: { type: Number, min: 1, default: 1 },
  usedCount: { type: Number, min: 0, default: 0 },
  reservedCount: { type: Number, min: 0, default: 0 },
  startsAt: { type: Date, required: true, index: true },
  endsAt: { type: Date, required: true, index: true },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

schema.pre('validate', function normalize(next) {
  this.code = String(this.code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (this.benefitType === 'wallet_credit') {
    this.kind = 'voucher';
    this.scope = 'all';
    this.products = [];
    this.discountType = 'fixed';
    this.value = Math.max(1, Number(this.walletCreditAmount || this.value || 1));
    this.maxDiscount = 0;
    this.minSubtotal = 0;
  }
  if (this.scope === 'all') this.products = [];
  next();
});

module.exports = mongoose.model('DiscountCode', schema);
