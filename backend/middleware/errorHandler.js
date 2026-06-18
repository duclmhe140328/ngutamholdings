const errorHandler = (err, req, res, next) => {
  console.error('ERROR:', err.message);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((item) => item.message);
    return res.status(400).json({ message: messages[0] || 'Du lieu khong hop le' });
  }

  if (err.code === 11000) {
    return res.status(400).json({ message: 'Du lieu da ton tai, hay dung gia tri khac' });
  }

  return res.status(err.statusCode || 500).json({
    message: err.message || 'Loi server'
  });
};

module.exports = errorHandler;
