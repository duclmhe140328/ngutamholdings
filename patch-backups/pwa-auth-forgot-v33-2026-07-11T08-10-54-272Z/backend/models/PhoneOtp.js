const mongoose = require('mongoose');

const phoneOtpSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

module.exports = mongoose.model('PhoneOtp', phoneOtpSchema);
