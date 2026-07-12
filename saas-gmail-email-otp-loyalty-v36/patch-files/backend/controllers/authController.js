const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { normalizePhone } = require('../utils/phone');
const { requestEmailOtp, verifyEmailOtp, maskEmail } = require('../services/emailOtpService');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const canonicalPassword = (value) => String(value || '').normalize('NFC');

const passwordCandidates = (value) => {
  const raw = String(value || '');
  return [...new Set([raw, raw.normalize('NFC'), raw.normalize('NFD')])];
};

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role
});

const signToken = (user) => jwt.sign(
  {
    id: user._id,
    role: user.role,
    tokenVersion: Number(user.tokenVersion || 0)
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const normalizedPassword = canonicalPassword(password);

    if (!String(name || '').trim() || !normalizedEmail || !normalizedPhone || !normalizedPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập tên, email, số điện thoại và mật khẩu' });
    }
    if (normalizedPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu tối thiểu 6 ký tự' });
    }

    const existed = await User.findOne({ email: normalizedEmail });
    if (existed) return res.status(400).json({ message: 'Email này đã được đăng ký' });

    const passwordHash = await bcrypt.hash(normalizedPassword, 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      role: 'seller'
    });

    const token = signToken(user);
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Sai email hoặc mật khẩu' });

    let matchedCandidate = null;
    for (const candidate of passwordCandidates(password)) {
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(candidate, user.passwordHash)) {
        matchedCandidate = candidate;
        break;
      }
    }

    if (matchedCandidate === null) return res.status(401).json({ message: 'Sai email hoặc mật khẩu' });
    if (!user.isActive) return res.status(403).json({ message: 'Tài khoản đã bị khóa' });

    const normalizedPassword = canonicalPassword(password);
    if (matchedCandidate !== normalizedPassword) {
      user.passwordHash = await bcrypt.hash(normalizedPassword, 10);
      user.passwordChangedAt = new Date();
    }
    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);
    return res.json({ token, user: publicUser(user), multiDeviceLogin: true });
  } catch (error) {
    return next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ message: 'Vui lòng nhập email đã đăng ký' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản dùng email này' });
    if (!user.isActive) return res.status(403).json({ message: 'Tài khoản đang bị khóa' });

    const otp = await requestEmailOtp({
      email,
      purpose: 'password_reset',
      requestIp: req.ip
    });

    return res.json({
      message: `Đã gửi mã OTP tới ${otp.maskedEmail || maskEmail(email)}`,
      email,
      maskedEmail: otp.maskedEmail || maskEmail(email),
      provider: otp.provider,
      devCode: otp.devCode
    });
  } catch (error) {
    return next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || '').trim();
    const password = canonicalPassword(req.body.password);

    if (!email || !code || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email, OTP và mật khẩu mới' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới tối thiểu 6 ký tự' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    if (!user.isActive) return res.status(403).json({ message: 'Tài khoản đang bị khóa' });

    await verifyEmailOtp({ email, code, purpose: 'password_reset' });
    user.passwordHash = await bcrypt.hash(password, 10);
    user.passwordChangedAt = new Date();
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    await user.save();

    return res.json({
      success: true,
      message: 'Đổi mật khẩu thành công. Hãy đăng nhập lại bằng mật khẩu mới.'
    });
  } catch (error) {
    return next(error);
  }
};

exports.me = async (req, res) => res.json({ user: req.user });
