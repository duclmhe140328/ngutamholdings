const mongoose = require('mongoose');

const platformCoinAccountSchema = new mongoose.Schema({
  phone: { type: String, required: true, trim: true, index: true },
  phoneVerified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  coinBalance: { type: Number, default: 0, min: 0 },
  totalEarned: { type: Number, default: 0, min: 0 },
  totalSpent: { type: Number, default: 0, min: 0 },
  lastSpinDate: { type: String, default: '' }
}, { timestamps: true });

platformCoinAccountSchema.index({ phone: 1 }, { unique: true });
module.exports = mongoose.model('PlatformCoinAccount', platformCoinAccountSchema);
