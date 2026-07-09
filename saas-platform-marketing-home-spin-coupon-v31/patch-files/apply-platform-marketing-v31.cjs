const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patchRoot = __dirname;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(root, 'patch-backups', `platform-marketing-v31-${stamp}`);

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, content) => {
  const full = path.join(root, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (fs.existsSync(full)) {
    fs.mkdirSync(path.dirname(path.join(backupDir, p)), { recursive: true });
    fs.copyFileSync(full, path.join(backupDir, p));
  }
  fs.writeFileSync(full, content, 'utf8');
  console.log('[OK] Wrote', p);
};
const copyPatch = (from, to) => write(to, fs.readFileSync(path.join(patchRoot, from), 'utf8'));
const replaceOnce = (content, search, replacement, label) => {
  if (!content.includes(search)) throw new Error(`Không tìm thấy đoạn cần sửa: ${label}`);
  return content.replace(search, replacement);
};
const insertAfter = (content, search, insertion, marker) => {
  if (content.includes(marker)) return content;
  if (!content.includes(search)) throw new Error(`Không tìm thấy vị trí chèn: ${search.slice(0, 80)}`);
  return content.replace(search, `${search}${insertion}`);
};
const insertBefore = (content, search, insertion, marker) => {
  if (content.includes(marker)) return content;
  if (!content.includes(search)) throw new Error(`Không tìm thấy vị trí chèn: ${search.slice(0, 80)}`);
  return content.replace(search, `${insertion}${search}`);
};

copyPatch('backend/models/PlatformCoinAccount.js', 'backend/models/PlatformCoinAccount.js');
copyPatch('backend/models/PlatformCoinTransaction.js', 'backend/models/PlatformCoinTransaction.js');
copyPatch('backend/models/PlatformSpinConfig.js', 'backend/models/PlatformSpinConfig.js');
copyPatch('backend/models/PlatformSpinPlay.js', 'backend/models/PlatformSpinPlay.js');
copyPatch('backend/models/PlatformCoupon.js', 'backend/models/PlatformCoupon.js');
copyPatch('backend/services/platformCoinService.js', 'backend/services/platformCoinService.js');
copyPatch('backend/controllers/platformMarketingController.js', 'backend/controllers/platformMarketingController.js');
copyPatch('backend/routes/platformMarketingRoutes.js', 'backend/routes/platformMarketingRoutes.js');
copyPatch('frontend/src/components/PlatformMarketingHome.jsx', 'frontend/src/components/PlatformMarketingHome.jsx');
copyPatch('frontend/src/components/PlatformMarketingPanel.jsx', 'frontend/src/components/PlatformMarketingPanel.jsx');

// server.js: gắn route /api/platform
{
  let file = 'backend/server.js';
  let s = read(file);
  if (!s.includes("./routes/platformMarketingRoutes")) {
    s = s.replace("const loyaltyRoutes = require('./routes/loyaltyRoutes');", "const loyaltyRoutes = require('./routes/loyaltyRoutes');\nconst platformMarketingRoutes = require('./routes/platformMarketingRoutes');");
  }
  if (!s.includes("app.use('/api/platform', platformMarketingRoutes);")) {
    s = s.replace("app.use('/api/loyalty', loyaltyRoutes);", "app.use('/api/loyalty', loyaltyRoutes);\napp.use('/api/platform', platformMarketingRoutes);");
  }
  write(file, s);
}

// Order model: thêm field theo dõi xu hệ thống và coupon hệ thống.
{
  let file = 'backend/models/Order.js';
  let s = read(file);
  if (!s.includes('platformCoinsUsed')) {
    s = replaceOnce(s,
      "    coinsUsed: { type: Number, default: 0, min: 0 },\n    coinDiscount: { type: Number, default: 0, min: 0 },",
      "    coinsUsed: { type: Number, default: 0, min: 0 },\n    shopCoinsUsed: { type: Number, default: 0, min: 0 },\n    platformCoinsUsed: { type: Number, default: 0, min: 0 },\n    coinDiscount: { type: Number, default: 0, min: 0 },",
      'Order coin fields'
    );
  }
  if (!s.includes('platformCouponId')) {
    s = replaceOnce(s,
      "    customerVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerVoucher', default: null },",
      "    customerVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerVoucher', default: null },\n    platformCouponId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformCoupon', default: null },",
      'Order platformCouponId'
    );
  }
  write(file, s);
}

// orderPricingService.js: hỗ trợ coupon hệ thống + ví xu hệ thống dùng chung.
{
  const file = 'backend/services/orderPricingService.js';
  const s = `const Product = require('../models/Product');
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
`;
  write(file, s);
}

// orderController.js: trừ xu hệ thống, tăng usedCount coupon hệ thống, trả thêm thông tin quote.
{
  let file = 'backend/controllers/orderController.js';
  let s = read(file);
  if (!s.includes("require('../services/platformCoinService')")) {
    s = s.replace(
      "const { spendCoins, rewardOrderCoins, rewardDiningSessionCoins, releaseOrderBenefits } = require('../services/loyaltyService');",
      "const { spendCoins, rewardOrderCoins, rewardDiningSessionCoins, releaseOrderBenefits } = require('../services/loyaltyService');\nconst { spendPlatformCoins } = require('../services/platformCoinService');"
    );
  }
  if (!s.includes("require('../models/PlatformCoupon')")) {
    s = s.replace("const CustomerVoucher = require('../models/CustomerVoucher');", "const CustomerVoucher = require('../models/CustomerVoucher');\nconst PlatformCoupon = require('../models/PlatformCoupon');");
  }
  if (!s.includes('platformCoinBalance:')) {
    s = s.replace(
      "      coinRate: 1\n    });",
      "      coinRate: 1,\n      platformCoinBalance: pricing.platformAccount?.coinBalance || 0,\n      shopCoinBalance: pricing.account?.coinBalance || 0,\n      platformCoinsUsed: pricing.platformCoinsUsed || 0,\n      shopCoinsUsed: pricing.shopCoinsUsed || 0,\n      isPlatformCoupon: Boolean(pricing.isPlatformCoupon)\n    });"
    );
  }
  if (!s.includes('platformCouponId: pricing.platformCoupon')) {
    s = s.replace(
      "      customerVoucherId: pricing.customerVoucher?._id || null,\n      loyaltyPhone:",
      "      customerVoucherId: pricing.customerVoucher?._id || null,\n      platformCouponId: pricing.platformCoupon?._id || null,\n      loyaltyPhone:"
    );
  }
  if (!s.includes('shopCoinsUsed: pricing.shopCoinsUsed')) {
    s = s.replace(
      "      coinsUsed: pricing.coinsUsed,\n      coinDiscount:",
      "      coinsUsed: pricing.coinsUsed,\n      shopCoinsUsed: pricing.shopCoinsUsed || 0,\n      platformCoinsUsed: pricing.platformCoinsUsed || 0,\n      coinDiscount:"
    );
  }
  if (!s.includes('spendPlatformCoins({')) {
    s = s.replace(
      "    if (pricing.coinsUsed > 0) {\n      await spendCoins({ shopId: shop._id, phone: pricing.verifiedPhone, coins: pricing.coinsUsed, orderId: createdOrder._id });\n    }",
      "    if (pricing.coinsUsed > 0) {\n      if (pricing.platformCoinsUsed > 0) {\n        await spendPlatformCoins({ shopId: shop._id, phone: pricing.verifiedPhone, coins: pricing.platformCoinsUsed, orderId: createdOrder._id });\n      }\n      if (pricing.shopCoinsUsed > 0) {\n        await spendCoins({ shopId: shop._id, phone: pricing.verifiedPhone, coins: pricing.shopCoinsUsed, orderId: createdOrder._id });\n      }\n    }"
    );
  }
  if (!s.includes('pricing.platformCoupon')) {
    // If the earlier patch did not insert because of formatting, this marker may be absent. No-op here.
  }
  if (!s.includes('PlatformCoupon.updateOne')) {
    s = s.replace(
      "    if (pricing.coupon) await Coupon.updateOne({ _id: pricing.coupon._id }, { $inc: { usedCount: 1 } });",
      "    if (pricing.isPlatformCoupon && pricing.platformCoupon) await PlatformCoupon.updateOne({ _id: pricing.platformCoupon._id }, { $inc: { usedCount: 1 } });\n    else if (pricing.coupon) await Coupon.updateOne({ _id: pricing.coupon._id }, { $inc: { usedCount: 1 } });"
    );
  }
  write(file, s);
}

// loyaltyService.js: khi hủy/hoàn đơn, hoàn lại phần xu hệ thống và chỉ hoàn shopCoinsUsed về ví shop.
{
  let file = 'backend/services/loyaltyService.js';
  let s = read(file);
  if (!s.includes("require('./platformCoinService')")) {
    s = s.replace("const { normalizePhone } = require('../utils/phone');", "const { normalizePhone } = require('../utils/phone');\nconst { refundPlatformCoinsForOrder } = require('./platformCoinService');");
  }
  if (!s.includes('const amount = Math.max(0, Number(order.shopCoinsUsed')) {
    s = s.replace(
      "  const amount = Math.max(0, Number(order.coinsUsed || 0));",
      "  const amount = Math.max(0, Number(order.shopCoinsUsed ?? (Number(order.coinsUsed || 0) - Number(order.platformCoinsUsed || 0))));"
    );
  }
  if (!s.includes('refundPlatformCoinsForOrder(order')) {
    s = s.replace(
      "  await refundOrderCoins(order, shop, note);",
      "  await refundPlatformCoinsForOrder(order, note);\n  await refundOrderCoins(order, shop, note);"
    );
  }
  if (!s.includes('PlatformCoupon')) {
    s = s.replace("const Coupon = require('../models/Coupon');", "const Coupon = require('../models/Coupon');\nconst PlatformCoupon = require('../models/PlatformCoupon');");
  }
  if (!s.includes('order.platformCouponId')) {
    s = s.replace(
      "  if (order.couponCode) {\n    const voucher = order.customerVoucherId ? await CustomerVoucher.findById(order.customerVoucherId) : null;\n    const couponQuery = voucher?.couponId ? { _id: voucher.couponId } : { shopId: shop._id, code: order.couponCode };\n    await Coupon.updateOne({ ...couponQuery, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });\n  }",
      "  if (order.couponCode) {\n    const voucher = order.customerVoucherId ? await CustomerVoucher.findById(order.customerVoucherId) : null;\n    if (order.platformCouponId) {\n      await PlatformCoupon.updateOne({ _id: order.platformCouponId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });\n    } else {\n      const couponQuery = voucher?.couponId ? { _id: voucher.couponId } : { shopId: shop._id, code: order.couponCode };\n      await Coupon.updateOne({ ...couponQuery, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });\n    }\n  }"
    );
  }
  write(file, s);
}

// loyaltyController.js: ví checkout hiển thị tổng xu shop + xu hệ thống.
{
  let file = 'backend/controllers/loyaltyController.js';
  let s = read(file);
  if (!s.includes('PlatformCoinAccount')) {
    s = s.replace("const LoyaltyTransaction = require('../models/LoyaltyTransaction');", "const LoyaltyTransaction = require('../models/LoyaltyTransaction');\nconst PlatformCoinAccount = require('../models/PlatformCoinAccount');");
  }
  if (!s.includes('platformAccount = await PlatformCoinAccount')) {
    s = s.replace(
      "    const account = await getOrCreateAccount(shop._id, phone, true);\n    const vouchers = await CustomerVoucher.find",
      "    const account = await getOrCreateAccount(shop._id, phone, true);\n    const platformAccount = await PlatformCoinAccount.findOne({ phone });\n    const mergedAccount = {\n      ...(account.toObject ? account.toObject() : account),\n      shopCoinBalance: Number(account.coinBalance || 0),\n      platformCoinBalance: Number(platformAccount?.coinBalance || 0),\n      coinBalance: Number(account.coinBalance || 0) + Number(platformAccount?.coinBalance || 0)\n    };\n    const vouchers = await CustomerVoucher.find"
    );
    s = s.replace(
      "return res.json({ account, vouchers, rewards, coinRate: 1, canSpinToday: account.lastSpinDate !== vietnamDateKey(), spinRewards: normalizeSpinRewards(shop.spinRewards) });",
      "return res.json({ account: mergedAccount, vouchers, rewards, coinRate: 1, canSpinToday: account.lastSpinDate !== vietnamDateKey(), spinRewards: normalizeSpinRewards(shop.spinRewards), platformAccount });"
    );
  }
  write(file, s);
}

// Home.jsx: thêm khối sản phẩm sale + vòng quay trang chủ.
{
  let file = 'frontend/src/pages/Home.jsx';
  let s = read(file);
  if (!s.includes("PlatformMarketingHome")) {
    s = s.replace("import api from '../api/axios.js';", "import api from '../api/axios.js';\nimport PlatformMarketingHome from '../components/PlatformMarketingHome.jsx';");
  }
  if (!s.includes('<PlatformMarketingHome />')) {
    s = s.replace("      {/* --- MERCHANTS SECTION --- */}", "      <PlatformMarketingHome />\n\n      {/* --- MERCHANTS SECTION --- */}");
  }
  write(file, s);
}

// AdminDashboard.jsx: thêm tab Marketing hệ thống và component quản trị.
{
  let file = 'frontend/src/pages/AdminDashboard.jsx';
  let s = read(file);
  if (!s.includes("PlatformMarketingPanel")) {
    s = s.replace("import Pagination from '../components/Pagination.jsx';", "import Pagination from '../components/Pagination.jsx';\nimport PlatformMarketingPanel from '../components/PlatformMarketingPanel.jsx';");
  }
  if (!s.includes("['marketing'")) {
    s = s.replace("    ['orders', 'orders', 'Đơn hàng'],", "    ['orders', 'orders', 'Đơn hàng'],\n    ['marketing', 'revenue', 'Marketing'],");
  }
  if (!s.includes("tab === 'marketing'")) {
    s = s.replace(
      "            {tab === 'users' && (",
      "            {tab === 'marketing' && (\n              <PlatformMarketingPanel onToast={setToast} onError={showError} />\n            )}\n\n            {tab === 'users' && ("
    );
  }
  write(file, s);
}

console.log('\n[DONE] v31 đã thêm sản phẩm sale trang chủ, vòng quay xu toàn hệ thống, mã giảm giá toàn hệ thống và quản trị Marketing cho admin tổng.');
