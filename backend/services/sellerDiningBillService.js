const Product = require('../models/Product');
const Order = require('../models/Order');
const Shop = require('../models/Shop');
const DiningSession = require('../models/DiningSession');
const Coupon = require('../models/Coupon');
const CustomerVoucher = require('../models/CustomerVoucher');
const { normalizePhone } = require('../utils/phone');
const {
  buildCurrentBill,
  buildSessionInvoice,
  closeDiningSession
} = require('./diningSessionService');
const {
  releaseOrderBenefits,
  rewardDiningSessionCoins
} = require('./loyaltyService');

let PlatformCoupon = null;
try {
  // Có ở bản marketing toàn hệ thống. Dùng optional để patch vẫn chạy nếu project chưa bật module này.
  PlatformCoupon = require('../models/PlatformCoupon');
} catch {
  PlatformCoupon = null;
}

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const makeOrderCode = () => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `FH${stamp}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
};

const computeDiscount = (coupon, subtotal) => {
  let discount = coupon.discountType === 'percentage'
    ? subtotal * Number(coupon.discountValue || 0) / 100
    : Number(coupon.discountValue || 0);
  if (Number(coupon.maxDiscount || 0) > 0) discount = Math.min(discount, Number(coupon.maxDiscount || 0));
  return Math.max(0, Math.min(Number(subtotal || 0), Math.floor(discount)));
};

const assertSellerSession = async ({ sessionId, user }) => {
  const session = await DiningSession.findById(sessionId);
  if (!session) throw Object.assign(new Error('Không tìm thấy phiên bàn'), { statusCode: 404 });
  const shop = await Shop.findById(session.shopId);
  if (!shop) throw Object.assign(new Error('Không tìm thấy cửa hàng của phiên bàn'), { statusCode: 404 });
  const allowed = user?.role === 'admin' || String(shop.ownerId) === String(user?._id);
  if (!allowed) throw Object.assign(new Error('Bạn không có quyền chỉnh hóa đơn bàn này'), { statusCode: 403 });
  return { session, shop };
};

const normalizeRequestedItems = async ({ shop, items }) => {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => ({ productId: String(item.productId || item._id || ''), quantity: Math.max(0, Math.min(999, Math.floor(Number(item.quantity || 0)))) }))
    .filter((item) => item.productId && item.quantity > 0);
  if (!normalized.length) throw Object.assign(new Error('Hóa đơn phải có ít nhất một sản phẩm'), { statusCode: 400 });

  const uniqueIds = [...new Set(normalized.map((item) => item.productId))];
  const products = await Product.find({ _id: { $in: uniqueIds }, shopId: shop._id });
  if (products.length !== uniqueIds.length) {
    throw Object.assign(new Error('Có sản phẩm không thuộc cửa hàng hoặc đã bị xóa'), { statusCode: 400 });
  }

  const orderProducts = [];
  let subtotal = 0;
  for (const item of normalized) {
    const product = products.find((entry) => String(entry._id) === item.productId);
    const price = Number(product.salePrice > 0 ? product.salePrice : product.price);
    orderProducts.push({
      productId: product._id,
      name: product.name,
      image: product.images?.[0] || '',
      price,
      quantity: item.quantity
    });
    subtotal += price * item.quantity;
  }
  return { orderProducts, subtotal };
};

const validateCouponForSeller = async ({ shop, code, phone, subtotal, currentSessionId }) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return { coupon: null, customerVoucher: null, platformCoupon: null, discount: 0, kind: '' };
  const now = new Date();
  const normalizedPhone = normalizePhone(phone);

  const customerVoucher = await CustomerVoucher.findOne({ shopId: shop._id, code: normalizedCode }).populate('couponId');
  let coupon = customerVoucher?.couponId || await Coupon.findOne({ shopId: shop._id, code: normalizedCode });
  let platformCoupon = null;
  let kind = coupon ? 'shop' : '';

  if (!coupon && PlatformCoupon) {
    platformCoupon = await PlatformCoupon.findOne({ code: normalizedCode });
    if (platformCoupon) {
      const applies = platformCoupon.appliesToAll || (platformCoupon.shopIds || []).some((id) => String(id) === String(shop._id));
      if (!applies) platformCoupon = null;
      else kind = 'platform';
    }
  }

  const target = coupon || platformCoupon;
  if (!target || !target.isActive) throw Object.assign(new Error('Mã giảm giá không tồn tại hoặc đã tắt'), { statusCode: 400 });
  if (target.startsAt && target.startsAt > now) throw Object.assign(new Error('Mã giảm giá chưa đến thời gian sử dụng'), { statusCode: 400 });
  if (target.endsAt && target.endsAt < now) throw Object.assign(new Error('Mã giảm giá đã hết hạn'), { statusCode: 400 });
  if (Number(subtotal) < Number(target.minOrder || 0)) {
    throw Object.assign(new Error(`Đơn tối thiểu ${money(target.minOrder)} để dùng mã`), { statusCode: 400 });
  }
  if (Number(target.usageLimit || 0) > 0 && Number(target.usedCount || 0) >= Number(target.usageLimit || 0)) {
    throw Object.assign(new Error('Mã giảm giá đã hết lượt sử dụng'), { statusCode: 400 });
  }

  if (customerVoucher) {
    if (!normalizedPhone || customerVoucher.phone !== normalizedPhone) {
      throw Object.assign(new Error('Voucher này không thuộc số điện thoại đang chọn'), { statusCode: 400 });
    }
    if (customerVoucher.usedAt) {
      const usedOrder = customerVoucher.orderId ? await Order.findById(customerVoucher.orderId).select('diningSessionId') : null;
      if (!usedOrder || String(usedOrder.diningSessionId || '') !== String(currentSessionId || '')) {
        throw Object.assign(new Error('Voucher đã được sử dụng'), { statusCode: 400 });
      }
    }
    if (customerVoucher.expiresAt && customerVoucher.expiresAt < now) {
      throw Object.assign(new Error('Voucher đã hết hạn'), { statusCode: 400 });
    }
  } else if (Number(target.perPhoneLimit || 0) > 0 && normalizedPhone) {
    const query = {
      shopId: shop._id,
      phone: normalizedPhone,
      couponCode: normalizedCode,
      status: { $ne: 'cancelled' },
      diningSessionId: { $ne: currentSessionId }
    };
    const used = await Order.countDocuments(query);
    if (used >= Number(target.perPhoneLimit || 0)) {
      throw Object.assign(new Error('Số điện thoại đã dùng hết lượt của mã này'), { statusCode: 400 });
    }
  }

  return {
    coupon,
    customerVoucher,
    platformCoupon,
    discount: computeDiscount(target, subtotal),
    kind
  };
};

const previewSellerBill = async ({ session, shop, items, couponCode, loyaltyPhone }) => {
  const { orderProducts, subtotal } = await normalizeRequestedItems({ shop, items });
  const coupon = await validateCouponForSeller({
    shop,
    code: couponCode,
    phone: loyaltyPhone,
    subtotal,
    currentSessionId: session._id
  });
  const totalAmount = Math.max(0, subtotal - Number(coupon.discount || 0));
  return {
    products: orderProducts,
    subtotal,
    couponCode: String(couponCode || '').trim().toUpperCase(),
    couponDiscount: Number(coupon.discount || 0),
    totalAmount,
    couponTitle: coupon.coupon?.title || coupon.platformCoupon?.title || '',
    couponKind: coupon.kind,
    coupon
  };
};

const getEditorPayload = async ({ session, shop }) => {
  const currentBill = await buildCurrentBill(session);
  const products = await Product.find({ shopId: shop._id, isActive: true }).sort({ category: 1, name: 1 }).lean();
  const representative = currentBill.orders?.[0] || null;
  const paidAmount = Number(currentBill.paidAmount || 0);
  return {
    session: {
      _id: session._id,
      sessionCode: session.sessionCode,
      tableNumber: session.tableNumber,
      status: session.status,
      paymentStatus: currentBill.paymentStatus,
      paidAmount,
      remainingAmount: Number(currentBill.remainingAmount || 0)
    },
    currentBill,
    items: (currentBill.products || []).map((item) => ({
      productId: String(item.productId || ''),
      name: item.name,
      image: item.image || '',
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 0)
    })),
    products,
    couponCode: representative?.couponCode || '',
    couponDiscount: Number(representative?.couponDiscount || 0),
    loyaltyPhone: session.loyaltyPhone || currentBill.loyaltyPhone || '',
    canEdit: session.status === 'open' && paidAmount <= 0,
    representativeOrderId: representative?._id || null
  };
};

const resetMasterBenefitFields = (master) => {
  master.coinsUsed = 0;
  master.coinDiscount = 0;
  master.customerVoucherId = null;
  master.couponCode = '';
  master.couponDiscount = 0;
  master.benefitsReleasedAt = null;
  if (master.schema.path('shopCoinsUsed')) master.shopCoinsUsed = 0;
  if (master.schema.path('platformCoinsUsed')) master.platformCoinsUsed = 0;
  if (master.schema.path('platformCouponId')) master.platformCouponId = null;
};

const applyCouponUsage = async ({ preview, master }) => {
  const { coupon, customerVoucher, platformCoupon, kind } = preview.coupon;
  if (customerVoucher) {
    await CustomerVoucher.updateOne(
      { _id: customerVoucher._id, $or: [{ usedAt: null }, { orderId: master._id }] },
      { $set: { usedAt: new Date(), orderId: master._id } }
    );
    master.customerVoucherId = customerVoucher._id;
  }
  if (kind === 'platform' && platformCoupon) {
    await PlatformCoupon.updateOne({ _id: platformCoupon._id }, { $inc: { usedCount: 1 } });
    if (master.schema.path('platformCouponId')) master.platformCouponId = platformCoupon._id;
  } else if (coupon) {
    await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
  }
};

const rewriteSessionBill = async ({ session, shop, user, preview, loyaltyPhone }) => {
  const activeOrders = await Order.find({ diningSessionId: session._id, status: { $ne: 'cancelled' } }).sort({ orderRound: 1, createdAt: 1 });
  if (!activeOrders.length) throw Object.assign(new Error('Phiên bàn chưa có món để chỉnh'), { statusCode: 400 });
  if (Number((session.payments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)) > 0) {
    throw Object.assign(new Error('Hóa đơn đã thu một phần hoặc toàn bộ nên không thể sửa món/voucher'), { statusCode: 400 });
  }

  const master = activeOrders[0];
  for (const order of activeOrders) {
    await releaseOrderBenefits(order, shop, 'Hoàn ưu đãi trước khi nhân viên chỉnh hóa đơn bàn');
  }
  for (const order of activeOrders.slice(1)) {
    order.status = 'cancelled';
    order.note = `${String(order.note || '').trim()}\n[Gộp vào hóa đơn tổng ${session.sessionCode} bởi ${user?.name || user?._id || 'seller'}]`.trim();
    await order.save();
  }

  resetMasterBenefitFields(master);
  master.products = preview.products;
  master.subtotal = preview.subtotal;
  master.deliveryFee = 0;
  master.couponCode = preview.couponCode;
  master.couponDiscount = preview.couponDiscount;
  master.totalAmount = preview.totalAmount;
  master.phone = normalizePhone(loyaltyPhone) || master.phone || '';
  master.loyaltyPhone = normalizePhone(loyaltyPhone) || '';
  master.paymentMethod = 'pay_later';
  master.paymentStatus = 'unpaid';
  master.paidAt = null;
  master.paymentUpdatedAt = new Date();
  master.status = 'serving';
  master.note = `${String(master.note || '').trim()}\n[Hóa đơn đã được seller chỉnh/gộp lúc ${new Date().toISOString()}]`.trim();
  await master.save();

  if (preview.couponCode) {
    await applyCouponUsage({ preview, master });
    await master.save();
  }

  session.loyaltyPhone = normalizePhone(loyaltyPhone) || '';
  session.skipLoyalty = !session.loyaltyPhone;
  session.payments = [];
  session.paidAmount = 0;
  session.paymentStatus = 'unpaid';
  session.paidAt = null;
  session.lastActivityAt = new Date();
  await session.save();
  return master;
};

const settleSellerBill = async ({ session, shop, user, payload }) => {
  const action = ['save', 'pay', 'close', 'pay_and_close'].includes(payload.action) ? payload.action : 'save';
  const currentBillBefore = await buildCurrentBill(session);

  if (session.status === 'closed') throw Object.assign(new Error('Phiên bàn đã đóng'), { statusCode: 400 });

  let master = currentBillBefore.orders?.[0] || null;
  let preview = null;
  const needsRewrite = action !== 'close' || Number(currentBillBefore.paidAmount || 0) <= 0;
  if (needsRewrite) {
    preview = await previewSellerBill({
      session,
      shop,
      items: payload.items,
      couponCode: payload.couponCode,
      loyaltyPhone: payload.loyaltyPhone
    });
    master = await rewriteSessionBill({
      session,
      shop,
      user,
      preview,
      loyaltyPhone: payload.loyaltyPhone
    });
  }

  if (!master) throw Object.assign(new Error('Phiên bàn chưa có đơn hàng'), { statusCode: 400 });

  if (['pay', 'pay_and_close'].includes(action)) {
    const bill = await buildCurrentBill(session);
    const totalAmount = Number(bill.totalAmount || 0);
    session.payments = totalAmount > 0 ? [{
      amount: totalAmount,
      method: ['cash', 'bank_transfer', 'vnpay', 'other'].includes(payload.paymentMethod) ? payload.paymentMethod : 'cash',
      paidAt: new Date(),
      recordedBy: user._id,
      note: String(payload.paymentNote || 'Seller xác nhận thanh toán hóa đơn tổng').trim()
    }] : [];
    session.paidAmount = totalAmount;
    session.paymentStatus = 'paid';
    session.paidAt = new Date();
    session.lastActivityAt = new Date();
    await session.save();

    master.paymentMethod = ['cash', 'bank_transfer', 'vnpay'].includes(payload.paymentMethod) ? payload.paymentMethod : 'cash';
    master.paymentStatus = 'paid';
    master.paidAt = session.paidAt;
    master.paymentUpdatedAt = new Date();
    master.status = 'completed';
    await master.save();
  }

  if (['close', 'pay_and_close'].includes(action)) {
    const bill = await buildCurrentBill(session);
    if (Number(bill.remainingAmount || 0) > 0) {
      throw Object.assign(new Error(`Hóa đơn còn ${money(bill.remainingAmount)} chưa thanh toán`), { statusCode: 400 });
    }
    if (session.loyaltyPhone && !session.skipLoyalty) {
      await rewardDiningSessionCoins({
        session,
        shop,
        totalAmount: bill.totalAmount,
        representativeOrderId: master._id
      });
    }
    await closeDiningSession({
      session,
      userId: user._id,
      reason: String(payload.reason || 'Seller kết thúc phiên từ màn hình chỉnh hóa đơn').trim()
    });
  }

  const currentBill = await buildCurrentBill(session);
  const invoice = await buildSessionInvoice(session);
  const invoiceOrders = currentBill.orders || [];
  invoice.subtotal = invoiceOrders.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  invoice.couponDiscount = invoiceOrders.reduce((sum, item) => sum + Number(item.couponDiscount || 0), 0);
  invoice.coinDiscount = invoiceOrders.reduce((sum, item) => sum + Number(item.coinDiscount || 0), 0);
  invoice.couponCode = invoiceOrders.find((item) => item.couponCode)?.couponCode || '';
  invoice.totalAmount = currentBill.totalAmount;
  invoice.products = currentBill.products;
  return {
    session,
    currentBill,
    invoice,
    order: master,
    action,
    message: action === 'save'
      ? 'Đã lưu thay đổi hóa đơn bàn'
      : action === 'pay'
        ? 'Đã cập nhật món, voucher và xác nhận thanh toán'
        : action === 'close'
          ? 'Đã đóng bàn'
          : 'Đã cập nhật hóa đơn, thanh toán và đóng bàn'
  };
};

module.exports = {
  assertSellerSession,
  getEditorPayload,
  previewSellerBill,
  settleSellerBill
};
