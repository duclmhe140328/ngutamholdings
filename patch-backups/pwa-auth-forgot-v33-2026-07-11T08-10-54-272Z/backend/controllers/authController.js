const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Vui long nhap ten, email va mat khau' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Mat khau toi thieu 6 ky tu' });
    }

    const existed = await User.findOne({ email: email.toLowerCase().trim() });
    if (existed) {
      return res.status(400).json({ message: 'Email nay da duoc dang ky' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      role: 'seller'
    });

    const token = signToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Vui long nhap email va mat khau' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Sai email hoac mat khau' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Sai email hoac mat khau' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Tai khoan da bi khoa' });
    }

    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res) => {
  res.json({ user: req.user });
};
