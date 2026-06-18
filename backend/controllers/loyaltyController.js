const crypto = require('crypto');
const Shop = require('../models/Shop');
const Coupon = require('../models/Coupon');
const CustomerVoucher = require('../models/CustomerVoucher');
const LoyaltyAccount = require('../models/LoyaltyAccount');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const { requestOtp, verifyOtp } = require('../services/otpService');
const { normalizePhone } = require('../utils/phone');
const { parsePagination, buildPagination, escapeRegex } = require('../utils/query');
const {
  vietnamDateKey,
  createLoyaltyToken,
  requireVerifiedPhone,
  getOrCreateAccount,
  validateCoupon
} = require('../services/loyaltyService');

const getSellerShop = async (user) => {
  const shop = await Shop.findOne({ ownerId: user._id });
  if (!shop) throw Object.assign(new Error('Bạn chưa có cửa hàng'), { statusCode: 400 });
  return shop;
};

const DEFAULT_SPIN_REWARDS = [10, 20, 50, 100, 200, 500, 1000, 0];
const parseSpinReward = (value) => {
  if (typeof value === 'string') {
    const text = value.trim().replace(/\s+/g, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, ''));
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
};
const normalizeSpinRewards = (values) => {
  const source = Array.isArray(values) ? values : [];
  return Array.from({ length: 8 }, (_, index) => parseSpinReward(source[index]));
};
const publicShop = async (slug) => {
  const shop = await Shop.findOne({ slug, isActive: true });
  if (!shop) throw Object.assign(new Error('Không tìm thấy cửa hàng'), { statusCode: 404 });
  return shop;
};

exports.requestOtp = async (req, res, next) => {
  try { return res.json(await requestOtp(req.body.phone)); } catch (error) { return next(error); }
};
exports.verifyOtp = async (req, res, next) => {
  try {
    const phone = await verifyOtp(req.body.phone, req.body.code);
    return res.json({ phone, loyaltyToken: createLoyaltyToken(phone), message: 'Xác thực số điện thoại thành công' });
  } catch (error) { return next(error); }
};

