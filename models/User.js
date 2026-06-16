const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  passwordHash: { type: String, select: false },
  avatar: { type: String, trim: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  status: { type: String, enum: ['pending', 'active', 'blocked'], default: 'pending', index: true },
  emailVerifiedAt: Date,
  sessionVersion: { type: Number, default: 0 },
  lastLoginAt: Date,
  lastLoginIp: String,
  loginFailures: { type: Number, default: 0 },
  lockUntil: Date
}, { timestamps: true });

userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    role: this.role,
    status: this.status,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);
