const Product = require('../models/Product');
const { calculateShipping } = require('./shippingService');
const { validateCoupon, requireVerifiedPhone, verifyLoyaltyToken, getOrCreateAccount } = require('./loyaltyService');
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
  const couponResult = await validateCoupon({ shopId: shop._id, code: couponCode, phone: normalizedPhone, subtotal });
  if (couponResult.customerVoucher) requireVerifiedPhone(req, normalizedPhone);
  const couponDiscount = couponResult.discount || 0;

  let verifiedPhone = '';
  const loyaltyToken = req.headers['x-loyalty-token'] || req.body?.loyaltyToken || '';
  if (normalizedPhone && verifyLoyaltyToken(loyaltyToken, normalizedPhone)) verifiedPhone = normalizedPhone;

  const requestedCoins = Math.max(0, Math.floor(Number(coinsToUse || 0)));
  let coinsUsed = 0;
  let account = null;
  if (requestedCoins > 0) {
    verifiedPhone = requireVerifiedPhone(req, normalizedPhone);
    account = await getOrCreateAccount(shop._id, verifiedPhone, true);
    const beforeCoins = Math.max(0, subtotal - couponDiscount + shipping.fee);
    const maxAllowed = Math.floor(beforeCoins * Number(shop.maxCoinUsePercent || 0) / 100);
    coinsUsed = Math.min(requestedCoins, account.coinBalance, maxAllowed, beforeCoins);
    if (coinsUsed <= 0) throw Object.assign(new Error('Không thể dùng xu cho đơn hàng này'), { statusCode: 400 });
  }

  const totalAmount = Math.max(0, subtotal + shipping.fee - couponDiscount - coinsUsed);
  return {
    products: orderProducts,
    subtotal,
    shipping,
    coupon: couponResult.coupon,
    customerVoucher: couponResult.customerVoucher,
    couponDiscount,
    verifiedPhone,
    account,
    coinsUsed,
    coinDiscount: coinsUsed,
    totalAmount
  };
};

module.exports = { buildOrderPricing };
