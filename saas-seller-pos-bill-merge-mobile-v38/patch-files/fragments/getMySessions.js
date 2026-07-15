exports.getMySessions = async (req, res, next) => {
  try {
    const sellerShop = await getSellerShop(req.user);
    const shopId = req.user.role === 'admin' && req.query.shopId ? req.query.shopId : sellerShop?._id;
    if (!shopId) return res.status(400).json({ message: 'Không xác định được cửa hàng' });

    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 100 });
    const sessionIdsWithOrders = await Order.distinct('diningSessionId', {
      shopId,
      diningSessionId: { $ne: null },
      status: { $ne: 'cancelled' }
    });
    const query = { shopId, _id: { $in: sessionIdsWithOrders } };
    if (req.query.status && ['open', 'closed'].includes(req.query.status)) query.status = req.query.status;
    if (req.query.tableNumber) query.tableNumber = Number(req.query.tableNumber);

    const [sessions, total] = await Promise.all([
      DiningSession.find(query).populate('tableId').sort({ status: 1, lastActivityAt: -1 }).skip(skip).limit(limit),
      DiningSession.countDocuments(query)
    ]);

    const rows = await Promise.all(sessions.map(async (session) => {
      const currentBill = await buildCurrentBill(session);
      const guestCount = await GuestSession.countDocuments({ diningSessionId: session._id, status: 'active' });
      return { ...session.toObject(), currentBill, guestCount };
    }));

    // FH_V38_NO_GHOST_TABLES: QR chỉ mới mở trang nhưng chưa gọi món sẽ không tạo thẻ 0đ trong POS.
    return res.json({ sessions: rows.filter((item) => Number(item.currentBill?.orderCount || 0) > 0), pagination: buildPagination({ page, limit, total }) });
  } catch (error) {
    return next(error);
  }
};
