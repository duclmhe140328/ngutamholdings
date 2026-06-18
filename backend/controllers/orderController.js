const Order = require('../models/Order');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const DiningTable = require('../models/DiningTable');
const { notifyShopNewOrder } = require('../services/notificationService');
const { emitToShop, emitToAdmins } = require('../realtime');
const { createPaymentUrl } = require('../services/vnpayService');
const { parsePagination, buildPagination, escapeRegex, parseDateRange } = require('../utils/query');
const { isApproved } = require('../utils/shopAccess');
const { buildOrderPricing } = require('../services/orderPricingService');
const { spendCoins, rewardOrderCoins, releaseOrderBenefits } = require('../services/loyaltyService');
const Coupon = require('../models/Coupon');
const CustomerVoucher = require('../models/CustomerVoucher');
const { normalizePhone } = require('../utils/phone');

const makeOrderCode = () => {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('');
  return `FH${stamp}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
};

exports.quoteOrder = async (req, res, next) => {
  try {
    const { shopSlug, items, orderType, phone, couponCode, coinsToUse, customerLatitude, customerLongitude } = req.body;
    const shop = await Shop.findOne({ slug: shopSlug });
    if (!shop || !isApproved(shop) || !shop.isActive) return res.status(404).json({ message: 'Cửa hàng chưa sẵn sàng nhận đơn' });
    const finalOrderType = orderType || shop.serviceModes[0];
    if (!shop.serviceModes.includes(finalOrderType)) return res.status(400).json({ message: 'Hình thức nhận hàng không được hỗ trợ' });
    const pricing = await buildOrderPricing({ req, shop, items, orderType: finalOrderType, phone, couponCode, coinsToUse, customerLatitude, customerLongitude });
    return res.json({
      subtotal: pricing.subtotal,
      deliveryFee: pricing.shipping.fee,
      deliveryDistanceKm: pricing.shipping.distanceKm,
      couponDiscount: pricing.couponDiscount,
      coinsUsed: pricing.coinsUsed,
      coinDiscount: pricing.coinDiscount,
      totalAmount: pricing.totalAmount,
      coupon: pricing.coupon ? { code: pricing.coupon.code, title: pricing.coupon.title } : null,
      maxCoinUsePercent: shop.maxCoinUsePercent,
      coinRate: 1
    });
  } catch (error) { return next(error); }
};

exports.createOrder = async (req, res, next) => {
  let createdOrder = null;
  try {
    const {
      shopSlug, customerName, phone, address, note, items, orderType, paymentMethod, tableToken,
      couponCode, coinsToUse, customerLatitude, customerLongitude
    } = req.body;

    if (!shopSlug) return res.status(400).json({ message: 'Thiếu thông tin cửa hàng' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Giỏ hàng đang trống' });

    const shop = await Shop.findOne({ slug: shopSlug });
    if (!shop) return res.status(404).json({ message: 'Cửa hàng không tồn tại' });
    if (!isApproved(shop)) return res.status(403).json({ message: 'Cửa hàng đang chờ admin tổng duyệt' });
    if (!shop.isActive) return res.status(403).json({ message: 'Cửa hàng đang tạm khóa' });

    const finalOrderType = orderType || shop.serviceModes[0];
    if (!shop.serviceModes.includes(finalOrderType)) return res.status(400).json({ message: 'Hình thức nhận hàng không được cửa hàng hỗ trợ' });
    const finalPaymentMethod = paymentMethod || shop.paymentMethods[0] || 'cash';
    if (!shop.paymentMethods.includes(finalPaymentMethod)) return res.status(400).json({ message: 'Phương thức thanh toán không được cửa hàng hỗ trợ' });
    if (finalPaymentMethod === 'vnpay' && !(process.env.VNP_TMN_CODE && process.env.VNP_HASH_SECRET && process.env.VNP_RETURN_URL)) {
      return res.status(400).json({ message: 'VNPAY chưa được quản trị hệ thống cấu hình merchant' });
    }

    let table = null;
    if (finalOrderType === 'dine_in') {
      if (!tableToken) return res.status(400).json({ message: 'Đơn tại quán phải được tạo từ QR của bàn' });
      table = await DiningTable.findOne({ shopId: shop._id, qrToken: tableToken, isActive: true });
      if (!table) return res.status(400).json({ message: 'QR bàn không hợp lệ hoặc bàn đã bị khóa' });
    } else if ((!phone || !address) && ['delivery', 'shipping'].includes(finalOrderType)) {
      return res.status(400).json({ message: 'Vui lòng nhập số điện thoại và địa chỉ nhận hàng' });
    }

    const finalCustomerName = String(customerName || '').trim() || (table ? `Khách ${table.name}` : '');
    if (!finalCustomerName) return res.status(400).json({ message: 'Vui lòng nhập tên khách hàng' });

    const pricing = await buildOrderPricing({ req, shop, items, orderType: finalOrderType, phone, couponCode, coinsToUse, customerLatitude, customerLongitude });
    if (shop.minOrder > 0 && pricing.subtotal < shop.minOrder) {
      return res.status(400).json({ message: `Đơn tối thiểu ${Number(shop.minOrder).toLocaleString('vi-VN')}đ` });
    }

    createdOrder = await Order.create({
      orderCode: makeOrderCode(),
      shopId: shop._id,
      tableId: table?._id || null,
      tableNumber: table?.tableNumber || null,
      orderType: finalOrderType,
      customerName: finalCustomerName,
      phone: normalizePhone(phone) || String(phone || '').trim(),
      address: address || '',
      note,
      products: pricing.products,
      subtotal: pricing.subtotal,
      deliveryFee: pricing.shipping.fee,
      deliveryDistanceKm: pricing.shipping.distanceKm,
      customerLatitude: Number.isFinite(Number(customerLatitude)) ? Number(customerLatitude) : null,
      customerLongitude: Number.isFinite(Number(customerLongitude)) ? Number(customerLongitude) : null,
      shopLatitude: shop.storeLatitude,
      shopLongitude: shop.storeLongitude,
      couponCode: pricing.coupon?.code || '',
      couponDiscount: pricing.couponDiscount,
      customerVoucherId: pricing.customerVoucher?._id || null,
      loyaltyPhone: pricing.verifiedPhone || '',
      coinsUsed: pricing.coinsUsed,
      coinDiscount: pricing.coinDiscount,
      totalAmount: pricing.totalAmount,
      paymentMethod: finalPaymentMethod,
      paymentStatus: finalPaymentMethod === 'vnpay' ? 'pending' : 'unpaid'
    });

    if (pricing.coinsUsed > 0) await spendCoins({ shopId: shop._id, phone: pricing.verifiedPhone, coins: pricing.coinsUsed, orderId: createdOrder._id });
    if (pricing.customerVoucher) await CustomerVoucher.updateOne({ _id: pricing.customerVoucher._id, usedAt: null }, { $set: { usedAt: new Date(), orderId: createdOrder._id } });
    if (pricing.coupon) await Coupon.updateOne({ _id: pricing.coupon._id }, { $inc: { usedCount: 1 } });

    const populatedOrder = await Order.findById(createdOrder._id).populate('shopId', 'name slug businessType logoUrl').populate('tableId');
    notifyShopNewOrder(createdOrder, shop).catch((error) => console.error('Lỗi thông báo đơn hàng:', error.message));
    emitToShop(shop._id, 'order:new', { order: populatedOrder });
    emitToAdmins('order:new', { order: populatedOrder });

    const paymentUrl = finalPaymentMethod === 'vnpay'
      ? createPaymentUrl(createdOrder, req.headers['x-forwarded-for'] || req.socket.remoteAddress)
      : '';
    return res.status(201).json({ order: populatedOrder, requiresVnpay: finalPaymentMethod === 'vnpay', paymentUrl });
  } catch (error) {
    if (createdOrder && error?.message === 'Số xu không đủ') await Order.deleteOne({ _id: createdOrder._id }).catch(() => {});
    return next(error);
  }
};

exports.getMyShopOrders = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return res.status(400).json({ message: 'Bạn chưa tạo cửa hàng' });

    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 100 });
    const query = { shopId: shop._id };
    const search = String(req.query.search || '').trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ orderCode: regex }, { customerName: regex }, { phone: regex }, { address: regex }];
    }
    if (req.query.status) query.status = req.query.status;
    if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;
    if (req.query.orderType) query.orderType = req.query.orderType;
    if (req.query.paymentMethod) query.paymentMethod = req.query.paymentMethod;
    if (req.query.invoiceStatus) query.invoiceStatus = req.query.invoiceStatus === 'not_issued' ? { $in: ['not_issued', null] } : req.query.invoiceStatus;
    Object.assign(query, parseDateRange(req.query));

    const [orders, total, summaryAgg] = await Promise.all([
      Order.find(query).populate('tableId').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
      Order.aggregate([
        { $match: { shopId: shop._id } },
        { $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0] } },
          pending: { $sum: { $cond: [{ $in: ['$status', ['pending', 'confirmed', 'preparing', 'ready', 'serving', 'shipping']] }, 1, 0] } },
          unpaid: { $sum: { $cond: [{ $and: [{ $ne: ['$paymentStatus', 'paid'] }, { $ne: ['$status', 'cancelled'] }] }, 1, 0] } },
          dineIn: { $sum: { $cond: [{ $eq: ['$orderType', 'dine_in'] }, 1, 0] } }
        } }
      ])
    ]);
    const summary = summaryAgg[0] || { totalOrders: 0, revenue: 0, pending: 0, unpaid: 0, dineIn: 0 };
    return res.json({ shop, orders, summary, pagination: buildPagination({ page, limit, total }) });
  } catch (error) {
    return next(error);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const allowedStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'serving', 'shipping', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(req.body.status)) return res.status(400).json({ message: 'Trạng thái đơn không hợp lệ' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    const shop = await Shop.findById(order.shopId);
    const isOwner = shop && String(shop.ownerId) === String(req.user._id);
    if (!isOwner && req.user.role !== 'admin') return res.status(403).json({ message: 'Bạn không có quyền cập nhật đơn này' });

    order.status = req.body.status;
    await order.save();
    if (req.body.status === 'cancelled' && order.paymentStatus !== 'paid') await releaseOrderBenefits(order, shop, 'Hoàn ưu đãi do đơn bị hủy');
    const populatedOrder = await Order.findById(order._id)
      .populate('shopId', 'name slug logoUrl')
      .populate('tableId');
    emitToShop(order.shopId, 'order:updated', { order: populatedOrder });
    emitToAdmins('order:updated', { order: populatedOrder });
    return res.json({ order: populatedOrder });
  } catch (error) {
    return next(error);
  }
};

exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const allowed = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];
    if (!allowed.includes(req.body.paymentStatus)) {
      return res.status(400).json({ message: 'Trạng thái thanh toán không hợp lệ' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    const shop = await Shop.findById(order.shopId);
    const isOwner = shop && String(shop.ownerId) === String(req.user._id);
    if (!isOwner && req.user.role !== 'admin') return res.status(403).json({ message: 'Bạn không có quyền cập nhật thanh toán' });

    order.paymentStatus = req.body.paymentStatus;
    order.paidAt = req.body.paymentStatus === 'paid' ? new Date() : null;
    if (req.body.paymentStatus === 'paid' && order.orderType === 'dine_in' && order.status !== 'cancelled') {
      order.status = 'completed';
    }
    await order.save();
    if (req.body.paymentStatus === 'paid') await rewardOrderCoins(order, shop);
    if (['failed', 'refunded'].includes(req.body.paymentStatus)) await releaseOrderBenefits(order, shop, 'Hoàn ưu đãi do thanh toán không thành công');

    const populatedOrder = await Order.findById(order._id)
      .populate('shopId', 'name slug logoUrl')
      .populate('tableId');
    emitToShop(order.shopId, 'order:updated', { order: populatedOrder });
    emitToAdmins('order:updated', { order: populatedOrder });
    return res.json({ order: populatedOrder });
  } catch (error) {
    return next(error);
  }
};

exports.updateInvoiceData = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });

    const shop = await Shop.findById(order.shopId);
    const isOwner = shop && String(shop.ownerId) === String(req.user._id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn không có quyền cập nhật hóa đơn này' });
    }

    const allowedStatuses = ['not_issued', 'draft', 'external_issued', 'cancelled'];
    const invoiceStatus = String(req.body.invoiceStatus || 'draft');
    if (!allowedStatuses.includes(invoiceStatus)) {
      return res.status(400).json({ message: 'Trạng thái hóa đơn không hợp lệ' });
    }

    const vatRate = String(req.body.vatRate ?? shop.defaultVatRate ?? '0').toUpperCase();
    if (!['KCT', '0', '5', '8', '10'].includes(vatRate)) {
      return res.status(400).json({ message: 'Thuế suất GTGT không hợp lệ' });
    }

    if (invoiceStatus === 'external_issued') {
      if (order.paymentStatus !== 'paid') {
        return res.status(400).json({ message: 'Chỉ ghi nhận hóa đơn điện tử đã phát hành cho đơn đã thanh toán' });
      }
      if (!String(req.body.invoiceNumber || '').trim()) {
        return res.status(400).json({ message: 'Vui lòng nhập số hóa đơn điện tử đã phát hành' });
      }
    }

    const rateNumber = vatRate === 'KCT' ? 0 : Number(vatRate || 0);
    const invoiceTotal = Math.max(0, Number(order.totalAmount || 0));
    const amountBeforeVat = rateNumber > 0
      ? Math.round(invoiceTotal / (1 + rateNumber / 100))
      : invoiceTotal;
    const vatAmount = Math.max(0, invoiceTotal - amountBeforeVat);

    const textFields = [
      'invoiceNumber', 'invoiceSymbol', 'invoiceTemplateCode', 'invoiceLookupCode',
      'invoiceLookupUrl', 'invoiceProviderName', 'buyerName', 'buyerCompanyName',
      'buyerTaxCode', 'buyerAddress', 'buyerEmail', 'invoiceNote'
    ];
    textFields.forEach((field) => {
      if (req.body[field] !== undefined) order[field] = String(req.body[field] || '').trim();
    });

    order.invoiceStatus = invoiceStatus;
    order.vatRate = vatRate;
    order.amountBeforeVat = amountBeforeVat;
    order.vatAmount = vatAmount;
    order.invoiceTotal = invoiceTotal;
    order.invoiceUpdatedAt = new Date();
    order.invoiceIssuedAt = invoiceStatus === 'external_issued'
      ? (req.body.invoiceIssuedAt ? new Date(req.body.invoiceIssuedAt) : order.invoiceIssuedAt || new Date())
      : null;

    if (invoiceStatus === 'not_issued') {
      order.invoiceNumber = '';
      order.invoiceSymbol = '';
      order.invoiceTemplateCode = '';
      order.invoiceLookupCode = '';
      order.invoiceIssuedAt = null;
    }

    await order.save();
    const populatedOrder = await Order.findById(order._id)
      .populate('shopId', 'name slug logoUrl legalName taxCode invoiceAddress invoiceEmail invoicePhone invoiceProviderName invoiceLookupUrl defaultVatRate')
      .populate('tableId');

    emitToShop(order.shopId, 'order:updated', { order: populatedOrder });
    emitToAdmins('order:updated', { order: populatedOrder });
    return res.json({ order: populatedOrder });
  } catch (error) {
    return next(error);
  }
};

