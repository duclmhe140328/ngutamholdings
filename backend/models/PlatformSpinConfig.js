const mongoose = require('mongoose');

const spinRewardSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  type: { type: String, enum: ['coins', 'coupon', 'none'], default: 'coins' },
  value: { type: Number, default: 0, min: 0 },
  couponCode: { type: String, default: '', trim: true, uppercase: true },
  weight: { type: Number, default: 1, min: 0 },
  isActive: { type: Boolean, default: true }
}, { _id: false });

const platformSpinConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true, index: true },
  enabled: { type: Boolean, default: true },
  title: { type: String, default: 'Vòng quay nhận xu toàn hệ thống' },
  description: { type: String, default: 'Xu có thể dùng tại các shop bật tích xu.' },
  oncePerDay: { type: Boolean, default: true },
  rewards: {
    type: [spinRewardSchema],
    default: () => [10, 20, 50, 100, 200, 500, 1000, 0].map((value) => ({
      label: value ? `${value} xu` : 'Chúc may mắn',
      type: value ? 'coins' : 'none',
      value,
      weight: 1,
      isActive: true
    }))
  }
}, { timestamps: true });

module.exports = mongoose.model('PlatformSpinConfig', platformSpinConfigSchema);
