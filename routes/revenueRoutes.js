const express = require('express');
const router = express.Router();
const { getDailyRevenue } = require('../services/dailyRevenueService');

router.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Revenue API is working', route: '/api/revenue' });
});

router.get('/daily', async (req, res) => {
  try {
    const data = await getDailyRevenue({
      from: req.query.from,
      to: req.query.to,
      shopId: req.query.shopId || 'global'
    });
    res.json(data);
  } catch (error) {
    console.error('[revenue daily error]', error);
    res.status(500).json({ ok: false, message: error.message || 'Revenue API error' });
  }
});

router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = await getDailyRevenue({ from: today, to: today, shopId: req.query.shopId || 'global' });
    res.json(data);
  } catch (error) {
    console.error('[revenue today error]', error);
    res.status(500).json({ ok: false, message: error.message || 'Revenue API error' });
  }
});

module.exports = router;
