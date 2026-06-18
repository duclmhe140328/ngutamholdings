const mongoose = require('mongoose');

const diningTableSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    tableNumber: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    qrToken: { type: String, required: true, unique: true, index: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

diningTableSchema.index({ shopId: 1, tableNumber: 1 }, { unique: true });

module.exports = mongoose.model('DiningTable', diningTableSchema);
