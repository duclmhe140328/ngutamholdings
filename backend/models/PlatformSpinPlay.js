const mongoose = require('mongoose');

const platformSpinPlaySchema = new mongoose.Schema({
  phone: { type: String, required: true, trim: true, index: true },
  dateKey: { type: String, required: true, index: true },
  rewardIndex: { type: Number, default: 0 },
  reward: { type: mongoose.Schema.Types.Mixed, default: null },
  coins: { type: Number, default: 0 },
  couponCode: { type: String, default: '', trim: true, uppercase: true },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' }
}, { timestamps: true });

platformSpinPlaySchema.index({ phone: 1, dateKey: 1 }, { unique: true });
module.exports = mongoose.model('PlatformSpinPlay', platformSpinPlaySchema);
