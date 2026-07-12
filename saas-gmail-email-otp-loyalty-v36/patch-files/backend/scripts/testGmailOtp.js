require('dotenv').config();

const mongoose = require('mongoose');
const { requestEmailOtp, verifyGmailConnection } = require('../services/emailOtpService');

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  const purpose = String(process.argv[3] || 'password_reset').trim();
  const phone = String(process.argv[4] || '').trim();

  if (!email) {
    throw new Error('Cách dùng: node scripts/testGmailOtp.js ten@gmail.com [password_reset|loyalty] [09xxxxxxxx]');
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('Thiếu MONGODB_URI trong backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  if (String(process.env.OTP_DEV_MODE || '').toLowerCase() !== 'true') {
    const connection = await verifyGmailConnection();
    console.log('Kết nối Gmail SMTP thành công:', connection.user);
  }

  const result = await requestEmailOtp({ email, purpose, phone });
  console.log('Đã gửi OTP:', {
    email: result.maskedEmail,
    phone: result.phone || undefined,
    purpose: result.purpose,
    provider: result.provider,
    messageId: result.messageId || undefined,
    devCode: result.devCode
  });

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Gửi OTP thất bại:', {
    message: error.message,
    code: error.code,
    responseCode: error.responseCode,
    command: error.command,
    status: error.status || error.statusCode
  });
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
