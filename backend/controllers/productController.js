const Product = require('../models/Product');
const Shop = require('../models/Shop');
const { parsePagination, buildPagination, escapeRegex } = require('../utils/query');
const { isApproved } = require('../utils/shopAccess');

const findSellerShop = async (userId) => Shop.findOne({ ownerId: userId });

const parseImages = (images) => {
  if (Array.isArray(images)) return images.filter(Boolean);
  if (typeof images === 'string') {
    return images.split('\n').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const canPrepareProducts = (shop) => {
  if (!shop) return false;
  if (shop.approvalStatus === 'rejected') return false;
  if (shop.approvalStatus === 'pending') return true;
  if (!shop.approvalStatus) return shop.isActive;
  return shop.isActive;
};

exports.createProduct = async (req, res, next) => {
  try {
    const shop = await findSellerShop(req.user._id);
    if (!shop) return res.status(400).json({ message: 'Bạn cần tạo shop trước khi đăng sản phẩm' });
    if (!canPrepareProducts(shop)) {
      return res.status(403).json({ message: 'Cửa hàng đang bị từ chối hoặc tạm khóa, không thể đăng sản phẩm' });
    }

    const { name, description, price, salePrice, category, stock, images } = req.body;
    if (!name || price === undefined || price === '') {
      return res.status(400).json({ message: 'Vui lòng nhập tên và giá sản phẩm' });
    }

    const product = await Product.create({
      shopId: shop._id,
      name,
      description,
      price: Number(price),
      salePrice: Number(salePrice || 0),
      category,
      stock: Number(stock || 0),
      images: parseImages(images),
      isActive: req.body.isActive !== false
    });
    return res.status(201).json({ product });
  } catch (error) {
    return next(error);
  }
};

exports.getMyShopProducts = async (req, res, next) => {
  try {
    const shop = await findSellerShop(req.user._id);
    if (!shop) return res.status(400).json({ message: 'Bạn chưa tạo shop' });
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 100 });
    const query = { shopId: shop._id };
    const search = String(req.query.search || '').trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: regex }, { category: regex }, { description: regex }];
    }
    if (req.query.category) query.category = req.query.category;
    if (req.query.isActive === 'true') query.isActive = true;
    if (req.query.isActive === 'false') query.isActive = false;
    if (req.query.stock === 'out') query.stock = { $lte: 0 };
    if (req.query.stock === 'available') query.stock = { $gt: 0 };

    const [products, total, categories] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(query),
      Product.distinct('category', { shopId: shop._id })
    ]);
    return res.json({
      shop,
      products,
      categories: categories.filter(Boolean).sort(),
      pagination: buildPagination({ page, limit, total })
    });
  } catch (error) {
    return next(error);
  }
};

exports.getProductsByShopSlug = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ slug: req.params.slug });
    if (!shop) return res.status(404).json({ message: 'Không tìm thấy shop' });
    if (!isApproved(shop)) return res.status(403).json({ message: 'Cửa hàng đang chờ admin tổng duyệt' });
    if (!shop.isActive) return res.status(403).json({ message: 'Shop này đang tạm khóa' });

    const products = await Product.find({ shopId: shop._id, isActive: true }).sort({ createdAt: -1 });
    return res.json({ shop, products });
  } catch (error) {
    return next(error);
  }
};

exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('shopId');
    if (!product || !product.isActive) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    if (!isApproved(product.shopId) || !product.shopId.isActive) {
      return res.status(403).json({ message: 'Cửa hàng chưa khả dụng' });
    }
    return res.json({ product });
  } catch (error) {
    return next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });

    const shop = await Shop.findById(product.shopId);
    const isOwner = shop && String(shop.ownerId) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Bạn không có quyền sửa sản phẩm này' });

    const allowedFields = ['name', 'description', 'price', 'salePrice', 'category', 'stock', 'isActive'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (['price', 'salePrice', 'stock'].includes(field)) product[field] = Number(req.body[field] || 0);
        else product[field] = req.body[field];
      }
    });
    if (req.body.images !== undefined) product.images = parseImages(req.body.images);

    await product.save();
    return res.json({ product });
  } catch (error) {
    return next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });

    const shop = await Shop.findById(product.shopId);
    const isOwner = shop && String(shop.ownerId) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Bạn không có quyền ẩn sản phẩm này' });

    product.isActive = false;
    await product.save();
    return res.json({ message: 'Đã ẩn sản phẩm', product });
  } catch (error) {
    return next(error);
  }
};
