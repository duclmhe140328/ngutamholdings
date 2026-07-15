const express = require('express');
const orderController = require('../controllers/orderController');
const { protect, requireSellerOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
router.post('/quote', orderController.quoteOrder);
router.post('/', orderController.createOrder);
router.get('/my-shop', protect, requireSellerOrAdmin, orderController.getMyShopOrders);
router.put('/:id/status', protect, requireSellerOrAdmin, orderController.updateOrderStatus);
router.put('/:id/payment', protect, requireSellerOrAdmin, orderController.updatePaymentStatus);
router.put('/:id/invoice', protect, requireSellerOrAdmin, orderController.updateInvoiceData);
module.exports = router;
