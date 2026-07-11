const multer = require('multer');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

const storage = multer.memoryStorage();

const imageUpload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 8
  },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(String(file.mimetype || '').toLowerCase())) {
      return callback(new Error('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF'));
    }
    return callback(null, true);
  }
});

const uploadImagesMiddleware = (req, res, next) => {
  imageUpload.array('images', 8)(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Mỗi ảnh tối đa 8MB' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Mỗi lần chỉ được tải tối đa 8 ảnh' });
    }
    return res.status(400).json({ message: error.message || 'Không thể đọc tệp ảnh' });
  });
};

module.exports = { uploadImagesMiddleware };
