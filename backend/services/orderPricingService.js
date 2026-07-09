const Product = require('../models/Product');
const { calculateShipping } = require('./shippingService');
const { validateCoupon, requireVerifiedPhone, verifyLoyaltyToken, getOrCreateAccount } = require('./loyaltyService');
const { validatePlatformCoupon, getOrCreatePlatformAccount } = require('./platformCoinService');
const { normalizePhone } = require('../utils/phone');

const buildOrderPricing = async ({ req, shop, items, orderType, phone, couponCode, coinsToUse, customerLatitude, customerLongitude }) => {
  const productIds = [...new Set((items || []).map((item) => String(item.productId)))];
  const products = await Product.find({ _id: { $in: productIds }, shopId: shop._id, isActive: true });
  if (!productIds.length || products.length !== productIds.length) {
    throw Object.assign(new Error('Có sản phẩm không hợp lệ trong giỏ hàng'), { statusCode: 400 });
  }
  const orderProducts = [];
  let subtotal = 0;
  for (const item of items) {
    const product = products.find((entry) => String(entry._id) === String(item.productId));
    const quantity = Math.max(1, Math.min(999, Number(item.quantity || 1)));
    const finalPrice = product.salePrice > 0 ? product.salePrice : product.price;
    orderProducts.push({ productId: product._id, name: product.name, price: finalPrice, quantity, image: product.images[0] || '' });
    subtotal += finalPrice * quantity;
  }

  let shipping = { fee: 0, distanceKm: 0, mode: 'none' };
  if (['delivery', 'shipping'].includes(orderType)) {
    shipping = await calculateShipping(shop, customerLatitude, customerLongitude);
  }

  const normalizedPhone = normalizePhone(phone);
  let couponResult = { coupon: null, customerVoucher: null, discount: 0 };
  let platformCouponResult = { coupon: null, discount: 0, isPlatformCoupon: false };
  if (String(couponCode || '').trim()) {
    try {
      couponResult = await validateCoupon({ shopId: shop._id, code: couponCode, phone: normalizedPhone, subtotal });
    } catch (error) {
      platformCouponResult = await validatePlatformCoupon({ shopId: shop._id, code: couponCode, phone: normalizedPhone, subtotal });
      if (!platformCouponResult.coupon) throw error;
    }
  }
  if (couponResult.customerVoucher) requireVerifiedPhone(req, normalizedPhone);
  const couponDiscount = Number(couponResult.discount || platformCouponResult.discount || 0);

  let verifiedPhone = '';
  const loyaltyToken = req.headers['x-loyalty-token'] || req.body?.loyaltyToken || '';
  if (normalizedPhone && verifyLoyaltyToken(loyaltyToken, normalizedPhone)) verifiedPhone = normalizedPhone;

  const requestedCoins = Math.max(0, Math.floor(Number(coinsToUse || 0)));
  let coinsUsed = 0;
  let shopCoinsUsed = 0;
  let platformCoinsUsed = 0;
  let account = null;
  let platformAccount = null;
  if (requestedCoins > 0) {
    if (!shop.loyaltyEnabled) throw Object.assign(new Error('Shop này chưa bật tích xu nên không thể dùng xu'), { statusCode: 400 });
    verifiedPhone = requireVerifiedPhone(req, normalizedPhone);
    account = await getOrCreateAccount(shop._id, verifiedPhone, true);
    platformAccount = await getOrCreatePlatformAccount(verifiedPhone, true);
    const beforeCoins = Math.max(0, subtotal - couponDiscount + shipping.fee);
    const maxAllowed = Math.floor(beforeCoins * Number(shop.maxCoinUsePercent || 0) / 100);
    const platformBalance = Number(platformAccount?.coinBalance || 0);
    const shopBalance = Number(account?.coinBalance || 0);
    coinsUsed = Math.min(requestedCoins, platformBalance + shopBalance, maxAllowed, beforeCoins);
    platformCoinsUsed = Math.min(coinsUsed, platformBalance);
    shopCoinsUsed = Math.max(0, coinsUsed - platformCoinsUsed);
    if (coinsUsed <= 0) throw Object.assign(new Error('Không thể dùng xu cho đơn hàng này'), { statusCode: 400 });
  }

  const totalAmount = Math.max(0, subtotal + shipping.fee - couponDiscount - coinsUsed);
  return {
    products: orderProducts,
    subtotal,
    shipping,
    coupon: couponResult.coupon || platformCouponResult.coupon,
    platformCoupon: platformCouponResult.coupon || null,
    isPlatformCoupon: Boolean(platformCouponResult.coupon),
    customerVoucher: couponResult.customerVoucher,
    couponDiscount,
    verifiedPhone,
    account,
    platformAccount,
    coinsUsed,
    shopCoinsUsed,
    platformCoinsUsed,
    coinDiscount: coinsUsed,
    totalAmount
  };
};

module.exports = { buildOrderPricing };
