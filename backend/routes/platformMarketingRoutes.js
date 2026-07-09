const express = require('express');
const controller = require('../controllers/platformMarketingController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/public', controller.getPublicMarketing);
router.post('/spin', controller.spin);

router.get('/admin', protect, requireAdmin, controller.getAdminMarketing);
router.put('/admin/spin-config', protect, requireAdmin, controller.updateSpinConfig);
router.post('/admin/coupons', protect, requireAdmin, controller.createCoupon);
router.put('/admin/coupons/:id', protect, requireAdmin, controller.updateCoupon);
router.delete('/admin/coupons/:id', protect, requireAdmin, controller.deleteCoupon);

module.exports = router;
