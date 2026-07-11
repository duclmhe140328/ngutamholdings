const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['seller', 'admin'],
      default: 'seller'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // Không giới hạn một thiết bị. Chỉ tăng tokenVersion khi đổi/quên mật khẩu
    // để vô hiệu hóa các token cũ sau thao tác bảo mật.
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0
    },
    passwordChangedAt: {
      type: Date,
      default: null
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
