const crypto = require('crypto');
const nodemailer = require('nodemailer');
const EmailOtp = require('../models/EmailOtp');
const { normalizePhone } = require('../utils/phone');

const VALID_PURPOSES = new Set(['password_reset', 'loyalty']);
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePurpose = (value) => VALID_PURPOSES.has(value) ? value : 'password_reset';

const maskEmail = (value) => {
  const email = normalizeEmail(value);
  const [local = '', domain = ''] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
};

const otpSecret = () => String(process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || '').trim();

const hashCode = ({ email, phone, purpose, code }) => {
  const secret = otpSecret();
  if (!secret) {
    throw Object.assign(new Error('Thiếu OTP_HASH_SECRET hoặc JWT_SECRET'), { statusCode: 503 });
  }
  return crypto
    .createHmac('sha256', secret)
    .update(`${normalizeEmail(email)}:${normalizePhone(phone) || ''}:${normalizePurpose(purpose)}:${String(code)}`)
    .digest('hex');
};

const safeEqualHex = (left, right) => {
  try {
    const a = Buffer.from(String(left || ''), 'hex');
    const b = Buffer.from(String(right || ''), 'hex');
    return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

let cachedTransporter = null;
let cachedCredentialKey = '';

const getTransporter = () => {
  const user = normalizeEmail(process.env.GMAIL_USER);
  const pass = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!user || !pass) {
    throw Object.assign(
      new Error('Thiếu GMAIL_USER hoặc GMAIL_APP_PASSWORD trong backend/.env/Render'),
      { statusCode: 503 }
    );
  }

  const credentialKey = `${user}:${pass}`;
  if (!cachedTransporter || cachedCredentialKey !== credentialKey) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });
    cachedCredentialKey = credentialKey;
  }

  return { transporter: cachedTransporter, user };
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const buildMail = ({ email, code, purpose, phone }) => {
  const appName = String(process.env.GMAIL_FROM_NAME || process.env.OTP_APP_NAME || 'Ngu Tam').trim();
  const isLoyalty = purpose === 'loyalty';
  const title = isLoyalty ? 'Xác minh ví xu & tích điểm' : 'Xác minh đặt lại mật khẩu';
  const safeAppName = escapeHtml(appName);
  const safeCode = escapeHtml(code);
  const safePhone = escapeHtml(phone || '');

  return {
    subject: `[${appName}] Mã OTP ${isLoyalty ? 'tích xu' : 'đặt lại mật khẩu'}`,
    text: [
      `Mã OTP ${isLoyalty ? 'xác minh ví xu' : 'đặt lại mật khẩu'} ${appName} của bạn là: ${code}`,
      isLoyalty && phone ? `Số điện thoại ví xu: ${phone}` : '',
      'Mã có hiệu lực trong 5 phút và chỉ dùng được một lần.',
      'Nếu bạn không yêu cầu mã này, hãy bỏ qua email.'
    ].filter(Boolean).join('\n\n'),
    html: `<!doctype html>
<html lang="vi">
  <body style="margin:0;background:#f6f3ed;font-family:Arial,sans-serif;color:#1d1a16">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px">
      <div style="background:#ffffff;border:1px solid #eadfce;border-radius:22px;overflow:hidden;box-shadow:0 18px 45px rgba(43,31,19,.10)">
        <div style="padding:24px 28px;background:#173f35;color:#ffffff">
          <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.75">${safeAppName}</div>
          <h1 style="margin:8px 0 0;font-size:24px">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:30px 28px">
          <p style="margin:0 0 16px;line-height:1.65">Mã OTP của bạn là:</p>
          <div style="margin:0 0 22px;padding:18px;text-align:center;background:#fff7e7;border:1px solid #efd39b;border-radius:14px;font-size:34px;font-weight:800;letter-spacing:10px;color:#7a5315">${safeCode}</div>
          ${isLoyalty && phone ? `<p style="margin:0 0 10px;line-height:1.65">Ví xu gắn với số điện thoại: <b>${safePhone}</b></p>` : ''}
          <p style="margin:0 0 10px;line-height:1.65">Mã có hiệu lực trong <b>5 phút</b> và chỉ sử dụng được một lần.</p>
          <p style="margin:0;color:#756b5e;font-size:13px;line-height:1.6">Nếu bạn không yêu cầu mã này, hãy bỏ qua email và không chia sẻ OTP cho bất kỳ ai.</p>
        </div>
      </div>
      <p style="margin:16px 0 0;text-align:center;color:#8c8173;font-size:12px">Email tự động gửi tới ${escapeHtml(email)}</p>
    </div>
  </body>
</html>`
  };
};