exports.getWallet = async (req, res, next) => {
  try {
    const shop = await publicShop(req.params.shopSlug);
    const phone = requireVerifiedPhone(req, req.query.phone);
    const account = await getOrCreateAccount(shop._id, phone, true);
    const vouchers = await CustomerVoucher.find({ shopId: shop._id, phone, usedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).populate('couponId').sort({ createdAt: -1 });
    const rewards = await Coupon.find({ shopId: shop._id, isActive: true, exchangeable: true, coinCost: { $gt: 0 } }).sort({ coinCost: 1 });
    return res.json({ account, vouchers, rewards, coinRate: 1, canSpinToday: account.lastSpinDate !== vietnamDateKey(), spinRewards: normalizeSpinRewards(shop.spinRewards) });
  } catch (error) { return next(error); }
};

exports.spin = async (req, res, next) => {
  try {
    const shop = await publicShop(req.params.shopSlug);
    if (!shop.loyaltyEnabled || !shop.dailySpinEnabled) return res.status(400).json({ message: 'Cửa hàng chưa bật vòng quay hằng ngày' });
    const phone = requireVerifiedPhone(req, req.body.phone);
    const account = await getOrCreateAccount(shop._id, phone, true);
    const today = vietnamDateKey();
    if (account.lastSpinDate === today) return res.status(400).json({ message: 'Số điện thoại này đã quay hôm nay' });
    // Bánh xe luôn có đúng 8 ô. Server là nguồn sự thật duy nhất về
    // cả vị trí ô trúng lẫn số xu được cộng.
    const rewards = normalizeSpinRewards(shop.spinRewards);
    const rewardIndex = crypto.randomInt(0, 8);
    const reward = Number(rewards[rewardIndex] || 0);
    const previousSpinDate = account.lastSpinDate || '';

    const updated = await LoyaltyAccount.findOneAndUpdate(
      { _id: account._id, lastSpinDate: { $ne: today } },
      { $set: { lastSpinDate: today }, $inc: { coinBalance: reward, totalEarned: reward } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(400).json({ message: 'Số điện thoại này đã quay hôm nay' });

    try {
      await LoyaltyTransaction.create({
        shopId: shop._id,
        accountId: account._id,
        phone,
        type: 'spin',
        coins: reward,
        note: `Vòng quay ngày ${today}: +${reward} xu`,
        metadata: { rewardIndex, reward, rewards, slotNumber: rewardIndex + 1 },
        uniqueKey: `spin-${shop._id}-${phone}-${today}`
      });
    } catch (transactionError) {
      // Nếu ghi lịch sử thất bại thì hoàn tác số dư để không tạo trạng thái nửa vời.
      await LoyaltyAccount.updateOne(
        { _id: account._id, lastSpinDate: today },
        { $set: { lastSpinDate: previousSpinDate }, $inc: { coinBalance: -reward, totalEarned: -reward } }
      ).catch(() => null);
      throw transactionError;
    }

    return res.json({
      reward,
      rewardIndex,
      rewardSlot: { index: rewardIndex, number: rewardIndex + 1, value: reward },
      spinRewards: rewards,
      newBalance: updated.coinBalance,
      account: updated,
      message: reward
        ? `Chúc mừng bạn nhận ${reward.toLocaleString('vi-VN')} xu`
        : 'Chúc bạn may mắn vào ngày mai'
    });
  } catch (error) { return next(error); }
};

exports.exchangeVoucher = async (req, res, next) => {
  try {
    const shop = await publicShop(req.params.shopSlug);
    const phone = requireVerifiedPhone(req, req.body.phone);
    const coupon = await Coupon.findOne({ _id: req.body.couponId, shopId: shop._id, isActive: true, exchangeable: true, coinCost: { $gt: 0 } });
    if (!coupon) return res.status(404).json({ message: 'Ưu đãi đổi xu không tồn tại' });
    const account = await LoyaltyAccount.findOneAndUpdate({ shopId: shop._id, phone, coinBalance: { $gte: coupon.coinCost } }, { $inc: { coinBalance: -coupon.coinCost, totalSpent: coupon.coinCost } }, { new: true });
    if (!account) return res.status(400).json({ message: 'Bạn không đủ xu để đổi voucher này' });
    const uniqueCode = `${coupon.code.slice(0, 10)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const voucher = await CustomerVoucher.create({ shopId: shop._id, couponId: coupon._id, phone, code: uniqueCode, expiresAt: coupon.endsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    await LoyaltyTransaction.create({ shopId: shop._id, accountId: account._id, phone, type: 'exchange_voucher', coins: -coupon.coinCost, couponId: coupon._id, note: `Đổi voucher ${coupon.title}`, uniqueKey: `exchange-${voucher._id}` });
    return res.json({ voucher, account, message: `Đã đổi voucher ${uniqueCode}` });
  } catch (error) { return next(error); }
};

exports.validateCoupon = async (req, res, next) => {
  try {
    const shop = await publicShop(req.params.shopSlug);
    const phone = normalizePhone(req.body.phone);
    if (req.body.requireVerified) requireVerifiedPhone(req, phone);
    const result = await validateCoupon({ shopId: shop._id, code: req.body.code, phone, subtotal: Number(req.body.subtotal || 0) });
    return res.json({ coupon: result.coupon, discount: result.discount, customerVoucher: result.customerVoucher });
  } catch (error) { return next(error); }
};

exports.getPublicOffers = async (req, res, next) => {
  try {
    const shop = await publicShop(req.params.shopSlug);
    const now = new Date();
    const coupons = await Coupon.find({ shopId: shop._id, isActive: true, $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }] }).select('-usedCount').sort({ createdAt: -1 }).limit(20);
    return res.json({ coupons, loyalty: { enabled: shop.loyaltyEnabled !== false, cashbackPercent: shop.cashbackPercent, maxCoinUsePercent: shop.maxCoinUsePercent, dailySpinEnabled: shop.dailySpinEnabled, coinRate: 1 } });
  } catch (error) { return next(error); }
};

exports.getSellerOverview = async (req, res, next) => {
  try {
    const shop = await getSellerShop(req.user);
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
    const search = String(req.query.search || '').trim();
    const walletQuery = { shopId: shop._id };
    if (search) walletQuery.phone = new RegExp(escapeRegex(search), 'i');
    const [coupons, wallets, walletTotal, txs] = await Promise.all([
      Coupon.find({ shopId: shop._id }).sort({ createdAt: -1 }),
      LoyaltyAccount.find(walletQuery).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      LoyaltyAccount.countDocuments(walletQuery),
      LoyaltyTransaction.find({ shopId: shop._id }).sort({ createdAt: -1 }).limit(20)
    ]);
    return res.json({ shop, coupons, wallets, transactions: txs, pagination: buildPagination({ page, limit, total: walletTotal }) });
  } catch (error) { return next(error); }
};

exports.createCoupon = async (req, res, next) => {
  try {
    const shop = await getSellerShop(req.user);
    const payload = {
      shopId: shop._id,
      code: String(req.body.code || '').trim().toUpperCase(),
      title: String(req.body.title || '').trim(),
      description: req.body.description || '',
      discountType: req.body.discountType === 'percentage' ? 'percentage' : 'fixed',
      discountValue: Number(req.body.discountValue || 0),
      maxDiscount: Number(req.body.maxDiscount || 0),
      minOrder: Number(req.body.minOrder || 0),
      startsAt: req.body.startsAt || null,
      endsAt: req.body.endsAt || null,
      usageLimit: Number(req.body.usageLimit || 0),
      perPhoneLimit: Math.max(1, Number(req.body.perPhoneLimit || 1)),
      exchangeable: Boolean(req.body.exchangeable),
      coinCost: Number(req.body.coinCost || 0),
      isActive: req.body.isActive !== false
    };
    if (!payload.code || !payload.title || payload.discountValue <= 0) return res.status(400).json({ message: 'Vui lòng nhập mã, tên ưu đãi và giá trị giảm' });
    const coupon = await Coupon.create(payload);
    return res.status(201).json({ coupon });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Mã giảm giá đã tồn tại' });
    return next(error);
  }
};

exports.updateCoupon = async (req, res, next) => {
  try {
    const shop = await getSellerShop(req.user);
    const coupon = await Coupon.findOne({ _id: req.params.id, shopId: shop._id });
    if (!coupon) return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
    const fields = ['title', 'description', 'discountType', 'discountValue', 'maxDiscount', 'minOrder', 'startsAt', 'endsAt', 'usageLimit', 'perPhoneLimit', 'exchangeable', 'coinCost', 'isActive'];
    fields.forEach((field) => { if (req.body[field] !== undefined) coupon[field] = req.body[field] === '' ? null : req.body[field]; });
    await coupon.save();
    return res.json({ coupon });
  } catch (error) { return next(error); }
};
