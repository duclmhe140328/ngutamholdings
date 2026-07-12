const mongoose = require('mongoose');

const emailOtpSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true, trim: true, lowercase: true },
  phone: { type: String, default: '', index: true, trim: true },
  purpose: {
    type: String,
    enum: ['password_reset', 'loyalty'],
    required: true,
    index: true
  },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0, min: 0 },
  consumedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: true },
  purgeAt: { type: Date, required: true, expires: 0 },
  requestIp: { type: String, default: '', trim: true, index: true }
}, { timestamps: true });

emailOtpSchema.index({ email: 1, phone: 1, purpose: 1, createdAt: -1 });

module.exports = mongoose.models.EmailOtp || mongoose.model('EmailOtp', emailOtpSchema);
