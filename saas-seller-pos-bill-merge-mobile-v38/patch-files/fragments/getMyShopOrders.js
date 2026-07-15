exports.getMyShopOrders = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) return res.status(400).json({ message: 'Bạn chưa tạo cửa hàng' });

    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 100 });

    // FH_V38_GROUPED_ORDERS: POS có thể xin order thô; tab Đơn hàng mặc định nhận 1 dòng/1 phiên bàn.
    if (String(req.query.rawDining || '') === '1') {
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
      const [orders, total] = await Promise.all([
        Order.find(query).populate('tableId').populate('diningSessionId').sort({ createdAt: -1 }).skip(skip).limit(limit),
        Order.countDocuments(query)
      ]);
      return res.json({ shop, orders, summary: null, pagination: buildPagination({ page, limit, total }) });
    }

    const [regularOrders, activeSessionIds] = await Promise.all([
      Order.find({ shopId: shop._id, orderType: { $ne: 'dine_in' } }).populate('tableId').sort({ createdAt: -1 }).lean(),
      Order.distinct('diningSessionId', { shopId: shop._id, diningSessionId: { $ne: null }, status: { $ne: 'cancelled' } })
    ]);

    const sessions = req.query.orderType && req.query.orderType !== 'dine_in'
      ? []
      : await DiningSession.find({ shopId: shop._id, _id: { $in: activeSessionIds } }).populate('tableId').sort({ openedAt: -1 });

    const sessionRows = (await Promise.all(sessions.map(async (session) => {
      const bill = await buildCurrentBill(session);
      if (!bill.orderCount) return null;
      const representative = bill.orders[0] || null;
      const subtotal = bill.orders.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      const couponDiscount = bill.orders.reduce((sum, item) => sum + Number(item.couponDiscount || 0), 0);
      const coinDiscount = bill.orders.reduce((sum, item) => sum + Number(item.coinDiscount || 0), 0);
      const paymentMethods = [...new Set((bill.payments || []).map((item) => item.method).filter(Boolean))];
      return {
        _id: `session-${session._id}`,
        representativeOrderId: representative?._id || null,
        diningSessionId: session._id,
        isDiningSessionInvoice: true,
        orderCode: session.sessionCode,
        shopId: session.shopId,
        tableId: session.tableId,
        tableNumber: session.tableNumber,
        orderType: 'dine_in',
        customerName: bill.customerNames.join(', ') || `Khách Bàn ${session.tableNumber}`,
        customerNames: bill.customerNames,
        phone: bill.loyaltyPhone || '',
        loyaltyPhone: bill.loyaltyPhone || '',
        address: '',
        note: `Hóa đơn tổng phiên bàn ${session.sessionCode}`,
        products: bill.products,
        subtotal,
        deliveryFee: 0,
        couponCode: representative?.couponCode || '',
        couponDiscount,
        coinDiscount,
        totalAmount: bill.totalAmount,
        paidAmount: bill.paidAmount,
        remainingAmount: bill.remainingAmount,
        paymentMethod: paymentMethods.length === 1 ? paymentMethods[0] : paymentMethods.length > 1 ? 'multiple' : (representative?.paymentMethod || 'cash'),
        paymentStatus: bill.paymentStatus,
        paidAt: bill.paidAt,
        paymentHistory: bill.payments,
        status: session.status === 'closed' ? 'completed' : 'serving',
        invoiceStatus: representative?.invoiceStatus || 'not_issued',
        createdAt: session.openedAt,
        updatedAt: session.updatedAt,
        finalizedAt: session.finalizedAt,
        orderCount: bill.orderCount,
        orders: bill.orders
      };
    }))).filter(Boolean);

    const allRows = [
      ...sessionRows,
      ...regularOrders.map((item) => ({ ...item, representativeOrderId: item._id }))
    ];

    const summary = allRows.reduce((acc, item) => {
      acc.totalOrders += 1;
      if (item.paymentStatus === 'paid') acc.revenue += Number(item.totalAmount || 0);
      if (['pending', 'confirmed', 'preparing', 'ready', 'serving', 'shipping'].includes(item.status)) acc.pending += 1;
      if (item.paymentStatus !== 'paid' && item.status !== 'cancelled') acc.unpaid += 1;
      if (item.orderType === 'dine_in') acc.dineIn += 1;
      return acc;
    }, { totalOrders: 0, revenue: 0, pending: 0, unpaid: 0, dineIn: 0 });

    const search = String(req.query.search || '').trim().toLowerCase();
    const from = req.query.dateFrom ? new Date(`${req.query.dateFrom}T00:00:00`) : null;
    const to = req.query.dateTo ? new Date(`${req.query.dateTo}T23:59:59.999`) : null;
    const filtered = allRows.filter((item) => {
      const text = [item.orderCode, item.customerName, item.phone, item.address, ...(item.customerNames || []), ...(item.products || []).map((product) => product.name)].join(' ').toLowerCase();
      const createdAt = new Date(item.createdAt || 0);
      return (!search || text.includes(search))
        && (!req.query.status || item.status === req.query.status)
        && (!req.query.paymentStatus || item.paymentStatus === req.query.paymentStatus)
        && (!req.query.orderType || item.orderType === req.query.orderType)
        && (!req.query.paymentMethod || item.paymentMethod === req.query.paymentMethod)
        && (!req.query.invoiceStatus || (item.invoiceStatus || 'not_issued') === req.query.invoiceStatus)
        && (!from || createdAt >= from)
        && (!to || createdAt <= to);
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = filtered.length;
    const orders = filtered.slice(skip, skip + limit);
    return res.json({ shop, orders, summary, pagination: buildPagination({ page, limit, total }) });
  } catch (error) {
    return next(error);
  }
};
