const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const DiningSession = require('../models/DiningSession');
const GuestSession = require('../models/GuestSession');
const Order = require('../models/Order');
const { verifyLoyaltyToken } = require('./loyaltyService');

const secret = () => process.env.DINING_SESSION_SECRET || process.env.JWT_SECRET || 'dev-dining-session-secret';
const hashGuestId = (guestId) => crypto.createHash('sha256').update(String(guestId || '')).digest('hex');
const makeSessionCode = () => `DS${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const createGuestSessionToken = (guestSession) => jwt.sign(
  {
    type: 'dining_guest',
    guestSessionId: String(guestSession._id),
    diningSessionId: String(guestSession.diningSessionId),
    shopId: String(guestSession.shopId),
    tableId: String(guestSession.tableId)
  },
  secret(),
  { expiresIn: '12h' }
);

const verifyGuestSessionToken = (token) => {
  try {
    const payload = jwt.verify(String(token || ''), secret());
    return payload.type === 'dining_guest' ? payload : null;
  } catch {
    return null;
  }
};

const getVerifiedPhone = (req) => {
  const loyaltyToken = req.headers['x-loyalty-token'] || req.body?.loyaltyToken || '';
  return verifyLoyaltyToken(loyaltyToken)?.phone || '';
};

const findOrCreateOpenDiningSession = async ({ shop, table }) => {
  const openKey = String(table._id);
  let session = await DiningSession.findOne({ openKey, status: 'open' });
  if (session) {
    const maxHours = Math.max(1, Number(process.env.DINING_SESSION_MAX_HOURS || 12));
    const stale = Date.now() - new Date(session.lastActivityAt || session.openedAt).getTime() > maxHours * 60 * 60 * 1000;
    if (stale) {
      const currentBill = await buildCurrentBill(session);
      if (currentBill.remainingAmount <= 0) {
        session.status = 'closed';
        session.closedAt = new Date();
        session.finalizedAt = session.finalizedAt || new Date();
        session.finalTotalAmount = currentBill.totalAmount;
        session.finalCustomerNames = currentBill.customerNames;
        session.closeReason = `Tự đóng sau ${maxHours} giờ không hoạt động`;
        session.openKey = undefined;
        await session.save();
        await DiningSession.updateOne({ _id: session._id }, { $unset: { openKey: 1 } });
        await GuestSession.updateMany({ diningSessionId: session._id }, { $set: { status: 'closed' } });
        session = null;
      }
    }
    if (session) return { session, created: false };
  }

  try {
    session = await DiningSession.create({
      sessionCode: makeSessionCode(),
      shopId: shop._id,
      tableId: table._id,
      tableNumber: table.tableNumber,
      openKey,
      status: 'open',
      activeBillNumber: 1,
      openedAt: new Date(),
      lastActivityAt: new Date()
    });
    return { session, created: true };
  } catch (error) {
    if (error.code !== 11000) throw error;
    session = await DiningSession.findOne({ openKey, status: 'open' });
    if (!session) throw error;
    return { session, created: false };
  }
};

const findOrCreateGuestSession = async ({ session, shop, table, guestId, verifiedPhone = '' }) => {
  const safeGuestId = String(guestId || '').trim() || crypto.randomUUID();
  const guestIdHash = hashGuestId(safeGuestId);
  const clauses = [{ guestIdHash }];
  if (verifiedPhone) clauses.push({ phone: verifiedPhone, phoneVerified: true });

  let guestSession = await GuestSession.findOne({
    diningSessionId: session._id,
    status: 'active',
    $or: clauses
  });

  if (!guestSession) {
    try {
      guestSession = await GuestSession.create({
        diningSessionId: session._id,
        shopId: shop._id,
        tableId: table._id,
        guestIdHash,
        phone: verifiedPhone,
        phoneVerified: Boolean(verifiedPhone),
        lastSeenAt: new Date()
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      guestSession = await GuestSession.findOne({ diningSessionId: session._id, guestIdHash });
    }
  } else {
    guestSession.lastSeenAt = new Date();
    if (verifiedPhone) {
      guestSession.phone = verifiedPhone;
      guestSession.phoneVerified = true;
    }
    await guestSession.save();
  }

  return guestSession;
};

const resolveGuestFromToken = async ({ token, session, table }) => {
  const payload = verifyGuestSessionToken(token);
  if (!payload) return null;
  if (String(payload.diningSessionId) !== String(session._id) || String(payload.tableId) !== String(table._id)) return null;
  return GuestSession.findOne({ _id: payload.guestSessionId, diningSessionId: session._id, tableId: table._id, status: 'active' });
};

const getSessionOrders = async (sessionId) => Order.find({
  diningSessionId: sessionId,
  status: { $ne: 'cancelled' }
}).sort({ orderRound: 1, createdAt: 1 });

// Giữ alias để code cũ không bị lỗi, nhưng luôn trả toàn bộ phiên bàn.
const getBillOrders = async (sessionId) => getSessionOrders(sessionId);

const uniqueNames = (orders, session) => {
  const values = [...(session.customerNames || []), ...orders.map((order) => order.customerName)];
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
};

const buildCurrentBill = async (session) => {
  const orders = await getSessionOrders(session._id);
  const products = [];
  const byProduct = new Map();

  orders.forEach((order) => {
    order.products.forEach((item) => {
      const key = `${String(item.productId || '')}:${Number(item.price || 0)}`;
      const current = byProduct.get(key) || {
        productId: item.productId,
        name: item.name,
        image: item.image,
        price: Number(item.price || 0),
        quantity: 0,
        amount: 0
      };
      current.quantity += Number(item.quantity || 0);
      current.amount += Number(item.price || 0) * Number(item.quantity || 0);
      byProduct.set(key, current);
    });
  });
  byProduct.forEach((item) => products.push(item));

  const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const paidAmount = Math.min(totalAmount, (session.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const paymentStatus = totalAmount > 0 && remainingAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
  const paidAt = session.payments?.length ? session.payments[session.payments.length - 1].paidAt : null;
  const customerNames = uniqueNames(orders, session);

  return {
    billNumber: 1,
    orderCount: orders.length,
    totalAmount,
    paidAmount,
    remainingAmount,
    paymentStatus,
    paidAt,
    products,
    orders,
    customerNames,
    loyaltyPhone: session.loyaltyPhone || orders.find((item) => item.loyaltyPhone)?.loyaltyPhone || orders.find((item) => item.phone)?.phone || '',
    payments: session.payments || [],
    finalizedAt: session.finalizedAt,
    status: session.status
  };
};

const buildSessionInvoice = async (session) => {
  const bill = await buildCurrentBill(session);
  const representative = bill.orders[0] || {};
  const paymentMethods = [...new Set((bill.payments || []).map((item) => item.method).filter(Boolean))];
  return {
    _id: representative._id || String(session._id),
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
    note: `Hóa đơn tổng của phiên bàn ${session.sessionCode}`,
    products: bill.products,
    subtotal: bill.totalAmount,
    deliveryFee: 0,
    couponDiscount: 0,
    coinDiscount: 0,
    totalAmount: bill.totalAmount,
    paidAmount: bill.paidAmount,
    remainingAmount: bill.remainingAmount,
    paymentMethod: paymentMethods.length === 1 ? paymentMethods[0] : paymentMethods.length > 1 ? 'multiple' : representative.paymentMethod || 'cash',
    paymentStatus: bill.paymentStatus,
    paidAt: bill.paidAt,
    paymentHistory: bill.payments,
    status: session.status === 'closed' ? 'completed' : 'serving',
    createdAt: session.openedAt,
    finalizedAt: session.finalizedAt,
    orders: bill.orders
  };
};

const closeDiningSession = async ({ session, userId, reason = '' }) => {
  const bill = await buildCurrentBill(session);
  session.status = 'closed';
  session.closedAt = new Date();
  session.closedBy = userId || null;
  session.finalizedAt = new Date();
  session.finalizedBy = userId || null;
  session.finalTotalAmount = bill.totalAmount;
  session.finalCustomerNames = bill.customerNames;
  session.closeReason = String(reason || '').trim();
  session.openKey = undefined;
  await session.save();
  await DiningSession.updateOne({ _id: session._id }, { $unset: { openKey: 1 } });
  await GuestSession.updateMany({ diningSessionId: session._id }, { $set: { status: 'closed' } });
  return session;
};

module.exports = {
  hashGuestId,
  createGuestSessionToken,
  verifyGuestSessionToken,
  getVerifiedPhone,
  findOrCreateOpenDiningSession,
  findOrCreateGuestSession,
  resolveGuestFromToken,
  getSessionOrders,
  getBillOrders,
  buildCurrentBill,
  buildSessionInvoice,
  closeDiningSession
};
