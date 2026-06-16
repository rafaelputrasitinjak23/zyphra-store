const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  ip: String,
  userAgent: String,
  success: { type: Boolean, default: true },
  reason: String
}, { timestamps: true });
module.exports = mongoose.model('DownloadLog', schema);
