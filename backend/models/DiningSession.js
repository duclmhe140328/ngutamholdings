const mongoose = require('mongoose');

const paymentEntrySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['cash', 'bank_transfer', 'vnpay', 'other'], default: 'cash' },
    paidAt: { type: Date, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: '' }
  },
  { _id: true }
);

const diningSessionSchema = new mongoose.Schema(
  {
    sessionCode: { type: String, required: true, unique: true, index: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningTable', required: true, index: true },
    tableNumber: { type: Number, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
    openKey: { type: String, default: undefined },

    // Một phiên bàn = một hóa đơn tổng. Các lần gọi món chỉ tăng orderRound.
    activeBillNumber: { type: Number, default: 1, min: 1 },
    customerNames: { type: [String], default: [] },
    loyaltyPhone: { type: String, default: '', trim: true, index: true },
    skipLoyalty: { type: Boolean, default: false },

    payments: { type: [paymentEntrySchema], default: [] },
    paidAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid', 'refunded'], default: 'unpaid', index: true },
    paidAt: { type: Date, default: null },

    loyaltyRewardCoins: { type: Number, default: 0, min: 0 },
    loyaltyRewardedAt: { type: Date, default: null },

    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finalTotalAmount: { type: Number, default: 0, min: 0 },
    finalCustomerNames: { type: [String], default: [] },

    openedAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now, index: true },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closeReason: { type: String, default: '' }
  },
  { timestamps: true }
);

diningSessionSchema.index({ openKey: 1 }, { unique: true, sparse: true });
diningSessionSchema.index({ shopId: 1, tableId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('DiningSession', diningSessionSchema);
