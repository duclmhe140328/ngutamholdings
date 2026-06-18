const slugify = require('slugify');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const { syncDiningTables } = require('../services/tableService');
const { emitToAdmins } = require('../realtime');
const { normalizeDomain, getRequestHost, approvedCondition, isApproved } = require('../utils/shopAccess');

const makeSlug = (text) => slugify(text || '', { lower: true, strict: true, locale: 'vi', trim: true });

const listValue = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
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
  const source = Array.isArray(values) ? values : listValue(values);
  return Array.from({ length: 8 }, (_, index) => parseSpinReward(source[index]));
};

const normalizeSetup = (payload) => {
  const businessType = payload.businessType === 'restaurant' ? 'restaurant' : 'retail';
  const allowedModes = businessType === 'restaurant'
    ? ['dine_in', 'delivery', 'pickup']
    : ['shipping', 'pickup'];
  let serviceModes = listValue(payload.serviceModes).filter((item) => allowedModes.includes(item));
  if (!serviceModes.length) serviceModes = [businessType === 'restaurant' ? 'delivery' : 'shipping'];

  let paymentMethods = listValue(payload.paymentMethods).filter((item) =>
    ['cash', 'bank_transfer', 'vnpay'].includes(item)
  );
  if (!paymentMethods.length) paymentMethods = ['cash'];

  const numberOfTables = businessType === 'restaurant' && serviceModes.includes('dine_in')
    ? Math.max(1, Math.min(500, Number(payload.numberOfTables || 1)))
    : 0;

  return { businessType, serviceModes, paymentMethods, numberOfTables };
};

const validateBank = (setup, payload) => {
  if (
    setup.paymentMethods.includes('bank_transfer') &&
    (!payload.bankAccountName || !payload.bankAccountNumber || !payload.bankName)
  ) {
    return 'Vui lòng nhập đủ tên tài khoản, số tài khoản và ngân hàng để nhận chuyển khoản';
  }
  return '';
};

const publicShopQuery = (extra = {}) => ({
  ...extra,
  isActive: true,
  ...approvedCondition
});

