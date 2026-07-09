const crypto = require('crypto');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const PlatformSpinConfig = require('../models/PlatformSpinConfig');
const PlatformSpinPlay = require('../models/PlatformSpinPlay');
const PlatformCoinAccount = require('../models/PlatformCoinAccount');
const PlatformCoinTransaction = require('../models/PlatformCoinTransaction');
const PlatformCoupon = require('../models/PlatformCoupon');
const { normalizePhone } = require('../utils/phone');
const { verifyLoyaltyToken, vietnamDateKey } = require('../services/loyaltyService');
const { getOrCreatePlatformAccount } = require('../services/platformCoinService');

const DEFAULT_REWARDS = [10, 20, 50, 100, 200, 500, 1000, 0].map((value) => ({
  label: value ? `${value} xu` : 'Chúc may mắn',
  type: value ? 'coins' : 'none',
  value,
  weight: 1,
  isActive: true
}));

const getSpinConfig = async () => PlatformSpinConfig.findOneAndUpdate(
  { key: 'global' },
  { $setOnInsert: { key: 'global', rewards: DEFAULT_REWARDS } },
  { upsert: true, new: true }
);

const sanitizeReward = (reward = {}, index = 0) => {
  const type = ['coins', 'coupon', 'none'].includes(String(reward.type || '').toLowerCase()) ? String(reward.type).toLowerCase() : 'coins';
  const value = Math.max(0, Math.floor(Number(reward.value || 0)));
  const couponCode = String(reward.couponCode || '').trim().toUpperCase();
  const label = String(reward.label || (type === 'coins' ? `${value} xu` : type === 'coupon' ? `Mã ${couponCode || index + 1}` : 'Chúc may mắn')).trim();
  return {
    label,
    type,
    value: type === 'coins' ? value : 0,
    couponCode: type === 'coupon' ? couponCode : '',
    weight: Math.max(0, Number(reward.weight ?? 1)),
    isActive: reward.isActive !== false
  };
};

const publicCouponQuery = () => {
  const now = new Date();
  return {
    isActive: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }
    ]
  };
};

const chooseReward = (rewards = []) => {
  const pool = rewards.map(sanitizeReward).filter((item) => item.isActive && Number(item.weight || 0) > 0);
  const safePool = pool.length ? pool : DEFAULT_REWARDS;
  const totalWeight = safePool.reduce((sum, item) => sum + Number(item.weight || 0), 0) || safePool.length;
  let random = crypto.randomInt(0, Math.max(1, Math.floor(totalWeight * 1000))) / 1000;
  for (let index = 0; index < safePool.length; index += 1) {
    random -= Number(safePool[index].weight || 0) || 1;
    if (random <= 0) return { reward: safePool[index], rewardIndex: index };
  }
  return { reward: safePool[safePool.length - 1], rewardIndex: safePool.length - 1 };
};

const saleGroups = async () => {
  const products = await Product.find({ isActive: true, salePrice: { $gt: 0 } })
    .populate('shopId', 'name slug logoUrl bannerUrl customDomain approvalStatus isActive loyaltyEnabled cuisine')
    .sort({ updatedAt: -1 })
    .limit(80)
    .lean();
  const map = new Map();
  for (const product of products) {
    const shop = product.shopId;
    if (!shop || !shop.isActive || shop.approvalStatus !== 'approved') continue;
    const key = String(shop._id);
    if (!map.has(key)) map.set(key, { shop, products: [] });
    if (map.get(key).products.length < 8) map.get(key).products.push(product);
  }
  return [...map.values()].slice(0, 12);
};

exports.getPublicMarketing = async (req, res, next) => {
  try {
    const [config, coupons, groups] = await Promise.all([
      getSpinConfig(),
      PlatformCoupon.find(publicCouponQuery()).select('-usedCount').sort({ createdAt: -1 }).limit(20).lean(),
      saleGroups()
    ]);
    return res.json({
      saleGroups: groups,
      spin: {
        enabled: config.enabled,
        title: config.title,
        description: config.description,
        oncePerDay: config.oncePerDay,
        rewards: (config.rewards || DEFAULT_REWARDS).map(sanitizeReward)
      },
      coupons
    });
  } catch (error) { return next(error); }
};

