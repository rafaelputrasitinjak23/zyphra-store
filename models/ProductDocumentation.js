const mongoose = require('mongoose');

const docSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true, index: true },
  quickStart: { type: String, trim: true, maxlength: 20000, default: '' },
  requirements: { type: String, trim: true, maxlength: 10000, default: '' },
  installation: { type: String, trim: true, maxlength: 20000, default: '' },
  configuration: { type: String, trim: true, maxlength: 20000, default: '' },
  usage: { type: String, trim: true, maxlength: 20000, default: '' },
  faq: [{
    question: { type: String, trim: true, maxlength: 200 },
    answer: { type: String, trim: true, maxlength: 2000 }
  }],
  published: { type: Boolean, default: true, index: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ProductDocumentation', docSchema);
