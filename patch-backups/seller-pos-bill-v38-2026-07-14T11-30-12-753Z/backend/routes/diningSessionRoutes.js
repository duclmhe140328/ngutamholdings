const express = require('express');
const controller = require('../controllers/diningSessionController');
const { protect, requireSellerOrAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/public/:slug/:tableToken/open', controller.openOrResume);
router.post('/public/:slug/:tableToken/unlock-checkout-edit', controller.unlockCheckoutEdit);
router.get('/my-shop', protect, requireSellerOrAdmin, controller.getMySessions);
router.patch('/:id/close', protect, requireSellerOrAdmin, controller.closeSession);

module.exports = router;
