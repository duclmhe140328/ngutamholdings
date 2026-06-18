const express = require('express');
const tableController = require('../controllers/tableController');
const { protect, requireSellerOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/public/:slug/:token', tableController.getPublicTable);
router.get('/my-shop', protect, requireSellerOrAdmin, tableController.getMyTables);
router.post('/my-shop/add', protect, requireSellerOrAdmin, tableController.addTables);
router.patch('/:id/regenerate', protect, requireSellerOrAdmin, tableController.regenerateQr);
router.patch('/:id/status', protect, requireSellerOrAdmin, tableController.toggleTable);

module.exports = router;
