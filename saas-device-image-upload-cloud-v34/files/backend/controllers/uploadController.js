const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v2: cloudinary } = require('cloudinary');

const CLOUDINARY_READY = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (CLOUDINARY_READY) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

const safeSegment = (value, fallback = 'general') => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || fallback;
};

const extensionByMime = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

const uploadToCloudinary = (file, folder) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({
    folder,
    resource_type: 'image',
    unique_filename: true,
    overwrite: false,
    transformation: [
      { width: 2400, height: 2400, crop: 'limit' },
      { quality: 'auto:good', fetch_format: 'auto' }
    ]
  }, (error, result) => {
    if (error) return reject(error);
    return resolve(result.secure_url);
  });
  stream.end(file.buffer);
});

const saveLocally = async ({ file, req, owner, kind }) => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const relativeDir = path.join(year, month, owner, kind);
  const uploadsRoot = path.resolve(__dirname, '../uploads');
  const absoluteDir = path.join(uploadsRoot, relativeDir);
  await fs.promises.mkdir(absoluteDir, { recursive: true });

  const extension = extensionByMime[String(file.mimetype || '').toLowerCase()] || '.jpg';
  const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  await fs.promises.writeFile(path.join(absoluteDir, filename), file.buffer);

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = req.get('host');
  const publicPath = ['uploads', year, month, owner, kind, filename].join('/');
  return `${protocol}://${host}/${publicPath}`;
};

exports.uploadImages = async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ message: 'Vui lòng chọn ít nhất một ảnh' });

    const owner = safeSegment(req.user?._id, 'user');
    const kind = safeSegment(req.body?.kind, 'general');
    const cloudFolder = [
      safeSegment(process.env.CLOUDINARY_FOLDER || 'foodhub', 'foodhub'),
      owner,
      kind
    ].join('/');

    const urls = [];
    for (const file of files) {
      const url = CLOUDINARY_READY
        ? await uploadToCloudinary(file, cloudFolder)
        : await saveLocally({ file, req, owner, kind });
      urls.push(url);
    }

    return res.status(201).json({
      urls,
      url: urls[0] || '',
      storageMode: CLOUDINARY_READY ? 'cloudinary' : 'local',
      warning: CLOUDINARY_READY
        ? ''
        : 'Ảnh đang lưu trên ổ đĩa máy chủ. Render có thể xóa ảnh sau khi redeploy; hãy cấu hình Cloudinary để lưu lâu dài.'
    });
  } catch (error) {
    return next(error);
  }
};
