const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

function getDateRange(from, to) {
  const now = new Date();
  const startText = from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const endText = to || now.toISOString().slice(0, 10);

  const start = new Date(`${startText}T00:00:00.000+07:00`);
  const end = new Date(`${endText}T23:59:59.999+07:00`);

  return { start, end };
}

function getShopMatch(shopId) {
  if (!shopId || shopId === 'global' || shopId === 'all') return {};

  const values = [shopId];

  try {
    values.push(new mongoose.Types.ObjectId(shopId));
  } catch (err) {}

  return {
    $or: [
      { shopId: { $in: values } },
      { storeId: { $in: values } },
      { tenantId: { $in: values } },
      { shop: { $in: values } },
      { store: { $in: values } },
      { 'shop._id': { $in: values } },
      { 'store._id': { $in: values } }
    ]
  };
}

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Revenue API is working'
  });
});

router.get('/daily', async (req, res) => {
  try {
    const { from, to, shopId } = req.query;
    const { start, end } = getDateRange(from, to);

    if (!mongoose.connection || !mongoose.connection.db) {
      return res.status(500).json({
        message: 'MongoDB is not connected'
      });
    }

    const collectionName = process.env.ORDER_COLLECTION || 'orders';
    const orders = mongoose.connection.db.collection(collectionName);

    const shopMatch = getShopMatch(shopId);

    const rows = await orders.aggregate([
      {
        $addFields: {
          revenueOrderDate: {
            $ifNull: ['$createdAt', { $ifNull: ['$date', '$created_at'] }]
          },
          revenueAmount: {
            $ifNull: [
              '$totalAmount',
              {
                $ifNull: [
                  '$total',
                  {
                    $ifNull: [
                      '$amount',
                      { $ifNull: ['$grandTotal', 0] }
                    ]
                  }
                ]
              }
            ]
          },
          revenueStatus: {
            $toLower: {
              $ifNull: ['$status', '']
            }
          },
          revenuePaymentMethod: {
            $toLower: {
              $ifNull: ['$paymentMethod', '']
            }
          }
        }
      },
      {
        $match: {
          revenueOrderDate: {
            $gte: start,
            $lte: end
          },
          ...shopMatch
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$revenueOrderDate',
              timezone: 'Asia/Bangkok'
            }
          },
          revenue: {
            $sum: {
              $cond: [
                {
                  $in: ['$revenueStatus', ['cancelled', 'canceled', 'cancel', 'huy', 'hủy']]
                },
                0,
                { $toDouble: '$revenueAmount' }
              ]
            }
          },
          totalOrders: { $sum: 1 },
          cancelledOrders: {
            $sum: {
              $cond: [
                {
                  $in: ['$revenueStatus', ['cancelled', 'canceled', 'cancel', 'huy', 'hủy']]
                },
                1,
                0
              ]
            }
          },
          codOrders: {
            $sum: {
              $cond: [
                { $in: ['$revenuePaymentMethod', ['cod', 'cash']] },
                1,
                0
              ]
            }
          },
          onlineOrders: {
            $sum: {
              $cond: [
                { $in: ['$revenuePaymentMethod', ['vnpay', 'momo', 'bank', 'banking', 'online', 'qr']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: {
          _id: -1
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          revenue: 1,
          totalOrders: 1,
          cancelledOrders: 1,
          codOrders: 1,
          onlineOrders: 1,
          averageOrderValue: {
            $cond: [
              { $gt: ['$totalOrders', 0] },
              { $divide: ['$revenue', '$totalOrders'] },
              0
            ]
          }
        }
      }
    ]).toArray();

    const summary = rows.reduce(
      (acc, item) => {
        acc.revenue += Number(item.revenue || 0);
        acc.totalOrders += Number(item.totalOrders || 0);
        acc.cancelledOrders += Number(item.cancelledOrders || 0);
        acc.codOrders += Number(item.codOrders || 0);
        acc.onlineOrders += Number(item.onlineOrders || 0);
        return acc;
      },
      {
        revenue: 0,
        totalOrders: 0,
        cancelledOrders: 0,
        codOrders: 0,
        onlineOrders: 0
      }
    );

    summary.averageOrderValue = summary.totalOrders > 0
      ? summary.revenue / summary.totalOrders
      : 0;

    res.json({
      ok: true,
      from: from || null,
      to: to || null,
      shopId: shopId || 'global',
      summary,
      data: rows
    });
  } catch (error) {
    console.error('Revenue daily error:', error);
    res.status(500).json({
      message: 'Revenue API error',
      error: error.message
    });
  }
});

router.get('/today', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  req.query.from = today;
  req.query.to = today;
  router.handle(req, res);
});

module.exports = router;
