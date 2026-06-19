const mongoose = require('mongoose');

const sepayTransactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null, index: true },
    gateway: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    transferType: { type: String, default: '' },
    transferAmount: { type: Number, default: 0 },
    transactionDate: { type: Date, default: null },
    content: { type: String, default: '' },
    code: { type: String, default: '' },
    referenceCode: { type: String, default: '' },
    matched: { type: Boolean, default: false },
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SepayTransaction', sepayTransactionSchema);
