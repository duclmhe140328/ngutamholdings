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

const toE164Vietnam = (phoneRaw) => {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return '';
  return `+84${phone.slice(1)}`;
};

let cachedTwilioClient = null;
const getTwilioClient = () => {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  if (!accountSid || !authToken) {
    throw Object.assign(new Error('Thiếu TWILIO_ACCOUNT_SID hoặc TWILIO_AUTH_TOKEN'), { statusCode: 503 });
  }
  if (!cachedTwilioClient) {
    // Lazy require: backend vẫn khởi động được và chỉ tải SDK khi gửi OTP.
    const twilio = require('twilio');
    cachedTwilioClient = twilio(accountSid, authToken);
  }
  return cachedTwilioClient;
};

const sendWithTwilioVerify = async ({ phone, code, purpose }) => {
  const serviceSid = String(process.env.TWILIO_VERIFY_SERVICE_SID || '').trim();
  if (!serviceSid) {
    throw Object.assign(new Error('Thiếu TWILIO_VERIFY_SERVICE_SID'), { statusCode: 503 });
  }

  const to = toE164Vietnam(phone);
  if (!to) {
    throw Object.assign(new Error('Số điện thoại Việt Nam không hợp lệ'), { statusCode: 400 });
  }

  const payload = {
    to,
    channel: String(process.env.TWILIO_VERIFY_CHANNEL || 'sms').trim() || 'sms',
    customCode: code
  };

  const appName = String(process.env.OTP_APP_NAME || 'Ngu Tam').trim();
  if (appName) payload.customFriendlyName = appName;

  const locale = String(process.env.TWILIO_VERIFY_LOCALE || '').trim();
  if (locale) payload.locale = locale;

  const verification = await getTwilioClient()
    .verify.v2
    .services(serviceSid)
    .verifications
    .create(payload);

  if (!verification || !['pending', 'approved'].includes(String(verification.status || '').toLowerCase())) {
    throw Object.assign(new Error(`Twilio không nhận yêu cầu OTP (${verification?.status || 'unknown'})`), { statusCode: 502 });
  }

  return {
    provider: 'twilio',
    providerId: verification.sid,
    status: verification.status,
    to,
    purpose
  };
};

const sendWithWebhook = async ({ phone, code, purpose, message }) => {
  const url = String(process.env.SMS_OTP_WEBHOOK_URL || '').trim();
  if (!url) {
    throw Object.assign(new Error('Thiếu SMS_OTP_WEBHOOK_URL'), { statusCode: 503 });
  }

  await axios.post(url, {
    phone,
    code,
    purpose,
    message
  }, {
    timeout: 10000,
    headers: process.env.SMS_OTP_WEBHOOK_TOKEN
      ? { Authorization: `Bearer ${process.env.SMS_OTP_WEBHOOK_TOKEN}` }
      : {}
  });

  return { provider: 'webhook' };
};

const resolveProvider = () => {
  const configured = String(process.env.OTP_PROVIDER || '').trim().toLowerCase();
  if (configured) return configured;
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID) return 'twilio';
  if (process.env.SMS_OTP_WEBHOOK_URL) return 'webhook';
  return '';
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
    : String(crypto.randomInt(100000, 1000000));

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

  const provider = resolveProvider();
  let delivery = null;

  try {
    if (provider === 'twilio') {
      delivery = await sendWithTwilioVerify({ phone, code, purpose });
    } else if (provider === 'webhook') {
      delivery = await sendWithWebhook({
        phone,
        code,
        purpose,
        message: String(options.message || defaultMessage)
      });
    } else if (!devMode) {
      throw Object.assign(new Error('Production chưa cấu hình OTP_PROVIDER và nhà cung cấp OTP'), { statusCode: 503 });
    }
  } catch (error) {
    // Không giữ OTP chưa được gửi thành công.
    await PhoneOtp.deleteMany({ phone, purpose });
    if (error?.code) {
      console.error('[OTP provider error]', {
        provider,
        code: error.code,
        status: error.status,
        message: error.message
      });
    }
    throw error;
  }

  return {
    phone,
    maskedPhone: maskPhone(phone),
    purpose,
    provider: delivery?.provider || (devMode ? 'development' : provider),
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

module.exports = { requestOtp, verifyOtp, maskPhone, toE164Vietnam };
