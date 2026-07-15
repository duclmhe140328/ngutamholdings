exports.rebuildDiningSessionBill = async (req, res, next) => {
  let replacementOrder = null;
  try {
    const {
      shopSlug, tableToken, diningSessionId, tableEditToken, items, customerName, phone, note,
      couponCode, coinsToUse
    } = req.body;
    if (!shopSlug || !tableToken || !diningSessionId) return res.status(400).json({ message: 'Thiếu thông tin phiên bàn' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Hóa đơn phải có ít nhất một sản phẩm' });

    const shop = await Shop.findOne({ slug: shopSlug, isActive: true });
    if (!shop || !isApproved(shop)) return res.status(404).json({ message: 'Cửa hàng chưa khả dụng' });
    const table = await DiningTable.findOne({ shopId: shop._id, qrToken: tableToken, isActive: true });
    if (!table) return res.status(404).json({ message: 'QR bàn không hợp lệ hoặc bàn đã bị khóa' });
    const diningSession = await DiningSession.findOne({ _id: diningSessionId, shopId: shop._id, tableId: table._id, status: 'open' });
    if (!diningSession) return res.status(409).json({ message: 'Phiên bàn đã kết thúc hoặc không còn hợp lệ' });

    const editPayload = verifyTableCheckoutEditToken(tableEditToken);
    const validEditToken = editPayload
      && String(editPayload.shopId) === String(shop._id)
      && String(editPayload.tableId) === String(table._id)
      && String(editPayload.diningSessionId) === String(diningSession._id);
    if (!validEditToken) return res.status(403).json({ message: 'Quyền sửa hóa đơn đã hết hạn. Hãy nhập lại mã ID cửa hàng.' });

    const oldOrders = await Order.find({ diningSessionId: diningSession._id, status: { $ne: 'cancelled' } }).sort({ orderRound: 1, createdAt: 1 });
    const hasPayment = (diningSession.payments || []).some((payment) => Number(payment.amount || 0) > 0)
      || oldOrders.some((order) => ['paid', 'partial'].includes(order.paymentStatus));
    if (hasPayment) return res.status(409).json({ message: 'Hóa đơn đã ghi nhận thanh toán nên không thể sửa sản phẩm. Hãy nhờ quản trị shop hoàn hoặc hủy giao dịch trước.' });

    const pricing = await buildOrderPricing({
      req, shop, items, orderType: 'dine_in', phone, couponCode, coinsToUse,
      customerLatitude: null, customerLongitude: null
    });
    if (shop.minOrder > 0 && pricing.subtotal < shop.minOrder) {
      return res.status(400).json({ message: `Đơn tối thiểu ${Number(shop.minOrder).toLocaleString('vi-VN')}đ` });
    }

    const latestRound = await Order.findOne({ diningSessionId: diningSession._id }).sort({ orderRound: -1, createdAt: -1 }).select('orderRound');
    const finalCustomerName = String(customerName || '').trim() || `Khách ${table.name}`;
    replacementOrder = await Order.create({
      orderCode: makeOrderCode(),
      shopId: shop._id,
      tableId: table._id,
      tableNumber: table.tableNumber,
      diningSessionId: diningSession._id,
      billNumber: 1,
      orderRound: Number(latestRound?.orderRound || 0) + 1,
      orderType: 'dine_in',
      customerName: finalCustomerName,
      phone: normalizePhone(phone) || String(phone || '').trim(),
      address: '',
      note: [String(note || '').trim(), 'Hóa đơn tổng đã được chỉnh tại bước thanh toán'].filter(Boolean).join(' · '),
      products: pricing.products,
      subtotal: pricing.subtotal,
      deliveryFee: 0,
      deliveryDistanceKm: 0,
      shopLatitude: shop.storeLatitude,
      shopLongitude: shop.storeLongitude,
      couponCode: pricing.coupon?.code || '',
      couponDiscount: pricing.couponDiscount,
      customerVoucherId: pricing.customerVoucher?._id || null,
      platformCouponId: pricing.platformCoupon?._id || null,
      loyaltyPhone: pricing.verifiedPhone || normalizePhone(phone) || '',
      coinsUsed: pricing.coinsUsed,
      shopCoinsUsed: pricing.shopCoinsUsed || 0,
      platformCoinsUsed: pricing.platformCoinsUsed || 0,
      coinDiscount: pricing.coinDiscount,
      totalAmount: pricing.totalAmount,
      paymentMethod: 'pay_later',
      paymentStatus: 'unpaid',
      paymentUpdatedAt: new Date(),
      status: 'pending'
    });

    if (pricing.platformCoinsUsed > 0) await spendPlatformCoins({ shopId: shop._id, phone: pricing.verifiedPhone, coins: pricing.platformCoinsUsed, orderId: replacementOrder._id });
    if (pricing.shopCoinsUsed > 0) await spendCoins({ shopId: shop._id, phone: pricing.verifiedPhone, coins: pricing.shopCoinsUsed, orderId: replacementOrder._id });
    if (pricing.customerVoucher) await CustomerVoucher.updateOne({ _id: pricing.customerVoucher._id, usedAt: null }, { $set: { usedAt: new Date(), orderId: replacementOrder._id } });
    if (pricing.isPlatformCoupon && pricing.platformCoupon) await PlatformCoupon.updateOne({ _id: pricing.platformCoupon._id }, { $inc: { usedCount: 1 } });
    else if (pricing.coupon) await Coupon.updateOne({ _id: pricing.coupon._id }, { $inc: { usedCount: 1 } });

    for (const oldOrder of oldOrders) {
      await releaseOrderBenefits(oldOrder, shop, 'Hoàn ưu đãi do khách chỉnh lại hóa đơn bàn');
      oldOrder.status = 'cancelled';
      oldOrder.note = [oldOrder.note, `Đã thay bằng hóa đơn ${replacementOrder.orderCode}`].filter(Boolean).join(' · ');
      await oldOrder.save();
    }

    diningSession.customerNames = [...new Set([...(diningSession.customerNames || []), finalCustomerName].filter(Boolean))];
    if (pricing.verifiedPhone || normalizePhone(phone)) diningSession.loyaltyPhone = pricing.verifiedPhone || normalizePhone(phone);
    diningSession.lastActivityAt = new Date();
    await diningSession.save();

    const populatedOrder = await Order.findById(replacementOrder._id)
      .populate('shopId', 'name slug businessType logoUrl')
      .populate('tableId')
      .populate('diningSessionId');
    const currentBill = await buildCurrentBill(diningSession);
    emitToShop(shop._id, 'order:new', { order: populatedOrder });
    emitToAdmins('order:new', { order: populatedOrder });
    notifyShopNewOrder(replacementOrder, shop).catch((error) => console.error('Lỗi thông báo hóa đơn chỉnh:', error.message));
    return res.json({ order: populatedOrder, currentBill, replacedOrders: oldOrders.map((item) => item._id) });
  } catch (error) {
    if (replacementOrder) {
      const shop = await Shop.findById(replacementOrder.shopId).catch(() => null);
      if (shop) await releaseOrderBenefits(replacementOrder, shop, 'Hoàn ưu đãi do chỉnh hóa đơn thất bại').catch(() => {});
      await Order.deleteOne({ _id: replacementOrder._id }).catch(() => {});
    }
    return next(error);
  }
};

