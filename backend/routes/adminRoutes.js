const express = require('express');
const adminController = require('../controllers/adminController');
const orderController = require('../controllers/orderController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect, requireAdmin);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.patch('/users/:id/status', adminController.setUserActive);
router.get('/shops', adminController.getShops);
router.patch('/shops/:id/status', adminController.setShopActive);
router.patch('/shops/:id/approval', adminController.setShopApproval);
router.get('/orders', adminController.getOrders);
router.put('/orders/:id/status', orderController.updateOrderStatus);
router.put('/orders/:id/payment', orderController.updatePaymentStatus);

module.exports = router;
