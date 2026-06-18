const mongoose = require('mongoose');

const customerVoucherSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
  phone: { type: String, required: true, index: true },
  code: { type: String, required: true, uppercase: true, unique: true, index: true },
  usedAt: { type: Date, default: null },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('CustomerVoucher', customerVoucherSchema);
