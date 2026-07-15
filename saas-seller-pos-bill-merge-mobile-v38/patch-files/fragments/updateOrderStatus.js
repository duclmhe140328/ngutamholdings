exports.updateOrderStatus = async (req, res, next) => {
  try {
    const allowedStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'serving', 'shipping', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(req.body.status)) return res.status(400).json({ message: 'Trạng thái đơn không hợp lệ' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    const shop = await Shop.findById(order.shopId);
    const isOwner = shop && String(shop.ownerId) === String(req.user._id);
    if (!isOwner && req.user.role !== 'admin') return res.status(403).json({ message: 'Bạn không có quyền cập nhật đơn này' });

    // FH_V38_SESSION_STATUS: một dòng hóa đơn tổng đổi trạng thái cho toàn bộ lượt gọi trong phiên.
    const targets = order.diningSessionId
      ? await Order.find({ diningSessionId: order.diningSessionId, status: { $ne: 'cancelled' } })
      : [order];
    for (const target of targets) {
      target.status = req.body.status;
      await target.save();
      if (req.body.status === 'cancelled' && target.paymentStatus !== 'paid') {
        await releaseOrderBenefits(target, shop, 'Hoàn ưu đãi do hóa đơn bàn bị hủy');
      }
    }

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
