const DiningTable = require('../models/DiningTable');
const Shop = require('../models/Shop');
const { isApproved } = require('../utils/shopAccess');
const { makeToken } = require('../services/tableService');

exports.getMyTables = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return res.status(400).json({ message: 'Bạn chưa tạo shop' });
    const tables = await DiningTable.find({ shopId: shop._id }).sort({ tableNumber: 1 });
    res.json({ shop, tables });
  } catch (error) {
    next(error);
  }
};

exports.getPublicTable = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ slug: req.params.slug, isActive: true });
    if (!shop) return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });

    const table = await DiningTable.findOne({
      shopId: shop._id,
      qrToken: req.params.token,
      isActive: true
    });

    if (!table) return res.status(404).json({ message: 'Mã QR bàn không hợp lệ hoặc đã bị khóa' });
    res.json({ shop, table });
  } catch (error) {
    next(error);
  }
};



exports.addTables = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return res.status(400).json({ message: 'Bạn chưa tạo shop' });

    const canUseTables = shop.businessType === 'restaurant' && shop.serviceModes?.includes('dine_in');
    if (!canUseTables) {
      return res.status(400).json({ message: 'Chỉ nhà hàng có phục vụ tại bàn mới được thêm bàn và tạo QR' });
    }

    const count = Math.max(1, Math.min(50, Number(req.body.count || 1)));
    const lastTable = await DiningTable.findOne({ shopId: shop._id }).sort({ tableNumber: -1 });
    const startNumber = Number(lastTable?.tableNumber || 0) + 1;

    if (startNumber + count - 1 > 500) {
      return res.status(400).json({ message: 'Mỗi nhà hàng được tạo tối đa 500 bàn' });
    }

    const payload = Array.from({ length: count }, (_, index) => {
      const tableNumber = startNumber + index;
      return {
        shopId: shop._id,
        tableNumber,
        name: `Bàn ${tableNumber}`,
        qrToken: makeToken(),
        isActive: true
      };
    });

    const newTables = await DiningTable.insertMany(payload);
    shop.numberOfTables = startNumber + count - 1;
    await shop.save();

    const tables = await DiningTable.find({ shopId: shop._id }).sort({ tableNumber: 1 });
    res.status(201).json({
      message: `Đã thêm ${count} bàn mới và tạo QR tương ứng`,
      shop,
      newTables,
      tables
    });
  } catch (error) {
    next(error);
  }
};

exports.regenerateQr = async (req, res, next) => {
  try {
    const table = await DiningTable.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Không tìm thấy bàn' });
    const shop = await Shop.findById(table.shopId);
    if (!shop || (req.user.role !== 'admin' && String(shop.ownerId) !== String(req.user._id))) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa bàn này' });
    }
    table.qrToken = makeToken();
    await table.save();
    res.json({ table });
  } catch (error) {
    next(error);
  }
};

exports.toggleTable = async (req, res, next) => {
  try {
    const table = await DiningTable.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Không tìm thấy bàn' });
    const shop = await Shop.findById(table.shopId);
    if (!shop || (req.user.role !== 'admin' && String(shop.ownerId) !== String(req.user._id))) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa bàn này' });
    }
    table.isActive = Boolean(req.body.isActive);
    await table.save();
    res.json({ table });
  } catch (error) {
    next(error);
  }
};
