const Order = require('../models/Order');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const DiningTable = require('../models/DiningTable');
const DiningSession = require('../models/DiningSession');
const { notifyShopNewOrder } = require('../services/notificationService');
const { emitToShop, emitToAdmins } = require('../realtime');
const { createPaymentUrl } = require('../services/vnpayService');
const { parsePagination, buildPagination, escapeRegex, parseDateRange } = require('../utils/query');
const { isApproved } = require('../utils/shopAccess');
const { buildOrderPricing } = require('../services/orderPricingService');
const { spendCoins, rewardOrderCoins, rewardDiningSessionCoins, releaseOrderBenefits } = require('../services/loyaltyService');
const Coupon = require('../models/Coupon');
const CustomerVoucher = require('../models/CustomerVoucher');
const { normalizePhone } = require('../utils/phone');
const {
  getVerifiedPhone,
  findOrCreateOpenDiningSession,
  findOrCreateGuestSession,
  resolveGuestFromToken,
  buildCurrentBill
} = require('../services/diningSessionService');
const { sendPushToShop, sendPushToAdmins } = require('../services/pushService');
const { buildSepayQrUrl, makePaymentReference } = require('../services/sepayService');

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
      couponCode, coinsToUse, customerLatitude, customerLongitude,
      guestId, guestSessionToken, diningSessionId
    } = req.body;

    if (!shopSlug) return res.status(400).json({ message: 'Thiếu thông tin cửa hàng' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Giỏ hàng đang trống' });

    const shop = await Shop.findOne({ slug: shopSlug });
    if (!shop) return res.status(404).json({ message: 'Cửa hàng không tồn tại' });
    if (!isApproved(shop)) return res.status(403).json({ message: 'Cửa hàng đang chờ admin tổng duyệt' });
    if (!shop.isActive) return res.status(403).json({ message: 'Cửa hàng đang tạm khóa' });

    const finalOrderType = orderType || shop.serviceModes[0];
    if (!shop.serviceModes.includes(finalOrderType)) {
      return res.status(400).json({ message: 'Hình thức nhận hàng không được cửa hàng hỗ trợ' });
    }

    const requestedPayment = paymentMethod === 'bank_qr' ? 'bank_transfer' : paymentMethod;
    let finalPaymentMethod;
    if (finalOrderType === 'dine_in') {
      // Đơn tại bàn chỉ cho tiền mặt hoặc gửi món trước, thanh toán sau.
      finalPaymentMethod = ['cash', 'pay_later'].includes(requestedPayment) ? requestedPayment : 'pay_later';
    } else {
      finalPaymentMethod = requestedPayment || shop.paymentMethods[0] || 'cash';
      if (!shop.paymentMethods.includes(finalPaymentMethod)) {
        return res.status(400).json({ message: 'Phương thức thanh toán không được cửa hàng hỗ trợ' });
      }
    }

    if (finalPaymentMethod === 'vnpay' && !(process.env.VNP_TMN_CODE && process.env.VNP_HASH_SECRET && process.env.VNP_RETURN_URL)) {
      return res.status(400).json({ message: 'VNPAY chưa được quản trị hệ thống cấu hình merchant' });
    }
    if (finalPaymentMethod === 'bank_transfer' && (!shop.bankAccountName || !shop.bankAccountNumber || !shop.bankName)) {
      return res.status(400).json({ message: 'Cửa hàng chưa nhập đủ ngân hàng, số tài khoản và chủ tài khoản' });
    }

    let table = null;
    let diningSession = null;
    let guestSession = null;
    let billNumber = 1;
    let orderRound = 1;

    if (finalOrderType === 'dine_in') {
      if (!tableToken) return res.status(400).json({ message: 'Đơn tại quán phải được tạo từ QR của bàn' });
      table = await DiningTable.findOne({ shopId: shop._id, qrToken: tableToken, isActive: true });
      if (!table) return res.status(400).json({ message: 'QR bàn không hợp lệ hoặc bàn đã bị khóa' });

      const openResult = await findOrCreateOpenDiningSession({ shop, table });
      diningSession = openResult.session;
      if (diningSessionId && String(diningSessionId) !== String(diningSession._id)) {
        return res.status(409).json({ message: 'Phiên bàn trên thiết bị đã cũ. Vui lòng tải lại QR bàn.' });
      }

      guestSession = await resolveGuestFromToken({ token: guestSessionToken, session: diningSession, table });
      if (!guestSession) {
        guestSession = await findOrCreateGuestSession({
          session: diningSession,
          shop,
          table,
          guestId: guestId || `legacy-${table._id}`,
          verifiedPhone: getVerifiedPhone(req)
        });
      }

      billNumber = 1;
      const latestRound = await Order.findOne({ diningSessionId: diningSession._id })
        .sort({ orderRound: -1, createdAt: -1 })
        .select('orderRound');
      orderRound = Number(latestRound?.orderRound || 0) + 1;
    } else if ((!phone || !address) && ['delivery', 'shipping'].includes(finalOrderType)) {
      return res.status(400).json({ message: 'Vui lòng nhập số điện thoại và địa chỉ nhận hàng' });
    }

    const finalCustomerName = String(customerName || '').trim() || (table ? `Khách ${table.name}` : '');
    if (!finalCustomerName) return res.status(400).json({ message: 'Vui lòng nhập tên khách hàng' });

    const pricing = await buildOrderPricing({
      req, shop, items, orderType: finalOrderType, phone, couponCode, coinsToUse,
      customerLatitude, customerLongitude
    });
    if (shop.minOrder > 0 && pricing.subtotal < shop.minOrder) {
      return res.status(400).json({ message: `Đơn tối thiểu ${Number(shop.minOrder).toLocaleString('vi-VN')}đ` });
    }

    const orderCode = makeOrderCode();
    const paymentReference = finalPaymentMethod === 'bank_transfer' ? makePaymentReference(orderCode) : '';
    const bankQrUrl = finalPaymentMethod === 'bank_transfer'
      ? buildSepayQrUrl({
        accountNumber: shop.bankAccountNumber,
        bankName: shop.bankName,
        amount: pricing.totalAmount,
        description: paymentReference,
        holder: shop.bankAccountName,
        store: shop.name
      })
      : '';

    createdOrder = await Order.create({
      orderCode,
      shopId: shop._id,
      tableId: table?._id || null,
      tableNumber: table?.tableNumber || null,
      diningSessionId: diningSession?._id || null,
      guestSessionId: guestSession?._id || null,
      billNumber,
      orderRound,
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
      loyaltyPhone: pricing.verifiedPhone || normalizePhone(phone) || '',
      coinsUsed: pricing.coinsUsed,
      coinDiscount: pricing.coinDiscount,
      totalAmount: pricing.totalAmount,
      paymentMethod: finalPaymentMethod,
      paymentStatus: ['vnpay', 'bank_transfer'].includes(finalPaymentMethod) ? 'pending' : 'unpaid',
      paymentReference,
      bankQrUrl,
      paymentUpdatedAt: new Date()
    });

    if (diningSession) {
      const normalizedPhone = normalizePhone(phone) || pricing.verifiedPhone || '';
      const names = new Set([...(diningSession.customerNames || []), finalCustomerName].filter(Boolean));
      diningSession.customerNames = [...names];
      if (normalizedPhone && !diningSession.loyaltyPhone) diningSession.loyaltyPhone = normalizedPhone;
      diningSession.lastActivityAt = new Date();
      await diningSession.save();
    }

    if (pricing.coinsUsed > 0) {
      await spendCoins({ shopId: shop._id, phone: pricing.verifiedPhone, coins: pricing.coinsUsed, orderId: createdOrder._id });
    }
    if (pricing.customerVoucher) {
      await CustomerVoucher.updateOne({ _id: pricing.customerVoucher._id, usedAt: null }, { $set: { usedAt: new Date(), orderId: createdOrder._id } });
    }
    if (pricing.coupon) await Coupon.updateOne({ _id: pricing.coupon._id }, { $inc: { usedCount: 1 } });

    const populatedOrder = await Order.findById(createdOrder._id)
      .populate('shopId', 'name slug businessType logoUrl')
      .populate('tableId')
      .populate('diningSessionId');

    notifyShopNewOrder(createdOrder, shop).catch((error) => console.error('Lỗi thông báo đơn hàng:', error.message));
    emitToShop(shop._id, 'order:new', { order: populatedOrder });
    emitToAdmins('order:new', { order: populatedOrder });
    sendPushToShop(shop._id, {
      title: `Đơn mới${table ? ` · ${table.name}` : ''}`,
      body: `#${createdOrder.orderCode} · ${Number(createdOrder.totalAmount).toLocaleString('vi-VN')}đ · ${createdOrder.paymentStatus === 'paid' ? 'Đã thanh toán' : createdOrder.paymentStatus === 'pending' ? 'Chờ thanh toán' : 'Chưa thanh toán'}`,
      tag: `order-${createdOrder._id}`,
      url: '/dashboard',
      data: { orderId: String(createdOrder._id), tableNumber: table?.tableNumber || null }
    }).catch((error) => console.error('Push đơn cho shop lỗi:', error.message));
    sendPushToAdmins({
      title: `Đơn mới · ${shop.name}`,
      body: `#${createdOrder.orderCode} · ${Number(createdOrder.totalAmount).toLocaleString('vi-VN')}đ`,
      tag: `admin-order-${createdOrder._id}`,
      url: '/admin'
    }).catch((error) => console.error('Push đơn cho admin lỗi:', error.message));

    const paymentUrl = finalPaymentMethod === 'vnpay'
      ? createPaymentUrl(createdOrder, req.headers['x-forwarded-for'] || req.socket.remoteAddress)
      : '';
    const currentBill = diningSession ? await buildCurrentBill(diningSession) : null;

    return res.status(201).json({
      order: populatedOrder,
      diningSession: diningSession ? {
        _id: diningSession._id,
        sessionCode: diningSession.sessionCode,
        activeBillNumber: diningSession.activeBillNumber
      } : null,
      currentBill,
      requiresVnpay: finalPaymentMethod === 'vnpay',
      paymentUrl,
      bankTransfer: finalPaymentMethod === 'bank_transfer' ? {
        orderCode: createdOrder.orderCode,
        reference: paymentReference,
        qrUrl: bankQrUrl,
        bankName: shop.bankName,
        accountNumber: shop.bankAccountNumber,
        accountName: shop.bankAccountName,
        amount: createdOrder.totalAmount,
        sepayEnabled: Boolean(shop.sepayEnabled)
      } : null
    });
  } catch (error) {
    if (createdOrder && error?.message === 'Số xu không đủ') {
      await Order.deleteOne({ _id: createdOrder._id }).catch(() => {});
    }
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
      Order.find(query).populate('tableId').populate('diningSessionId').sort({ createdAt: -1 }).skip(skip).limit(limit),
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
      .populate('tableId')
      .populate('diningSessionId');
    emitToShop(order.shopId, 'order:updated', { order: populatedOrder });
    emitToAdmins('order:updated', { order: populatedOrder });
    return res.json({ order: populatedOrder });
  } catch (error) {
    return next(error);
  }
};

exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const allowed = ['unpaid', 'pending', 'partial', 'paid', 'failed', 'refunded'];
    if (!allowed.includes(req.body.paymentStatus)) {
      return res.status(400).json({ message: 'Trạng thái thanh toán không hợp lệ' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    const shop = await Shop.findById(order.shopId);
    const isOwner = shop && String(shop.ownerId) === String(req.user._id);
    if (!isOwner && req.user.role !== 'admin') return res.status(403).json({ message: 'Bạn không có quyền cập nhật thanh toán' });

    const paymentStatus = req.body.paymentStatus;

    // Đơn tại bàn: mọi lượt gọi món trong cùng DiningSession là một hóa đơn tổng.
    if (order.orderType === 'dine_in' && order.diningSessionId) {
      const session = await DiningSession.findById(order.diningSessionId);
      if (!session) return res.status(404).json({ message: 'Không tìm thấy phiên bàn' });
      if (session.status === 'closed') return res.status(400).json({ message: 'Phiên bàn đã đóng, không thể sửa thanh toán' });

      const sessionOrders = await Order.find({
        diningSessionId: session._id,
        status: { $ne: 'cancelled' }
      }).sort({ orderRound: 1, createdAt: 1 });
      const totalAmount = sessionOrders.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
      const currentPaid = (session.payments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const remainingBefore = Math.max(0, totalAmount - currentPaid);

      const loyaltyPhone = normalizePhone(req.body.loyaltyPhone) || session.loyaltyPhone || sessionOrders.find((item) => item.loyaltyPhone)?.loyaltyPhone || sessionOrders.find((item) => item.phone)?.phone || '';
      const skipLoyalty = Boolean(req.body.skipLoyalty) || !loyaltyPhone;
      session.loyaltyPhone = loyaltyPhone;
      session.skipLoyalty = skipLoyalty;

      if (paymentStatus === 'paid') {
        const requestedAmount = Number(req.body.amount);
        const amount = Number.isFinite(requestedAmount) && requestedAmount > 0
          ? Math.min(requestedAmount, remainingBefore)
          : remainingBefore;

        if (amount > 0) {
          session.payments.push({
            amount,
            method: ['cash', 'bank_transfer', 'vnpay'].includes(req.body.paymentMethod) ? req.body.paymentMethod : (order.paymentMethod || 'cash'),
            paidAt: new Date(),
            recordedBy: req.user._id,
            note: String(req.body.note || '').trim()
          });
        }

        const paidAmount = (session.payments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const fullyPaid = totalAmount > 0 && paidAmount >= totalAmount;
        session.paidAmount = Math.min(totalAmount, paidAmount);
        session.paymentStatus = fullyPaid ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
        session.paidAt = fullyPaid ? new Date() : null;
        session.lastActivityAt = new Date();

        for (const billOrder of sessionOrders) {
          if (loyaltyPhone) billOrder.loyaltyPhone = loyaltyPhone;
          billOrder.paymentStatus = fullyPaid ? 'paid' : 'pending';
          billOrder.paidAt = fullyPaid ? session.paidAt : null;
          if (fullyPaid && billOrder.status !== 'cancelled') billOrder.status = 'completed';
          await billOrder.save();
        }
        await session.save();

        // Chỉ cộng xu khi nhân viên đóng phiên để bảo đảm tổng hóa đơn cuối cùng
        // đã bao gồm mọi lượt gọi thêm sau lần thanh toán trước.
      } else if (paymentStatus === 'refunded') {
        session.paymentStatus = 'refunded';
        session.paidAmount = 0;
        session.paidAt = null;
        session.payments = [];
        await session.save();
        for (const billOrder of sessionOrders) {
          billOrder.paymentStatus = 'refunded';
          billOrder.paidAt = null;
          await billOrder.save();
          await releaseOrderBenefits(billOrder, shop, 'Hoàn ưu đãi do hóa đơn tổng được hoàn tiền');
        }
      } else {
        // Trạng thái trung gian chỉ áp dụng cho các lượt gọi món chưa chốt.
        session.paymentStatus = paymentStatus === 'unpaid' ? 'unpaid' : 'partial';
        await session.save();
        for (const billOrder of sessionOrders) {
          billOrder.paymentStatus = paymentStatus;
          if (paymentStatus !== 'paid') billOrder.paidAt = null;
          await billOrder.save();
        }
      }

      const populatedOrders = await Order.find({ diningSessionId: session._id, status: { $ne: 'cancelled' } })
        .populate('shopId', 'name slug logoUrl')
        .populate('tableId')
        .populate('diningSessionId')
        .sort({ orderRound: 1, createdAt: 1 });
      const currentBill = await buildCurrentBill(session);
      populatedOrders.forEach((item) => {
        emitToShop(item.shopId?._id || item.shopId, 'order:updated', { order: item, currentBill });
        emitToAdmins('order:updated', { order: item, currentBill });
      });
      return res.json({
        order: populatedOrders.find((item) => String(item._id) === String(order._id)) || populatedOrders[0],
        orders: populatedOrders,
        diningSession: session,
        currentBill,
        paidAt: currentBill.paidAt,
        loyaltyRewardCoins: session.loyaltyRewardCoins || 0,
        loyaltyPhone: session.loyaltyPhone || ''
      });
    }

    // Đơn giao hàng / nhận tại shop: ưu tiên SĐT của đơn, nếu nhân viên nhập thì dùng số mới.
    const loyaltyPhone = normalizePhone(req.body.loyaltyPhone) || order.loyaltyPhone || normalizePhone(order.phone) || '';
    order.loyaltyPhone = loyaltyPhone;
    order.paymentStatus = paymentStatus;
    order.paidAt = paymentStatus === 'paid' ? new Date() : null;
    order.paymentUpdatedAt = new Date();
    if (paymentStatus === 'paid' && order.paymentMethod === 'bank_transfer') {
      order.bankReceivedAmount = Math.max(Number(order.bankReceivedAmount || 0), Number(order.totalAmount || 0));
    }
    if (paymentStatus === 'paid' && order.status !== 'cancelled') order.status = 'completed';
    await order.save();
    if (paymentStatus === 'paid' && loyaltyPhone && !req.body.skipLoyalty) await rewardOrderCoins(order, shop);
    if (['failed', 'refunded'].includes(paymentStatus)) await releaseOrderBenefits(order, shop, 'Hoàn ưu đãi do thanh toán không thành công');

    const populatedOrder = await Order.findById(order._id)
      .populate('shopId', 'name slug logoUrl')
      .populate('tableId')
      .populate('diningSessionId');
    emitToShop(order.shopId, 'order:updated', { order: populatedOrder });
    emitToAdmins('order:updated', { order: populatedOrder });
    return res.json({ order: populatedOrder, orders: [populatedOrder], paidAt: order.paidAt, loyaltyRewardCoins: order.loyaltyRewardCoins || 0, loyaltyPhone });
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
      .populate('tableId')
      .populate('diningSessionId');

    emitToShop(order.shopId, 'order:updated', { order: populatedOrder });
    emitToAdmins('order:updated', { order: populatedOrder });
    return res.json({ order: populatedOrder });
  } catch (error) {
    return next(error);
  }
};

