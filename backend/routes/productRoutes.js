const express = require('express');
const productController = require('../controllers/productController');
const { protect, requireSellerOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
router.post('/', protect, requireSellerOrAdmin, productController.createProduct);
router.get('/my-shop', protect, requireSellerOrAdmin, productController.getMyShopProducts);
router.get('/shop/:slug', productController.getProductsByShopSlug);
router.get('/:id', productController.getProductById);
router.put('/:id', protect, requireSellerOrAdmin, productController.updateProduct);
router.delete('/:id', protect, requireSellerOrAdmin, productController.deleteProduct);

module.exports = router;
