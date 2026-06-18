const mongoose = require('mongoose');

const loyaltyTransactionSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoyaltyAccount', required: true, index: true },
  phone: { type: String, required: true, index: true },
  type: { type: String, enum: ['earn_order', 'spin', 'spend_order', 'exchange_voucher', 'refund', 'adjustment'], required: true },
  coins: { type: Number, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
  note: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  uniqueKey: { type: String, default: '', index: true }
}, { timestamps: true });

loyaltyTransactionSchema.index({ uniqueKey: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);
