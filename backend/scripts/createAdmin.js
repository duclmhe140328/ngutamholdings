const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

dotenv.config();

const createAdmin = async () => {
  await connectDB();

  const name = process.env.ADMIN_NAME || 'Admin Tong';
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || '123456';
  const phone = process.env.ADMIN_PHONE || '';

  const existed = await User.findOne({ email: email.toLowerCase().trim() });
  if (existed) {
    existed.role = 'admin';
    existed.isActive = true;
    await existed.save();
    console.log('Tai khoan admin da ton tai, da cap nhat role admin:', email);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    name,
    email,
    phone,
    passwordHash,
    role: 'admin'
  });

  console.log('Da tao admin:', email, 'mat khau:', password);
  process.exit(0);
};

createAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
