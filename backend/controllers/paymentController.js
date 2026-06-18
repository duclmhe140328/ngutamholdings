const Order = require('../models/Order');
const { verifyReturn } = require('../services/vnpayService');
const { emitToShop, emitToAdmins } = require('../realtime');
const Shop = require('../models/Shop');
const { rewardOrderCoins, releaseOrderBenefits } = require('../services/loyaltyService');

const processVnpayResult = async (query) => {
  const order = await Order.findOne({ orderCode: query.vnp_TxnRef });
  if (!order) return { ok: false, message: 'Không tìm thấy đơn hàng' };
  if (!verifyReturn(query)) return { ok: false, message: 'Chữ ký VNPAY không hợp lệ', order };

  const success = query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';
  order.paymentStatus = success ? 'paid' : 'failed';
  order.paidAt = success ? new Date() : null;
  if (success && order.status === 'pending') order.status = 'confirmed';
  await order.save();
  {
    const shop = await Shop.findById(order.shopId);
    if (shop && success) await rewardOrderCoins(order, shop);
    if (shop && !success) await releaseOrderBenefits(order, shop, 'Hoàn ưu đãi do VNPAY thất bại');
  }

  const populatedOrder = await Order.findById(order._id).populate('shopId', 'name slug').populate('tableId');
  emitToShop(order.shopId, 'order:updated', { order: populatedOrder });
  emitToAdmins('order:updated', { order: populatedOrder });
  return { ok: success, order: populatedOrder, message: success ? 'Thanh toán thành công' : 'Thanh toán thất bại' };
};

exports.vnpayReturn = async (req, res, next) => {
  try {
    const result = await processVnpayResult(req.query);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const shopSlug = result.order?.shopId?.slug || '';
    const params = new URLSearchParams({
      status: result.ok ? 'success' : 'failed',
      orderCode: result.order?.orderCode || req.query.vnp_TxnRef || '',
      shopSlug,
      message: result.message
    });
    res.redirect(`${clientUrl}/payment-result?${params.toString()}`);
  } catch (error) {
    next(error);
  }
};

exports.vnpayIpn = async (req, res) => {
  try {
    const result = await processVnpayResult(req.query);
    if (!result.order) return res.json({ RspCode: '01', Message: 'Order not found' });
    if (!verifyReturn(req.query)) return res.json({ RspCode: '97', Message: 'Invalid signature' });
    return res.json({ RspCode: result.ok ? '00' : '02', Message: result.message });
  } catch {
    return res.json({ RspCode: '99', Message: 'Unknown error' });
  }
};
