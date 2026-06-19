const jwt = require('jsonwebtoken');
const LoyaltyAccount = require('../models/LoyaltyAccount');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const Coupon = require('../models/Coupon');
const CustomerVoucher = require('../models/CustomerVoucher');
const Order = require('../models/Order');
const { normalizePhone } = require('../utils/phone');

const VN_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
const vietnamDateKey = (date = new Date()) => new Date(date.getTime() + VN_TZ_OFFSET_MS).toISOString().slice(0, 10);
const loyaltySecret = () => process.env.LOYALTY_JWT_SECRET || process.env.JWT_SECRET || 'dev-loyalty-secret';

const createLoyaltyToken = (phone) => jwt.sign({ type: 'loyalty', phone }, loyaltySecret(), { expiresIn: '30d' });
const verifyLoyaltyToken = (token, expectedPhone = '') => {
  try {
    const payload = jwt.verify(String(token || ''), loyaltySecret());
    if (payload.type !== 'loyalty') return null;
    if (expectedPhone && payload.phone !== normalizePhone(expectedPhone)) return null;
    return payload;
  } catch { return null; }
};

const requireVerifiedPhone = (req, phone) => {
  const normalized = normalizePhone(phone);
  const token = req.headers['x-loyalty-token'] || req.body?.loyaltyToken || '';
  const payload = verifyLoyaltyToken(token, normalized);
  if (!normalized || !payload) {
    const error = new Error('Vui lòng xác thực số điện thoại bằng OTP để dùng xu/voucher');
    error.statusCode = 401;
    throw error;
  }
  return normalized;
};

const getOrCreateAccount = async (shopId, phone, verified = true) => LoyaltyAccount.findOneAndUpdate(
  { shopId, phone },
  { $setOnInsert: { shopId, phone }, ...(verified ? { $set: { phoneVerified: true, verifiedAt: new Date() } } : {}) },
  { upsert: true, new: true }
);

const computeCouponDiscount = (coupon, subtotal) => {
  let discount = coupon.discountType === 'percentage'
    ? subtotal * Number(coupon.discountValue || 0) / 100
    : Number(coupon.discountValue || 0);
  if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
  return Math.max(0, Math.min(subtotal, Math.floor(discount)));
};

const validateCoupon = async ({ shopId, code, phone, subtotal }) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return { coupon: null, customerVoucher: null, discount: 0 };
  const now = new Date();
  let customerVoucher = await CustomerVoucher.findOne({ shopId, code: normalizedCode }).populate('couponId');
  let coupon = customerVoucher?.couponId || await Coupon.findOne({ shopId, code: normalizedCode });
  if (!coupon || !coupon.isActive) throw Object.assign(new Error('Mã giảm giá không tồn tại hoặc đã tắt'), { statusCode: 400 });
  if (coupon.exchangeable && !customerVoucher) throw Object.assign(new Error('Ưu đãi này phải được đổi bằng xu trước khi sử dụng'), { statusCode: 400 });
  if (coupon.startsAt && coupon.startsAt > now) throw Object.assign(new Error('Mã giảm giá chưa đến thời gian sử dụng'), { statusCode: 400 });
  if (coupon.endsAt && coupon.endsAt < now) throw Object.assign(new Error('Mã giảm giá đã hết hạn'), { statusCode: 400 });
  if (Number(subtotal) < Number(coupon.minOrder || 0)) throw Object.assign(new Error(`Đơn tối thiểu ${Number(coupon.minOrder).toLocaleString('vi-VN')}đ để dùng mã`), { statusCode: 400 });
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) throw Object.assign(new Error('Mã giảm giá đã hết lượt sử dụng'), { statusCode: 400 });
  const normalizedPhone = normalizePhone(phone);
  if (customerVoucher) {
    if (!normalizedPhone || customerVoucher.phone !== normalizedPhone) throw Object.assign(new Error('Voucher này không thuộc số điện thoại đang dùng'), { statusCode: 400 });
    if (customerVoucher.usedAt) throw Object.assign(new Error('Voucher đã được sử dụng'), { statusCode: 400 });
    if (customerVoucher.expiresAt && customerVoucher.expiresAt < now) throw Object.assign(new Error('Voucher đã hết hạn'), { statusCode: 400 });
  } else if (coupon.perPhoneLimit > 0 && normalizedPhone) {
    const used = await Order.countDocuments({ shopId, phone: normalizedPhone, couponCode: normalizedCode, status: { $ne: 'cancelled' } });
    if (used >= coupon.perPhoneLimit) throw Object.assign(new Error('Số điện thoại đã dùng hết lượt của mã này'), { statusCode: 400 });
  }
  return { coupon, customerVoucher, discount: computeCouponDiscount(coupon, Number(subtotal || 0)) };
};

