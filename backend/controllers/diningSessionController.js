const DiningSession = require('../models/DiningSession');
const GuestSession = require('../models/GuestSession');
const DiningTable = require('../models/DiningTable');
const Shop = require('../models/Shop');
const Order = require('../models/Order');
const { isApproved } = require('../utils/shopAccess');
const { parsePagination, buildPagination } = require('../utils/query');
const { rewardDiningSessionCoins } = require('../services/loyaltyService');
const {
  getVerifiedPhone,
  findOrCreateOpenDiningSession,
  findOrCreateGuestSession,
  resolveGuestFromToken,
  createGuestSessionToken,
  buildCurrentBill,
  buildSessionInvoice,
  closeDiningSession
} = require('../services/diningSessionService');

const getSellerShop = async (user) => {
  if (user.role === 'admin') return null;
  return Shop.findOne({ ownerId: user._id });
};

exports.openOrResume = async (req, res, next) => {
  try {
    const { slug, tableToken } = req.params;
    const guestId = String(req.body.guestId || '').trim();
    if (!guestId) return res.status(400).json({ message: 'Thiếu mã nhận diện thiết bị khách hàng' });

    const shop = await Shop.findOne({ slug, isActive: true });
    if (!shop || !isApproved(shop)) return res.status(404).json({ message: 'Nhà hàng chưa khả dụng' });
    if (shop.businessType !== 'restaurant' || !shop.serviceModes?.includes('dine_in')) {
      return res.status(400).json({ message: 'Cửa hàng này không sử dụng phiên gọi món tại bàn' });
    }

    const table = await DiningTable.findOne({ shopId: shop._id, qrToken: tableToken, isActive: true });
    if (!table) return res.status(404).json({ message: 'QR bàn không hợp lệ hoặc bàn đã bị khóa' });

    const { session, created } = await findOrCreateOpenDiningSession({ shop, table });
    const verifiedPhone = getVerifiedPhone(req);
    let guestSession = await resolveGuestFromToken({ token: req.body.guestSessionToken, session, table });

    // Nếu khách đổi thiết bị nhưng xác thực cùng số điện thoại, ưu tiên phiên khách
    // đã gắn với số đó để nhận diện đúng cùng một người trong phiên bàn.
    if (verifiedPhone) {
      const phoneGuest = await GuestSession.findOne({
        diningSessionId: session._id,
        phone: verifiedPhone,
        phoneVerified: true,
        status: 'active'
      });
      if (phoneGuest && (!guestSession || String(phoneGuest._id) !== String(guestSession._id))) {
        if (guestSession) {
          guestSession.status = 'closed';
          await guestSession.save();
        }
        guestSession = phoneGuest;
      }
    }

    if (!guestSession) {
      guestSession = await findOrCreateGuestSession({ session, shop, table, guestId, verifiedPhone });
    } else {
      guestSession.lastSeenAt = new Date();
      if (verifiedPhone) {
        guestSession.phone = verifiedPhone;
        guestSession.phoneVerified = true;
      }
      await guestSession.save();
    }

    session.lastActivityAt = new Date();
    await session.save();
    const currentBill = await buildCurrentBill(session);

    return res.json({
      session: {
        _id: session._id,
        sessionCode: session.sessionCode,
        status: session.status,
        tableNumber: session.tableNumber,
        activeBillNumber: session.activeBillNumber,
        openedAt: session.openedAt,
        lastActivityAt: session.lastActivityAt
      },
      table,
      guestSessionId: guestSession._id,
      guestSessionToken: createGuestSessionToken(guestSession),
      verifiedPhone: guestSession.phoneVerified ? guestSession.phone : '',
      currentBill,
      resumed: !created || currentBill.orderCount > 0
    });
  } catch (error) {
    return next(error);
  }
};

exports.getMySessions = async (req, res, next) => {
  try {
    const sellerShop = await getSellerShop(req.user);
    const shopId = req.user.role === 'admin' && req.query.shopId ? req.query.shopId : sellerShop?._id;
    if (!shopId) return res.status(400).json({ message: 'Không xác định được cửa hàng' });

    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 100 });
    const query = { shopId };
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

    return res.json({ sessions: rows, pagination: buildPagination({ page, limit, total }) });
  } catch (error) {
    return next(error);
  }
};

exports.closeSession = async (req, res, next) => {
  try {
    const session = await DiningSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Không tìm thấy phiên bàn' });

    const shop = await Shop.findById(session.shopId);
    const allowed = req.user.role === 'admin' || (shop && String(shop.ownerId) === String(req.user._id));
    if (!allowed) return res.status(403).json({ message: 'Bạn không có quyền đóng phiên bàn này' });
    if (session.status === 'closed') return res.json({ session, message: 'Phiên bàn đã được đóng trước đó' });

    const bill = await buildCurrentBill(session);
    if (bill.remainingAmount > 0) {
      return res.status(400).json({
        message: `Hóa đơn tổng của Bàn ${session.tableNumber} còn ${Number(bill.remainingAmount).toLocaleString('vi-VN')}đ chưa thanh toán`,
        currentBill: bill
      });
    }

    const representativeOrder = bill.orders[0] || null;
    if (session.loyaltyPhone && !session.skipLoyalty) {
      await rewardDiningSessionCoins({
        session,
        shop,
        totalAmount: bill.totalAmount,
        representativeOrderId: representativeOrder?._id || null
      });
    }

    await closeDiningSession({ session, userId: req.user._id, reason: req.body.reason });
    const invoice = await buildSessionInvoice(session);
    return res.json({
      session,
      invoice,
      loyaltyRewardCoins: session.loyaltyRewardCoins || 0,
      loyaltyPhone: session.loyaltyPhone || '',
      message: `Đã chốt hóa đơn tổng và đóng phiên Bàn ${session.tableNumber}${session.loyaltyRewardCoins ? ` · cộng ${Number(session.loyaltyRewardCoins).toLocaleString('vi-VN')} xu` : ''}`
    });
  } catch (error) {
    return next(error);
  }
};
