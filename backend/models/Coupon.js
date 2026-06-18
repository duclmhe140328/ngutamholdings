const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  discountType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
  discountValue: { type: Number, required: true, min: 0 },
  maxDiscount: { type: Number, default: 0, min: 0 },
  minOrder: { type: Number, default: 0, min: 0 },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  usageLimit: { type: Number, default: 0, min: 0 },
  perPhoneLimit: { type: Number, default: 1, min: 1 },
  usedCount: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
  exchangeable: { type: Boolean, default: false },
  coinCost: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

couponSchema.index({ shopId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Coupon', couponSchema);