exports.createShop = async (req, res, next) => {
  try {
    const { name, slug } = req.body;
    if (!name) return res.status(400).json({ message: 'Vui lòng nhập tên cửa hàng' });

    const existedShopOfOwner = await Shop.findOne({ ownerId: req.user._id });
    if (existedShopOfOwner && req.user.role !== 'admin') {
      return res.status(400).json({ message: 'Mỗi tài khoản seller chỉ tạo một cửa hàng' });
    }

    const finalSlug = makeSlug(slug || name);
    if (!finalSlug) return res.status(400).json({ message: 'Đường dẫn cửa hàng không hợp lệ' });
    if (await Shop.findOne({ slug: finalSlug })) {
      return res.status(400).json({ message: 'Đường dẫn cửa hàng đã tồn tại' });
    }

    const setup = normalizeSetup(req.body);
    const bankError = validateBank(setup, req.body);
    if (bankError) return res.status(400).json({ message: bankError });

    const isAdmin = req.user.role === 'admin';
    const customDomain = normalizeDomain(req.body.customDomain);
    if (customDomain && await Shop.findOne({ customDomain })) {
      return res.status(400).json({ message: 'Domain này đã được một cửa hàng khác sử dụng' });
    }

    const shop = await Shop.create({
      ownerId: req.user._id,
      name,
      slug: finalSlug,
      ...setup,
      bankAccountName: req.body.bankAccountName || '',
      bankAccountNumber: req.body.bankAccountNumber || '',
      bankName: req.body.bankName || '',
      legalName: req.body.legalName || name,
      taxCode: req.body.taxCode || '',
      invoiceAddress: req.body.invoiceAddress || req.body.address || '',
      invoiceEmail: req.body.invoiceEmail || req.user.email || '',
      invoicePhone: req.body.invoicePhone || req.body.phone || '',
      defaultVatRate: ['KCT', '0', '5', '8', '10'].includes(String(req.body.defaultVatRate || '0')) ? String(req.body.defaultVatRate || '0') : '0',
      invoiceProviderName: req.body.invoiceProviderName || '',
      invoiceLookupUrl: req.body.invoiceLookupUrl || '',
      logoUrl: req.body.logoUrl || '',
      bannerUrl: req.body.bannerUrl || '',
      backgroundImage1: req.body.backgroundImage1 || '',
      backgroundImage2: req.body.backgroundImage2 || '',
      backgroundImage3: req.body.backgroundImage3 || '',
      description: req.body.description || '',
      phone: req.body.phone || '',
      zalo: req.body.zalo || '',
      address: req.body.address || '',
      themeColor: req.body.themeColor || '#b98745',
      cuisine: req.body.cuisine || '',
      deliveryTime: req.body.deliveryTime || '25-40 phút',
      deliveryFee: Number(req.body.deliveryFee || 0),
      shippingBaseFee: Number(req.body.shippingBaseFee || 0),
      shippingFeePerKm: Number(req.body.shippingFeePerKm || 0),
      shippingMinFee: Number(req.body.shippingMinFee || 0),
      shippingMaxDistanceKm: Number(req.body.shippingMaxDistanceKm || 30),
      shippingDistanceFactor: Number(req.body.shippingDistanceFactor || 1.2),
      storeLatitude: req.body.storeLatitude === '' || req.body.storeLatitude == null ? null : Number(req.body.storeLatitude),
      storeLongitude: req.body.storeLongitude === '' || req.body.storeLongitude == null ? null : Number(req.body.storeLongitude),
      storeMapLabel: req.body.storeMapLabel || req.body.address || '',
      loyaltyEnabled: req.body.loyaltyEnabled !== false,
      cashbackPercent: Number(req.body.cashbackPercent ?? 1),
      maxCoinUsePercent: Number(req.body.maxCoinUsePercent ?? 50),
      dailySpinEnabled: req.body.dailySpinEnabled !== false,
      spinRewards: normalizeSpinRewards(req.body.spinRewards),
      minOrder: Number(req.body.minOrder || 0),
      rating: Number(req.body.rating || 4.8),
      telegramChatId: req.body.telegramChatId || '',
      zaloWebhookUrl: req.body.zaloWebhookUrl || '',
      publicBaseUrl: req.body.publicBaseUrl || '',
      customDomain,
      customDomainUpdatedAt: customDomain ? new Date() : null,
      approvalStatus: isAdmin ? 'approved' : 'pending',
      approvedAt: isAdmin ? new Date() : null,
      approvedBy: isAdmin ? req.user._id : null,
      isActive: isAdmin
    });

    await syncDiningTables(shop);
    emitToAdmins('shop:pending', { shop });
    return res.status(201).json({
      shop,
      message: isAdmin
        ? 'Đã tạo và kích hoạt cửa hàng'
        : 'Đã gửi cửa hàng chờ admin tổng duyệt. Bạn vẫn có thể chuẩn bị sản phẩm và giao diện trong lúc chờ.'
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.customDomain) {
      return res.status(400).json({ message: 'Domain này đã được một cửa hàng khác sử dụng' });
    }
    return next(error);
  }
};

exports.getPublicShops = async (req, res, next) => {
  try {
    const shops = await Shop.find(publicShopQuery()).sort({ createdAt: -1 }).limit(60).lean();
    const shopIds = shops.map((shop) => shop._id);
    const productCounts = shopIds.length ? await Product.aggregate([
      { $match: { shopId: { $in: shopIds }, isActive: true } },
      { $group: { _id: '$shopId', count: { $sum: 1 }, minPrice: { $min: { $cond: [{ $gt: ['$salePrice', 0] }, '$salePrice', '$price'] } } } }
    ]) : [];
    const countMap = productCounts.reduce((acc, item) => {
      acc[String(item._id)] = item;
      return acc;
    }, {});
    return res.json({
      shops: shops.map((shop) => ({
        ...shop,
        approvalStatus: shop.approvalStatus || 'approved',
        productCount: countMap[String(shop._id)]?.count || 0,
        minPrice: countMap[String(shop._id)]?.minPrice || 0
      }))
    });
  } catch (error) {
    return next(error);
  }
};

exports.getMyShop = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    return res.json({ shop });
  } catch (error) {
    return next(error);
  }
};

exports.getShopBySlug = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ slug: req.params.slug }).populate('ownerId', 'name email phone');
    if (!shop) return res.status(404).json({ message: 'Không tìm thấy cửa hàng' });
    if (!isApproved(shop)) {
      return res.status(403).json({
        message: shop.approvalStatus === 'rejected'
          ? `Cửa hàng chưa được duyệt${shop.approvalNote ? `: ${shop.approvalNote}` : ''}`
          : 'Cửa hàng đang chờ admin tổng duyệt',
        approvalStatus: shop.approvalStatus || 'pending'
      });
    }
    if (!shop.isActive) return res.status(403).json({ message: 'Cửa hàng đang tạm khóa' });
    return res.json({
      shop,
      vnpayConfigured: Boolean(process.env.VNP_TMN_CODE && process.env.VNP_HASH_SECRET && process.env.VNP_RETURN_URL)
    });
  } catch (error) {
    return next(error);
  }
};

