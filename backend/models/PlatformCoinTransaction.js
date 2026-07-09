const mongoose = require('mongoose');

const platformCoinTransactionSchema = new mongoose.Schema({
  phone: { type: String, required: true, trim: true, index: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformCoinAccount', required: true, index: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformCoupon', default: null, index: true },
  type: { type: String, enum: ['spin', 'spend_order', 'refund', 'adjust'], required: true },
  coins: { type: Number, required: true },
  note: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  uniqueKey: { type: String, default: '', trim: true }
}, { timestamps: true });

platformCoinTransactionSchema.index({ uniqueKey: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('PlatformCoinTransaction', platformCoinTransactionSchema);
