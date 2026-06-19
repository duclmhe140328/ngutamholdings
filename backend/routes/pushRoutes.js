const express = require('express');
const controller = require('../controllers/pushController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/public-key', controller.getPublicKey);
router.post('/subscribe', protect, controller.subscribe);
router.post('/unsubscribe', protect, controller.unsubscribe);
router.post('/test', protect, controller.test);

module.exports = router;
