const mongoose = require('mongoose');

const platformCouponSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  discountType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
  discountValue: { type: Number, required: true, min: 0 },
  maxDiscount: { type: Number, default: 0, min: 0 },
  minOrder: { type: Number, default: 0, min: 0 },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  usageLimit: { type: Number, default: 0, min: 0 },
  perPhoneLimit: { type: Number, default: 1, min: 0 },
  usedCount: { type: Number, default: 0, min: 0 },
  appliesToAll: { type: Boolean, default: true },
  shopIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

platformCouponSchema.index({ code: 1 }, { unique: true });
module.exports = mongoose.model('PlatformCoupon', platformCouponSchema);
