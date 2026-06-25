const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  version: { type: Number, default: 0 }
}, { timestamps: true });
module.exports = mongoose.model('SystemState', schema);
