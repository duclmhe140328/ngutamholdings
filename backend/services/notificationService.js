const axios = require('axios');

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const labels = {
  dine_in: 'Ăn tại bàn', delivery: 'Giao tận nơi', pickup: 'Nhận tại quán', shipping: 'Gửi hàng',
  cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', vnpay: 'VNPAY'
};

const buildOrderMessage = (order, shop) => {
  const items = order.products.map((item) => `• ${escapeHtml(item.name)} x ${item.quantity} = ${formatMoney(item.price * item.quantity)}`).join('\n');
  return [
    '🔔 <b>CÓ ĐƠN HÀNG MỚI</b>',
    `<b>Shop:</b> ${escapeHtml(shop.name)}`,
    `<b>Mã đơn:</b> #${order.orderCode || String(order._id).slice(-6).toUpperCase()}`,
    order.tableNumber ? `<b>Bàn:</b> ${order.tableNumber}` : '',
    `<b>Hình thức:</b> ${labels[order.orderType] || order.orderType}`,
    `<b>Khách:</b> ${escapeHtml(order.customerName)}`,
    order.phone ? `<b>SĐT:</b> ${escapeHtml(order.phone)}` : '',
    order.address ? `<b>Địa chỉ:</b> ${escapeHtml(order.address)}` : '',
    order.note ? `<b>Ghi chú:</b> ${escapeHtml(order.note)}` : '',
    '', items, '',
    `<b>Tổng tiền:</b> ${formatMoney(order.totalAmount)}`,
    `<b>Thanh toán:</b> ${labels[order.paymentMethod] || order.paymentMethod}`
  ].filter(Boolean).join('\n');
};

const sendTelegramMessage = async ({ chatId, text }) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return { ok: false, skipped: true, channel: 'telegram' };
  const { data } = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: 'HTML'
  });
  return { ok: true, channel: 'telegram', data };
};

const sendZaloWebhook = async ({ webhookUrl, text, order, shop }) => {
  if (!webhookUrl) return { ok: false, skipped: true, channel: 'zalo' };
  const { data } = await axios.post(webhookUrl, { event: 'new_order', text, order, shop }, { timeout: 10000 });
  return { ok: true, channel: 'zalo', data };
};

const notifyShopNewOrder = async (order, shop) => {
  const text = buildOrderMessage(order, shop);
  const results = [];
  try {
    results.push(await sendTelegramMessage({ chatId: shop.telegramChatId || process.env.TELEGRAM_CHAT_ID, text }));
  } catch (error) {
    results.push({ ok: false, channel: 'telegram', error: error.message });
  }
  try {
    results.push(await sendZaloWebhook({ webhookUrl: shop.zaloWebhookUrl || process.env.ZALO_WEBHOOK_URL, text, order, shop }));
  } catch (error) {
    results.push({ ok: false, channel: 'zalo', error: error.message });
  }
  return results;
};

module.exports = { buildOrderMessage, notifyShopNewOrder, sendTelegramMessage, sendZaloWebhook };
