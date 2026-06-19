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

const supportProviderSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  title: { type: String, trim: true, maxlength: 80, default: '' },
  description: { type: String, trim: true, maxlength: 220, default: '' },
  label: { type: String, trim: true, maxlength: 60, default: '' },
  url: { type: String, trim: true, maxlength: 500, default: '' }
}, { _id: false });

const schema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'store', index: true },
  storeName: { type: String, default: 'Zyphra Store' },
  feeSplitThreshold: { type: Number, default: 50000 },
  paymentFees: [feeSchema],
  wallet: {
    enabled: { type: Boolean, default: true },
    minDeposit: { type: Number, min: 1000, default: 10000 },
    maxDeposit: { type: Number, min: 1000, default: 5000000 }
  },
  supportPopup: {
    enabled: { type: Boolean, default: true },
    showOnHomeOnly: { type: Boolean, default: true },
    showOncePerSession: { type: Boolean, default: true },
    title: { type: String, trim: true, maxlength: 120, default: 'Terima kasih kepada support kami' },
    description: { type: String, trim: true, maxlength: 400, default: 'Website ini dapat berjalan dan menerima pembayaran dengan dukungan layanan dari Vercel dan Pakasir.' },
    primaryNote: { type: String, trim: true, maxlength: 160, default: 'Partner yang membantu Zyphra Store tetap berjalan.' },
    vercel: { type: supportProviderSchema, default: () => ({ enabled: true, title: 'Vercel', description: 'Platform deployment yang membantu Zyphra Store berjalan cepat, stabil, dan mudah diakses.', label: 'Kunjungi Vercel', url: 'https://vercel.com' }) },
    pakasir: { type: supportProviderSchema, default: () => ({ enabled: true, title: 'Pakasir', description: 'Layanan pembayaran yang membantu proses transaksi digital menjadi lebih praktis.', label: 'Kunjungi Pakasir', url: 'https://pakasir.com' }) }
  }
}, { timestamps: true });
module.exports = mongoose.model('StoreSetting', schema);
