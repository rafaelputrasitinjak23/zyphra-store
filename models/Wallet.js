const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  balance: { type: Number, min: 0, default: 0 },
  heldBalance: { type: Number, min: 0, default: 0 },
  totalDeposited: { type: Number, min: 0, default: 0 },
  totalSpent: { type: Number, min: 0, default: 0 },
  totalRewards: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['active', 'locked'], default: 'active', index: true },
  version: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

schema.virtual('totalBalance').get(function totalBalance() {
  return Number(this.balance || 0) + Number(this.heldBalance || 0);
});

module.exports = mongoose.model('Wallet', schema);
