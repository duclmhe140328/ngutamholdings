const mongoose = require('mongoose');

const phoneOtpSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  purpose: {
    type: String,
    enum: ['loyalty', 'password_reset'],
    default: 'loyalty',
    index: true
  },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

phoneOtpSchema.index({ phone: 1, purpose: 1, createdAt: -1 });

module.exports = mongoose.model('PhoneOtp', phoneOtpSchema);