exports.getShopByDomain = async (req, res, next) => {
  try {
    const host = getRequestHost(req);
    if (!host || ['localhost', '127.0.0.1', '0.0.0.0'].includes(host)) {
      return res.json({ shop: null, host });
    }
    const shop = await Shop.findOne(publicShopQuery({ customDomain: host })).select('-bankAccountNumber');
    return res.json({ shop, host });
  } catch (error) {
    return next(error);
  }
};

exports.updateShop = async (req, res, next) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: 'Không tìm thấy cửa hàng' });

    const isOwner = String(shop.ownerId) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Bạn không có quyền sửa cửa hàng' });

    const setup = normalizeSetup({
      businessType: req.body.businessType ?? shop.businessType,
      serviceModes: req.body.serviceModes ?? shop.serviceModes,
      paymentMethods: req.body.paymentMethods ?? shop.paymentMethods,
      numberOfTables: req.body.numberOfTables ?? shop.numberOfTables
    });
    const bankError = validateBank(setup, {
      bankAccountName: req.body.bankAccountName ?? shop.bankAccountName,
      bankAccountNumber: req.body.bankAccountNumber ?? shop.bankAccountNumber,
      bankName: req.body.bankName ?? shop.bankName
    });
    if (bankError) return res.status(400).json({ message: bankError });

    Object.assign(shop, setup);

    const textFields = [
      'name', 'logoUrl', 'bannerUrl', 'backgroundImage1', 'backgroundImage2', 'backgroundImage3',
      'description', 'phone', 'zalo', 'address', 'themeColor', 'cuisine', 'deliveryTime', 'storeMapLabel',
      'telegramChatId', 'zaloWebhookUrl', 'publicBaseUrl', 'bankAccountName', 'bankAccountNumber', 'bankName',
      'legalName', 'taxCode', 'invoiceAddress', 'invoiceEmail', 'invoicePhone',
      'invoiceProviderName', 'invoiceLookupUrl'
    ];
    textFields.forEach((field) => {
      if (req.body[field] !== undefined) shop[field] = req.body[field];
    });
    if (req.body.defaultVatRate !== undefined) {
      const rate = String(req.body.defaultVatRate || '0').toUpperCase();
      if (!['KCT', '0', '5', '8', '10'].includes(rate)) {
        return res.status(400).json({ message: 'Thuế suất mặc định không hợp lệ' });
      }
      shop.defaultVatRate = rate;
    }

    ['deliveryFee', 'shippingBaseFee', 'shippingFeePerKm', 'shippingMinFee', 'shippingMaxDistanceKm', 'shippingDistanceFactor', 'storeLatitude', 'storeLongitude', 'cashbackPercent', 'maxCoinUsePercent', 'minOrder', 'rating'].forEach((field) => {
      if (req.body[field] !== undefined) shop[field] = req.body[field] === '' || req.body[field] === null ? null : Number(req.body[field] || 0);
    });
    ['loyaltyEnabled', 'dailySpinEnabled'].forEach((field) => {
      if (req.body[field] !== undefined) shop[field] = Boolean(req.body[field]);
    });
    if (req.body.spinRewards !== undefined) {
      shop.spinRewards = normalizeSpinRewards(req.body.spinRewards);
    }

    if (req.body.customDomain !== undefined) {
      const customDomain = normalizeDomain(req.body.customDomain);
      if (customDomain) {
        const duplicate = await Shop.findOne({ customDomain, _id: { $ne: shop._id } });
        if (duplicate) return res.status(400).json({ message: 'Domain này đã được một cửa hàng khác sử dụng' });
      }
      if (shop.customDomain !== customDomain) shop.customDomainUpdatedAt = new Date();
      shop.customDomain = customDomain;
    }

    if (req.body.slug && req.body.slug !== shop.slug) {
      const newSlug = makeSlug(req.body.slug);
      if (!newSlug) return res.status(400).json({ message: 'Đường dẫn không hợp lệ' });
      if (await Shop.findOne({ slug: newSlug, _id: { $ne: shop._id } })) {
        return res.status(400).json({ message: 'Đường dẫn này đã tồn tại' });
      }
      shop.slug = newSlug;
    }

    if (isAdmin && req.body.isActive !== undefined) {
      if (Boolean(req.body.isActive) && !isApproved(shop)) {
        return res.status(400).json({ message: 'Cần duyệt cửa hàng trước khi kích hoạt' });
      }
      shop.isActive = Boolean(req.body.isActive);
    }

    await shop.save();
    await syncDiningTables(shop);
    return res.json({ shop });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.customDomain) {
      return res.status(400).json({ message: 'Domain này đã được một cửa hàng khác sử dụng' });
    }
    return next(error);
  }
};