const requestEmailOtp = async (options = {}) => {
  const email = normalizeEmail(options.email);
  const purpose = normalizePurpose(options.purpose);
  const phone = normalizePhone(options.phone) || '';
  const requestIp = String(options.requestIp || '').trim().slice(0, 120);

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw Object.assign(new Error('Email không hợp lệ'), { statusCode: 400 });
  }
  if (purpose === 'loyalty' && !phone) {
    throw Object.assign(new Error('Số điện thoại Việt Nam không hợp lệ'), { statusCode: 400 });
  }

  const targetQuery = { email, phone, purpose };
  const resendSeconds = Math.max(30, Number(process.env.OTP_RESEND_SECONDS || 60));
  const recent = await EmailOtp.findOne(targetQuery).sort({ createdAt: -1 });
  if (recent && Date.now() - recent.createdAt.getTime() < resendSeconds * 1000) {
    throw Object.assign(
      new Error(`Vui lòng chờ ${resendSeconds} giây trước khi gửi lại OTP`),
      { statusCode: 429 }
    );
  }

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const targetCount = await EmailOtp.countDocuments({ ...targetQuery, createdAt: { $gte: fifteenMinutesAgo } });
  if (targetCount >= 5) {
    throw Object.assign(new Error('Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau 15 phút.'), { statusCode: 429 });
  }

  if (requestIp) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const ipCount = await EmailOtp.countDocuments({ requestIp, createdAt: { $gte: oneHourAgo } });
    if (ipCount >= 20) {
      throw Object.assign(new Error('Thiết bị này đã gửi quá nhiều yêu cầu OTP. Vui lòng thử lại sau.'), { statusCode: 429 });
    }
  }

  const devMode = String(process.env.OTP_DEV_MODE || '').trim().toLowerCase() === 'true';
  const code = devMode && process.env.OTP_DEV_CODE
    ? String(process.env.OTP_DEV_CODE).trim()
    : String(crypto.randomInt(100000, 1000000));

  await EmailOtp.updateMany(
    { ...targetQuery, consumedAt: null },
    { $set: { consumedAt: new Date() } }
  );

  const record = await EmailOtp.create({
    ...targetQuery,
    codeHash: hashCode({ email, phone, purpose, code }),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    purgeAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    requestIp
  });

  let provider = 'development';
  let messageId = '';

  try {
    if (!devMode) {
      const { transporter, user } = getTransporter();
      const mail = buildMail({ email, code, purpose, phone });
      const info = await transporter.sendMail({
        from: {
          name: String(process.env.GMAIL_FROM_NAME || process.env.OTP_APP_NAME || 'Ngu Tam').trim(),
          address: user
        },
        to: email,
        replyTo: normalizeEmail(process.env.GMAIL_REPLY_TO) || user,
        subject: mail.subject,
        text: mail.text,
        html: mail.html
      });
      provider = 'gmail';
      messageId = String(info?.messageId || '');
    }
  } catch (error) {
    await EmailOtp.deleteOne({ _id: record._id }).catch(() => null);
    console.error('[GMAIL OTP error]', {
      code: error?.code,
      responseCode: error?.responseCode,
      command: error?.command,
      message: error?.message
    });
    throw Object.assign(error, { statusCode: error?.statusCode || 502 });
  }

  return {
    email,
    maskedEmail: maskEmail(email),
    phone,
    purpose,
    provider,
    messageId,
    devCode: devMode ? code : undefined
  };
};

const verifyEmailOtp = async (options = {}) => {
  const email = normalizeEmail(options.email);
  const purpose = normalizePurpose(options.purpose);
  const phone = normalizePhone(options.phone) || '';
  const code = String(options.code || '').trim();

  const record = await EmailOtp.findOne({
    email,
    phone,
    purpose,
    consumedAt: null
  }).sort({ createdAt: -1 });

  if (!record || record.expiresAt < new Date()) {
    throw Object.assign(new Error('OTP đã hết hạn, vui lòng gửi lại'), { statusCode: 400 });
  }
  if (record.attempts >= 5) {
    throw Object.assign(new Error('Bạn đã nhập sai quá nhiều lần'), { statusCode: 429 });
  }

  const candidateHash = hashCode({ email, phone, purpose, code });
  if (!safeEqualHex(record.codeHash, candidateHash)) {
    record.attempts += 1;
    await record.save();
    throw Object.assign(new Error('Mã OTP không đúng'), { statusCode: 400 });
  }

  record.consumedAt = new Date();
  await record.save();
  return { email, phone, purpose };
};

const verifyGmailConnection = async () => {
  const { transporter, user } = getTransporter();
  await transporter.verify();
  return { user };
};

module.exports = {
  requestEmailOtp,
  verifyEmailOtp,
  verifyGmailConnection,
  maskEmail,
  normalizeEmail
};
