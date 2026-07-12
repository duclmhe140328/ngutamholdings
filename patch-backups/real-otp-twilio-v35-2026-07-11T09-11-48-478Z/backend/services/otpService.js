const crypto = require('crypto');
const axios = require('axios');
const PhoneOtp = require('../models/PhoneOtp');
const { normalizePhone } = require('../utils/phone');

const validPurposes = new Set(['loyalty', 'password_reset']);
const normalizePurpose = (value) => validPurposes.has(value) ? value : 'loyalty';

const hashCode = (phone, code, purpose) => crypto
  .createHash('sha256')
  .update(`${phone}:${purpose}:${code}:${process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || 'dev'}`)
  .digest('hex');

const maskPhone = (phone) => {
  const value = String(phone || '');
  if (value.length < 7) return value;
  return `${value.slice(0, 3)}****${value.slice(-3)}`;
};

const requestOtp = async (phoneRaw, options = {}) => {
  const phone = normalizePhone(phoneRaw);
  const purpose = normalizePurpose(options.purpose);
  if (!phone) throw Object.assign(new Error('Số điện thoại Việt Nam không hợp lệ'), { statusCode: 400 });

  const recent = await PhoneOtp.findOne({ phone, purpose }).sort({ createdAt: -1 });
  if (recent && Date.now() - recent.createdAt.getTime() < 60 * 1000) {
    throw Object.assign(new Error('Vui lòng chờ 60 giây trước khi gửi lại OTP'), { statusCode: 429 });
  }

  const devMode = String(process.env.OTP_DEV_MODE || '').toLowerCase() === 'true' || process.env.NODE_ENV !== 'production';
  const code = devMode && process.env.OTP_DEV_CODE
    ? String(process.env.OTP_DEV_CODE)
    : String(Math.floor(100000 + Math.random() * 900000));

  await PhoneOtp.deleteMany({ phone, purpose });
  await PhoneOtp.create({
    phone,
    purpose,
    codeHash: hashCode(phone, code, purpose),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  });

  const defaultMessage = purpose === 'password_reset'
    ? `Ma OTP dat lai mat khau Ngu Tam cua ban la ${code}. Ma co hieu luc 5 phut.`
    : `Ma OTP FoodHub cua ban la ${code}. Ma co hieu luc 5 phut.`;

  if (process.env.SMS_OTP_WEBHOOK_URL) {
    await axios.post(process.env.SMS_OTP_WEBHOOK_URL, {
      phone,
      code,
      purpose,
      message: String(options.message || defaultMessage)
    }, {
      timeout: 10000,
      headers: process.env.SMS_OTP_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${process.env.SMS_OTP_WEBHOOK_TOKEN}` }
        : {}
    });
  } else if (!devMode) {
    throw Object.assign(new Error('Production chưa cấu hình nhà cung cấp SMS OTP'), { statusCode: 503 });
  }

  return {
    phone,
    maskedPhone: maskPhone(phone),
    purpose,
    devCode: devMode ? code : undefined
  };
};

const verifyOtp = async (phoneRaw, codeRaw, options = {}) => {
  const phone = normalizePhone(phoneRaw);
  const purpose = normalizePurpose(options.purpose);
  const code = String(codeRaw || '').trim();
  const record = await PhoneOtp.findOne({ phone, purpose }).sort({ createdAt: -1 });

  if (!record || record.expiresAt < new Date()) {
    throw Object.assign(new Error('OTP đã hết hạn, vui lòng gửi lại'), { statusCode: 400 });
  }
  if (record.attempts >= 5) {
    throw Object.assign(new Error('Bạn đã nhập sai quá nhiều lần'), { statusCode: 429 });
  }
  if (record.codeHash !== hashCode(phone, code, purpose)) {
    record.attempts += 1;
    await record.save();
    throw Object.assign(new Error('Mã OTP không đúng'), { statusCode: 400 });
  }

  await PhoneOtp.deleteMany({ phone, purpose });
  return phone;
};

module.exports = { requestOtp, verifyOtp, maskPhone };
