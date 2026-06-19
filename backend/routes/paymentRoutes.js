const express = require('express');
const paymentController = require('../controllers/paymentController');
const router = express.Router();

router.get('/vnpay-return', paymentController.vnpayReturn);
router.get('/vnpay-ipn', paymentController.vnpayIpn);
router.post('/sepay-webhook', paymentController.sepayWebhook);
router.get('/order-status/:orderCode', paymentController.getOrderPaymentStatus);

module.exports = router;
