const mongoose = require('mongoose');

const loyaltyEmailBindingSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, trim: true, index: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  verifiedAt: { type: Date, default: Date.now },
  lastVerifiedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.LoyaltyEmailBinding || mongoose.model('LoyaltyEmailBinding', loyaltyEmailBindingSchema);
