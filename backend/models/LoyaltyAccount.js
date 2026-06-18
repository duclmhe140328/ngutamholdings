const mongoose = require('mongoose');

const loyaltyAccountSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  phone: { type: String, required: true, trim: true },
  phoneVerified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  coinBalance: { type: Number, default: 0, min: 0 },
  totalEarned: { type: Number, default: 0, min: 0 },
  totalSpent: { type: Number, default: 0, min: 0 },
  lastSpinDate: { type: String, default: '' }
}, { timestamps: true });

loyaltyAccountSchema.index({ shopId: 1, phone: 1 }, { unique: true });
module.exports = mongoose.model('LoyaltyAccount', loyaltyAccountSchema);
