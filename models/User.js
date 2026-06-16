const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  passwordHash: { type: String, select: false },
  avatar: { type: String, trim: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  status: { type: String, enum: ['pending', 'active', 'blocked'], default: 'pending', index: true },
  emailVerifiedAt: Date,
  providers: [{
    provider: { type: String, enum: ['google', 'github'], required: true },
    providerId: { type: String, required: true },
    linkedAt: { type: Date, default: Date.now }
  }],
  sessionVersion: { type: Number, default: 0 },
  lastLoginAt: Date,
  lastLoginIp: String,
  loginFailures: { type: Number, default: 0 },
  lockUntil: Date
}, { timestamps: true });
userSchema.index({ 'providers.provider': 1, 'providers.providerId': 1 }, { unique: true, sparse: true });
userSchema.methods.toSafeObject = function () {
  return { id: this._id, name: this.name, email: this.email, avatar: this.avatar, role: this.role, status: this.status, providers: this.providers, createdAt: this.createdAt };
};
module.exports = mongoose.model('User', userSchema);
