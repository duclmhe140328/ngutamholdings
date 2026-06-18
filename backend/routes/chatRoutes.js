const express = require('express');
const chatController = require('../controllers/chatController');
const { protect, requireAdmin, requireSellerOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/customer/start', chatController.customerStartConversation);
router.get('/customer/thread', chatController.customerGetConversation);
router.post('/customer/:id/reply', chatController.customerReply);
router.post('/customer/:id/read', chatController.customerMarkRead);

router.get('/seller', protect, requireSellerOrAdmin, chatController.sellerListConversations);
router.post('/seller/:id/read', protect, requireSellerOrAdmin, chatController.sellerMarkRead);
router.post('/seller/customer/:id/reply', protect, requireSellerOrAdmin, chatController.sellerReplyCustomer);
router.post('/seller/admin', protect, requireSellerOrAdmin, chatController.sellerSendAdmin);

router.get('/admin', protect, requireAdmin, chatController.adminListConversations);
router.post('/admin/:id/read', protect, requireAdmin, chatController.adminMarkRead);
router.post('/admin/:id/reply', protect, requireAdmin, chatController.adminReplySeller);

module.exports = router;
