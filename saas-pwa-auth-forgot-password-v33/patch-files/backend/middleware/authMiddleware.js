const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) return res.status(401).json({ message: 'Chưa đăng nhập' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Tài khoản không hợp lệ hoặc đã bị khóa' });
    }

    const tokenVersion = Number(decoded.tokenVersion || 0);
    const currentVersion = Number(user.tokenVersion || 0);
    if (tokenVersion !== currentVersion) {
      return res.status(401).json({ message: 'Phiên đăng nhập đã cũ vì mật khẩu vừa được thay đổi' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Chỉ admin mới được thực hiện hành động này' });
  }
  return next();
};

const requireSellerOrAdmin = (req, res, next) => {
  if (!req.user || !['seller', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Không có quyền truy cập' });
  }
  return next();
};

module.exports = { protect, requireAdmin, requireSellerOrAdmin };
