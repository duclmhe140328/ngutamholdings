const express = require('express');
const shopController = require('../controllers/shopController');
const { protect, requireSellerOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/public/list', shopController.getPublicShops);
router.get('/domain/current', shopController.getShopByDomain);
router.post('/', protect, requireSellerOrAdmin, shopController.createShop);
router.get('/me/current', protect, requireSellerOrAdmin, shopController.getMyShop);
router.put('/:id', protect, requireSellerOrAdmin, shopController.updateShop);
router.get('/:slug', shopController.getShopBySlug);

module.exports = router;
