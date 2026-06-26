const mongoose = require('mongoose');

function pad(n) { return String(n).padStart(2, '0'); }
function toDateOnly(d) {
  const dt = new Date(d);
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}
function startOfDay(input) {
  const d = input ? new Date(input + 'T00:00:00.000+07:00') : new Date();
  return d;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function getNumber(obj, keys) {
  for (const k of keys) {
    const v = k.split('.').reduce((a, key) => (a && a[key] !== undefined ? a[key] : undefined), obj);
    const num = Number(v);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
}
function isCancelled(order) {
  const s = String(order.status || order.orderStatus || order.paymentStatus || '').toLowerCase();
  return ['cancel', 'cancelled', 'canceled', 'huy', 'hủy', 'da huy', 'đã hủy', 'failed'].some(x => s.includes(x));
}
function isPaidOnline(order) {
  const p = String(order.paymentMethod || order.method || '').toLowerCase();
  const ps = String(order.paymentStatus || '').toLowerCase();
  return p.includes('vnpay') || p.includes('momo') || p.includes('bank') || p.includes('online') || ps.includes('paid') || ps.includes('success');
}
function matchShop(order, shopId) {
  if (!shopId || shopId === 'global' || shopId === 'all') return true;
  const ids = [
    order.shopId, order.storeId, order.tenantId,
    order.shop && order.shop._id, order.store && order.store._id,
    order.shop, order.store, order.tenant
  ].filter(Boolean).map(String);
  return ids.includes(String(shopId));
}
async function getOrderModel() {
  const names = mongoose.modelNames();
  for (const n of ['Order', 'Orders', 'order', 'orders']) {
    if (names.includes(n)) return mongoose.model(n);
  }
  const schema = new mongoose.Schema({}, { strict: false, collection: process.env.ORDER_COLLECTION || 'orders' });
  return mongoose.models.DailyRevenueOrder || mongoose.model('DailyRevenueOrder', schema);
}
async function getDailyRevenue({ from, to, shopId }) {
  const Order = await getOrderModel();
  const fromDate = startOfDay(from || toDateOnly(new Date()));
  const toDate = addDays(startOfDay(to || from || toDateOnly(new Date())), 1);
  const query = {
    $or: [
      { createdAt: { $gte: fromDate, $lt: toDate } },
      { created_at: { $gte: fromDate, $lt: toDate } },
      { date: { $gte: fromDate, $lt: toDate } }
    ]
  };
  const orders = await Order.find(query).lean();
  const map = new Map();
  for (const order of orders) {
    if (!matchShop(order, shopId)) continue;
    const created = order.createdAt || order.created_at || order.date || order.updatedAt || new Date();
    const day = toDateOnly(created);
    if (!map.has(day)) {
      map.set(day, { date: day, revenue: 0, orders: 0, codRevenue: 0, onlineRevenue: 0, cancelledOrders: 0, averageOrderValue: 0 });
    }
    const row = map.get(day);
    const amount = getNumber(order, ['totalAmount', 'total', 'amount', 'grandTotal', 'finalTotal', 'totalPrice']);
    row.orders += 1;
    if (isCancelled(order)) {
      row.cancelledOrders += 1;
      continue;
    }
    row.revenue += amount;
    if (isPaidOnline(order)) row.onlineRevenue += amount;
    else row.codRevenue += amount;
  }
  const days = [];
  for (let d = new Date(fromDate); d < toDate; d = addDays(d, 1)) {
    const key = toDateOnly(d);
    const row = map.get(key) || { date: key, revenue: 0, orders: 0, codRevenue: 0, onlineRevenue: 0, cancelledOrders: 0, averageOrderValue: 0 };
    row.averageOrderValue = row.orders ? Math.round(row.revenue / row.orders) : 0;
    days.push(row);
  }
  const summary = days.reduce((a, r) => {
    a.revenue += r.revenue;
    a.orders += r.orders;
    a.codRevenue += r.codRevenue;
    a.onlineRevenue += r.onlineRevenue;
    a.cancelledOrders += r.cancelledOrders;
    return a;
  }, { revenue: 0, orders: 0, codRevenue: 0, onlineRevenue: 0, cancelledOrders: 0, averageOrderValue: 0 });
  summary.averageOrderValue = summary.orders ? Math.round(summary.revenue / summary.orders) : 0;
  return { ok: true, shopId: shopId || 'global', from: toDateOnly(fromDate), to: toDateOnly(addDays(toDate, -1)), summary, days };
}
module.exports = { getDailyRevenue };
