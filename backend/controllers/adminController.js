const User = require('../models/User');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Conversation = require('../models/Conversation');
const { parsePagination, buildPagination, escapeRegex, parseDateRange } = require('../utils/query');
const { isApproved } = require('../utils/shopAccess');
const { emitToShop } = require('../realtime');
const { sendPushToShop } = require('../services/pushService');

const activeValue = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

exports.getStats = async (req, res, next) => {
  try {
    const [users, shops, products, orders, pendingShops, openConversations] = await Promise.all([
      User.countDocuments(),
      Shop.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      Shop.countDocuments({ approvalStatus: 'pending' }),
      Conversation.countDocuments({ status: 'open' })
    ]);

    return res.json({ stats: { users, shops, products, orders, pendingShops, openConversations } });
  } catch (error) {
    return next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 50 });
    const query = {};
    const search = String(req.query.search || '').trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }
    if (['seller', 'admin'].includes(req.query.role)) query.role = req.query.role;
    const isActive = activeValue(req.query.isActive);
    if (isActive !== undefined) query.isActive = isActive;
    Object.assign(query, parseDateRange(req.query));

    const [users, total] = await Promise.all([
      User.find(query).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query)
    ]);

    const userIds = users.map((user) => user._id);
    const ownedShops = userIds.length
      ? await Shop.find({ ownerId: { $in: userIds } })
        .select('ownerId name slug businessType approvalStatus isActive customDomain createdAt')
        .lean()
      : [];
    const shopByOwner = new Map(ownedShops.map((shop) => [String(shop.ownerId), shop]));

    return res.json({
      users: users.map((user) => ({ ...user, shop: shopByOwner.get(String(user._id)) || null })),
      pagination: buildPagination({ page, limit, total })
    });
  } catch (error) {
    return next(error);
  }
};

exports.setUserActive = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    if (String(user._id) === String(req.user._id) && req.body.isActive === false) {
      return res.status(400).json({ message: 'Bạn không thể tự khóa tài khoản admin đang đăng nhập' });
    }
    user.isActive = Boolean(req.body.isActive);
    await user.save();
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
};

exports.getShops = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
    const query = {};
    const search = String(req.query.search || '').trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { name: regex }, { slug: regex }, { address: regex }, { phone: regex },
        { customDomain: regex }, { bankName: regex }
      ];
    }
    if (['restaurant', 'retail'].includes(req.query.businessType)) query.businessType = req.query.businessType;
    if (['pending', 'approved', 'rejected'].includes(req.query.approvalStatus)) {
      if (req.query.approvalStatus === 'approved') {
        query.$and = query.$and || [];
        query.$and.push({ $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }, { approvalStatus: null }] });
      } else query.approvalStatus = req.query.approvalStatus;
    }
    const isActive = activeValue(req.query.isActive);
    if (isActive !== undefined) query.isActive = isActive;
    Object.assign(query, parseDateRange(req.query));

    const [shops, total] = await Promise.all([
      Shop.find(query)
        .populate('ownerId', 'name email phone')
        .populate('approvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Shop.countDocuments(query)
    ]);

    return res.json({
      shops: shops.map((shop) => {
        const object = shop.toObject();
        object.approvalStatus = object.approvalStatus || 'approved';
        return object;
      }),
      pagination: buildPagination({ page, limit, total })
    });
  } catch (error) {
    return next(error);
  }
};

exports.setShopActive = async (req, res, next) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: 'Không tìm thấy shop' });
    if (Boolean(req.body.isActive) && !isApproved(shop)) {
      return res.status(400).json({ message: 'Cần duyệt cửa hàng trước khi mở hoạt động' });
    }
    shop.isActive = Boolean(req.body.isActive);
    await shop.save();
    return res.json({ shop });
  } catch (error) {
    return next(error);
  }
};

exports.setShopApproval = async (req, res, next) => {
  try {
    const { approvalStatus, approvalNote = '' } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({ message: 'Trạng thái duyệt không hợp lệ' });
    }
    const shop = await Shop.findById(req.params.id).populate('ownerId', 'name email phone');
    if (!shop) return res.status(404).json({ message: 'Không tìm thấy shop' });

    shop.approvalStatus = approvalStatus;
    shop.approvalNote = String(approvalNote || '').trim();
    if (approvalStatus === 'approved') {
      shop.isActive = true;
      shop.approvedAt = new Date();
      shop.approvedBy = req.user._id;
    } else {
      shop.isActive = false;
      shop.approvedAt = null;
      shop.approvedBy = null;
    }
    await shop.save();

    emitToShop(shop._id, 'shop:approval', {
      shop,
      notification: {
        title: approvalStatus === 'approved' ? 'Cửa hàng đã được duyệt' : approvalStatus === 'rejected' ? 'Cửa hàng chưa được duyệt' : 'Cửa hàng chuyển về chờ duyệt',
        body: shop.approvalNote || (approvalStatus === 'approved' ? 'Bạn có thể bắt đầu nhận đơn ngay.' : 'Vui lòng kiểm tra lại thông tin cửa hàng.')
      }
    });
    sendPushToShop(shop._id, {
      title: approvalStatus === 'approved' ? 'Cửa hàng đã được duyệt' : approvalStatus === 'rejected' ? 'Cửa hàng cần chỉnh sửa' : 'Cửa hàng đang chờ duyệt',
      body: shop.approvalNote || (approvalStatus === 'approved' ? 'Bạn có thể bắt đầu nhận đơn ngay.' : 'Vui lòng kiểm tra lại thông tin cửa hàng.'),
      tag: `shop-approval-${shop._id}`,
      url: '/dashboard'
    }).catch(() => null);
    return res.json({ shop });
  } catch (error) {
    return next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 100 });
    const query = {};
    const search = String(req.query.search || '').trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ orderCode: regex }, { customerName: regex }, { phone: regex }, { address: regex }];
    }
    if (req.query.shopId) query.shopId = req.query.shopId;
    if (req.query.status) query.status = req.query.status;
    if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;
    if (req.query.orderType) query.orderType = req.query.orderType;
    if (req.query.paymentMethod) query.paymentMethod = req.query.paymentMethod;
    Object.assign(query, parseDateRange(req.query));

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('shopId', 'name slug businessType logoUrl')
        .populate('tableId')
        .populate('diningSessionId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query)
    ]);
    return res.json({ orders, pagination: buildPagination({ page, limit, total }) });
  } catch (error) {
    return next(error);
  }
};