exports.spin = async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const token = req.headers['x-loyalty-token'] || req.body?.loyaltyToken || '';
    if (!phone || !verifyLoyaltyToken(token, phone)) {
      return res.status(401).json({ message: 'Vui lòng xác thực số điện thoại bằng OTP trước khi quay' });
    }
    const config = await getSpinConfig();
    if (!config.enabled) return res.status(400).json({ message: 'Vòng quay đang tạm tắt' });
    const today = vietnamDateKey();
    if (config.oncePerDay && await PlatformSpinPlay.exists({ phone, dateKey: today })) {
      const account = await getOrCreatePlatformAccount(phone, true);
      return res.status(400).json({ message: 'Số điện thoại này đã quay hôm nay', account });
    }

    const { reward, rewardIndex } = chooseReward(config.rewards || DEFAULT_REWARDS);
    const account = await getOrCreatePlatformAccount(phone, true);
    let addedCoins = 0;
    if (reward.type === 'coins' && reward.value > 0) {
      addedCoins = Number(reward.value || 0);
      await PlatformCoinAccount.updateOne(
        { _id: account._id },
        { $inc: { coinBalance: addedCoins, totalEarned: addedCoins }, $set: { lastSpinDate: today } }
      );
      await PlatformCoinTransaction.create({
        phone,
        accountId: account._id,
        type: 'spin',
        coins: addedCoins,
        note: `Vòng quay hệ thống ngày ${today}: +${addedCoins} xu`,
        metadata: { reward, rewardIndex },
        uniqueKey: `platform-spin-${phone}-${today}`
      });
    } else {
      await PlatformCoinAccount.updateOne({ _id: account._id }, { $set: { lastSpinDate: today } });
    }

    await PlatformSpinPlay.create({
      phone,
      dateKey: today,
      rewardIndex,
      reward,
      coins: addedCoins,
      couponCode: reward.type === 'coupon' ? reward.couponCode : '',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
      userAgent: req.headers['user-agent'] || ''
    });

    const nextAccount = await PlatformCoinAccount.findById(account._id);
    return res.json({
      reward,
      rewardIndex,
      coins: addedCoins,
      account: nextAccount,
      message: reward.type === 'coins' && addedCoins
        ? `Chúc mừng bạn nhận ${addedCoins.toLocaleString('vi-VN')} xu hệ thống`
        : reward.type === 'coupon' && reward.couponCode
          ? `Bạn nhận mã ${reward.couponCode}`
          : 'Chúc bạn may mắn lần sau'
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(400).json({ message: 'Số điện thoại này đã quay hôm nay' });
    return next(error);
  }
};

exports.getAdminMarketing = async (req, res, next) => {
  try {
    const [config, coupons, shops] = await Promise.all([
      getSpinConfig(),
      PlatformCoupon.find().sort({ createdAt: -1 }).populate('shopIds', 'name slug').lean(),
      Shop.find({ approvalStatus: 'approved' }).select('name slug logoUrl isActive loyaltyEnabled').sort({ name: 1 }).lean()
    ]);
    return res.json({ config, coupons, shops });
  } catch (error) { return next(error); }
};

exports.updateSpinConfig = async (req, res, next) => {
  try {
    const rewards = Array.isArray(req.body.rewards) ? req.body.rewards.map(sanitizeReward).slice(0, 12) : DEFAULT_REWARDS;
    const config = await PlatformSpinConfig.findOneAndUpdate(
      { key: 'global' },
      {
        $set: {
          enabled: req.body.enabled !== false,
          title: String(req.body.title || 'Vòng quay nhận xu toàn hệ thống').trim(),
          description: String(req.body.description || 'Xu có thể dùng tại các shop bật tích xu.').trim(),
          oncePerDay: req.body.oncePerDay !== false,
          rewards: rewards.length ? rewards : DEFAULT_REWARDS
        }
      },
      { upsert: true, new: true, runValidators: true }
    );
    return res.json({ config });
  } catch (error) { return next(error); }
};

const couponPayload = (body = {}) => ({
  code: String(body.code || '').trim().toUpperCase(),
  title: String(body.title || '').trim(),
  description: body.description || '',
  discountType: body.discountType === 'percentage' ? 'percentage' : 'fixed',
  discountValue: Number(body.discountValue || 0),
  maxDiscount: Number(body.maxDiscount || 0),
  minOrder: Number(body.minOrder || 0),
  startsAt: body.startsAt || null,
  endsAt: body.endsAt || null,
  usageLimit: Number(body.usageLimit || 0),
  perPhoneLimit: Math.max(0, Number(body.perPhoneLimit ?? 1)),
  appliesToAll: body.appliesToAll !== false,
  shopIds: body.appliesToAll === false ? (Array.isArray(body.shopIds) ? body.shopIds : []) : [],
  isActive: body.isActive !== false
});

exports.createCoupon = async (req, res, next) => {
  try {
    const payload = couponPayload(req.body);
    if (!payload.code || !payload.title || payload.discountValue <= 0) {
      return res.status(400).json({ message: 'Vui lòng nhập mã, tên ưu đãi và giá trị giảm' });
    }
    const coupon = await PlatformCoupon.create(payload);
    return res.status(201).json({ coupon });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Mã giảm giá hệ thống đã tồn tại' });
    return next(error);
  }
};

exports.updateCoupon = async (req, res, next) => {
  try {
    const coupon = await PlatformCoupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Không tìm thấy mã giảm giá hệ thống' });
    Object.assign(coupon, couponPayload({ ...coupon.toObject(), ...req.body, code: coupon.code }));
    await coupon.save();
    return res.json({ coupon });
  } catch (error) { return next(error); }
};

exports.deleteCoupon = async (req, res, next) => {
  try {
    await PlatformCoupon.deleteOne({ _id: req.params.id });
    return res.json({ success: true });
  } catch (error) { return next(error); }
};
