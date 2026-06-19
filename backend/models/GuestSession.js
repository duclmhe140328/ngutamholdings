const mongoose = require('mongoose');

const guestSessionSchema = new mongoose.Schema(
  {
    diningSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningSession', required: true, index: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningTable', required: true, index: true },
    guestIdHash: { type: String, required: true },
    phone: { type: String, default: '', trim: true, index: true },
    phoneVerified: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'closed'], default: 'active', index: true },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

guestSessionSchema.index({ diningSessionId: 1, guestIdHash: 1 }, { unique: true });
guestSessionSchema.index({ diningSessionId: 1, phone: 1, phoneVerified: 1 });

module.exports = mongoose.model('GuestSession', guestSessionSchema);
