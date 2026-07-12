require('dotenv').config();

const { requestOtp } = require('../services/otpService');
const mongoose = require('mongoose');

async function main() {
  const phone = process.argv[2];
  if (!phone) {
    throw new Error('Cách dùng: node scripts/testTwilioOtp.js 09xxxxxxxx');
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('Thiếu MONGODB_URI trong backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const result = await requestOtp(phone, { purpose: 'password_reset' });
  console.log('Đã gửi OTP:', {
    phone: result.maskedPhone,
    provider: result.provider,
    devCode: result.devCode
  });
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Gửi OTP thất bại:', {
    message: error.message,
    code: error.code,
    status: error.status || error.statusCode
  });
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
