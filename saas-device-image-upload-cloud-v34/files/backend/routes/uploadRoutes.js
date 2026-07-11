const express = require('express');
const uploadController = require('../controllers/uploadController');
const { uploadImagesMiddleware } = require('../middleware/imageUpload');
const { protect, requireSellerOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post(
  '/images',
  protect,
  requireSellerOrAdmin,
  uploadImagesMiddleware,
  uploadController.uploadImages
);

module.exports = router;
