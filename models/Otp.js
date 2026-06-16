const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  email: { type: String, required: true, lowercase: true, index: true },
  purpose: { type: String, enum: ['register', 'login', 'password_reset'], required: true, index: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  consumedAt: Date,
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });
schema.index({ email: 1, purpose: 1, consumedAt: 1 });
module.exports = mongoose.model('Otp', schema);