const spendCoins = async ({ shopId, phone, coins, orderId }) => {
  const amount = Math.max(0, Math.floor(Number(coins || 0)));
  if (!amount) return null;
  const account = await LoyaltyAccount.findOneAndUpdate(
    { shopId, phone, coinBalance: { $gte: amount } },
    { $inc: { coinBalance: -amount, totalSpent: amount } },
    { new: true }
  );
  if (!account) throw Object.assign(new Error('Số xu không đủ'), { statusCode: 400 });
  await LoyaltyTransaction.create({ shopId, accountId: account._id, phone, type: 'spend_order', coins: -amount, orderId, note: 'Dùng xu trừ trực tiếp đơn hàng', uniqueKey: `spend-order-${orderId}` });
  return account;
};

const rewardOrderCoins = async (order, shop) => {
  if (!shop?.loyaltyEnabled || !order.loyaltyPhone || order.loyaltyRewardedAt || order.paymentStatus !== 'paid') return order;
  const eligibleAmount = Math.max(0, Number(order.subtotal || 0) - Number(order.couponDiscount || 0) - Number(order.coinDiscount || 0));
  const coins = Math.floor(eligibleAmount * Number(shop.cashbackPercent || 0) / 100);
  order.loyaltyRewardCoins = coins;
  order.loyaltyRewardedAt = new Date();
  await order.save();
  if (!coins) return order;
  const account = await getOrCreateAccount(shop._id, order.loyaltyPhone, true);
  const uniqueKey = `earn-order-${order._id}`;
  try {
    await LoyaltyTransaction.create({ shopId: shop._id, accountId: account._id, phone: order.loyaltyPhone, type: 'earn_order', coins, orderId: order._id, note: `Hoàn ${shop.cashbackPercent || 0}% từ đơn ${order.orderCode}`, uniqueKey });
    await LoyaltyAccount.updateOne({ _id: account._id }, { $inc: { coinBalance: coins, totalEarned: coins } });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return order;
};



const rewardDiningSessionCoins = async ({ session, shop, totalAmount, representativeOrderId = null }) => {
  if (!shop?.loyaltyEnabled || !session?.loyaltyPhone || session.skipLoyalty || session.loyaltyRewardedAt) return session;
  const eligibleAmount = Math.max(0, Number(totalAmount || 0));
  const coins = Math.floor(eligibleAmount * Number(shop.cashbackPercent || 0) / 100);
  session.loyaltyRewardCoins = coins;
  session.loyaltyRewardedAt = new Date();
  if (!coins) {
    await session.save();
    return session;
  }

  const account = await getOrCreateAccount(shop._id, session.loyaltyPhone, true);
  const uniqueKey = `reward-session-${session._id}`;
  try {
    await LoyaltyTransaction.create({
      shopId: shop._id,
      accountId: account._id,
      phone: session.loyaltyPhone,
      type: 'earn_order',
      coins,
      orderId: representativeOrderId || null,
      note: `Hoàn ${shop.cashbackPercent || 0}% từ hóa đơn tổng Bàn ${session.tableNumber}`,
      metadata: { diningSessionId: String(session._id), sessionCode: session.sessionCode },
      uniqueKey
    });
    await LoyaltyAccount.updateOne(
      { _id: account._id },
      { $inc: { coinBalance: coins, totalEarned: coins }, $set: { lastOrderAt: new Date() } }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  await session.save();
  return session;
};

const refundOrderCoins = async (order, shop, note = 'Hoàn xu do đơn không thành công') => {
  const amount = Math.max(0, Number(order.coinsUsed || 0));
  if (!amount || !order.loyaltyPhone) return;
  const uniqueKey = `refund-order-${order._id}`;
  if (await LoyaltyTransaction.exists({ uniqueKey })) return;
  const account = await getOrCreateAccount(shop._id, order.loyaltyPhone, true);
  try {
    await LoyaltyTransaction.create({ shopId: shop._id, accountId: account._id, phone: order.loyaltyPhone, type: 'refund', coins: amount, orderId: order._id, note, uniqueKey });
    await LoyaltyAccount.updateOne({ _id: account._id }, { $inc: { coinBalance: amount, totalSpent: -amount } });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
};


const releaseOrderBenefits = async (order, shop, note = 'Hoàn ưu đãi do đơn không thành công') => {
  if (order.benefitsReleasedAt) return;
  await refundOrderCoins(order, shop, note);
  if (order.customerVoucherId) {
    await CustomerVoucher.updateOne({ _id: order.customerVoucherId, orderId: order._id }, { $set: { usedAt: null, orderId: null } });
  }
  if (order.couponCode) {
    const voucher = order.customerVoucherId ? await CustomerVoucher.findById(order.customerVoucherId) : null;
    const couponQuery = voucher?.couponId ? { _id: voucher.couponId } : { shopId: shop._id, code: order.couponCode };
    await Coupon.updateOne({ ...couponQuery, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  }
  order.benefitsReleasedAt = new Date();
  await order.save();
};

module.exports = {
  vietnamDateKey,
  createLoyaltyToken,
  verifyLoyaltyToken,
  requireVerifiedPhone,
  getOrCreateAccount,
  validateCoupon,
  spendCoins,
  rewardOrderCoins,
  rewardDiningSessionCoins,
  refundOrderCoins,
  releaseOrderBenefits
};
