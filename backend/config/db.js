const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Thiếu MONGO_URI trong backend/.env');
    return false;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 6000 });
    console.log('Đã kết nối MongoDB');
    return true;
  } catch (error) {
    console.error('Lỗi kết nối MongoDB:', error.message);
    return false;
  }
};

module.exports = connectDB;
