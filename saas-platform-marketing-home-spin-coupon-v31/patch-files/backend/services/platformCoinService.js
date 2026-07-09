const Order = require('../models/Order');
const PlatformCoinAccount = require('../models/PlatformCoinAccount');
const PlatformCoinTransaction = require('../models/PlatformCoinTransaction');
const PlatformCoupon = require('../models/PlatformCoupon');
const { normalizePhone } = require('../utils/phone');

const getOrCreatePlatformAccount = async (phone, verified = true) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return PlatformCoinAccount.findOneAndUpdate(
    { phone: normalized },
    {
      $setOnInsert: { phone: normalized },
      ...(verified ? { $set: { phoneVerified: true, verifiedAt: new Date() } } : {})
    },
    { upsert: true, new: true }
  );
};

const computePlatformCouponDiscount = (coupon, subtotal) => {
  let discount = coupon.discountType === 'percentage'
    ? Number(subtotal || 0) * Number(coupon.discountValue || 0) / 100
    : Number(coupon.discountValue || 0);
  if (Number(coupon.maxDiscount || 0) > 0) discount = Math.min(discount, Number(coupon.maxDiscount || 0));
  return Math.max(0, Math.min(Number(subtotal || 0), Math.floor(discount)));
};

const validatePlatformCoupon = async ({ shopId, code, phone, subtotal }) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return { coupon: null, discount: 0, isPlatformCoupon: false };
  const now = new Date();
  const coupon = await PlatformCoupon.findOne({
    code: normalizedCode,
    isActive: true,
    $or: [{ appliesToAll: true }, { shopIds: shopId }]
  });
  if (!coupon) return { coupon: null, discount: 0, isPlatformCoupon: false };
  if (coupon.startsAt && coupon.startsAt > now) throw Object.assign(new Error('Mã giảm giá hệ thống chưa đến thời gian sử dụng'), { statusCode: 400 });
  if (coupon.endsAt && coupon.endsAt < now) throw Object.assign(new Error('Mã giảm giá hệ thống đã hết hạn'), { statusCode: 400 });
  if (Number(subtotal || 0) < Number(coupon.minOrder || 0)) {
    throw Object.assign(new Error(`Đơn tối thiểu ${Number(coupon.minOrder).toLocaleString('vi-VN')}đ để dùng mã hệ thống`), { statusCode: 400 });
  }
  if (Number(coupon.usageLimit || 0) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit || 0)) {
    throw Object.assign(new Error('Mã giảm giá hệ thống đã hết lượt sử dụng'), { statusCode: 400 });
  }
  const normalizedPhone = normalizePhone(phone);
  if (Number(coupon.perPhoneLimit || 0) > 0 && normalizedPhone) {
    const used = await Order.countDocuments({
      phone: normalizedPhone,
      couponCode: normalizedCode,
      status: { $ne: 'cancelled' }
    });
    if (used >= Number(coupon.perPhoneLimit || 0)) {
      throw Object.assign(new Error('Số điện thoại đã dùng hết lượt của mã hệ thống này'), { statusCode: 400 });
    }
  }
  return { coupon, discount: computePlatformCouponDiscount(coupon, Number(subtotal || 0)), isPlatformCoupon: true };
};

const spendPlatformCoins = async ({ phone, coins, orderId, shopId }) => {
  const normalized = normalizePhone(phone);
  const amount = Math.max(0, Math.floor(Number(coins || 0)));
  if (!normalized || !amount) return null;
  const account = await PlatformCoinAccount.findOneAndUpdate(
    { phone: normalized, coinBalance: { $gte: amount } },
    { $inc: { coinBalance: -amount, totalSpent: amount }, $set: { phoneVerified: true, verifiedAt: new Date() } },
    { new: true }
  );
  if (!account) throw Object.assign(new Error('Số xu hệ thống không đủ'), { statusCode: 400 });
  await PlatformCoinTransaction.create({
    phone: normalized,
    accountId: account._id,
    shopId: shopId || null,
    orderId,
    type: 'spend_order',
    coins: -amount,
    note: 'Dùng xu hệ thống trừ đơn hàng',
    uniqueKey: `platform-spend-order-${orderId}`
  });
  return account;
};

const refundPlatformCoinsForOrder = async (order, note = 'Hoàn xu hệ thống do đơn không thành công') => {
  const amount = Math.max(0, Math.floor(Number(order.platformCoinsUsed || 0)));
  const phone = normalizePhone(order.loyaltyPhone || order.phone || '');
  if (!amount || !phone) return null;
  const uniqueKey = `platform-refund-order-${order._id}`;
  if (await PlatformCoinTransaction.exists({ uniqueKey })) return null;
  const account = await getOrCreatePlatformAccount(phone, true);
  await PlatformCoinTransaction.create({
    phone,
    accountId: account._id,
    shopId: order.shopId || null,
    orderId: order._id,
    type: 'refund',
    coins: amount,
    note,
    uniqueKey
  });
  await PlatformCoinAccount.updateOne({ _id: account._id }, { $inc: { coinBalance: amount, totalSpent: -amount } });
  return account;
};

module.exports = {
  getOrCreatePlatformAccount,
  validatePlatformCoupon,
  computePlatformCouponDiscount,
  spendPlatformCoins,
  refundPlatformCoinsForOrder
};
