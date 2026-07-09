const Order = require('../models/Order');
const Shop = require('../models/Shop');
const SepayTransaction = require('../models/SepayTransaction');
const { verifyReturn } = require('../services/vnpayService');
const { emitToShop, emitToAdmins } = require('../realtime');
const { rewardOrderCoins, releaseOrderBenefits } = require('../services/loyaltyService');
const { sendPushToShop } = require('../services/pushService');
const { sendTelegramMessage } = require('../services/notificationService');
const {
  normalizeAccount,
  verifyWebhookApiKey,
  findOrderCodeInPayload
} = require('../services/sepayService');

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const populateOrder = (id) => Order.findById(id)
  .populate('shopId', 'name slug logoUrl telegramChatId')
  .populate('tableId')
  .populate('diningSessionId');

const broadcastPayment = async ({ order, shop, channel, amount }) => {
  const populatedOrder = await populateOrder(order._id);
  emitToShop(order.shopId, 'order:updated', { order: populatedOrder });
  emitToAdmins('order:updated', { order: populatedOrder });

  const paidText = order.paymentStatus === 'paid'
    ? `Đã nhận đủ ${money(order.totalAmount)}`
    : `Đã nhận ${money(order.bankReceivedAmount || amount)} / ${money(order.totalAmount)}`;

  await sendPushToShop(order.shopId, {
    title: `Thanh toán ${channel} · #${order.orderCode}`,
    body: paidText,
    tag: `payment-${order._id}`,
    url: '/dashboard',
    data: { orderId: String(order._id), paymentStatus: order.paymentStatus }
  }).catch(() => null);

  const chatId = shop?.telegramChatId || process.env.TELEGRAM_CHAT_ID;
  if (chatId) {
    await sendTelegramMessage({
      chatId,
      text: [
        '✅ <b>ĐÃ NHẬN THANH TOÁN</b>',
        `<b>Đơn:</b> #${order.orderCode}`,
        `<b>Kênh:</b> ${channel}`,
        `<b>Số tiền:</b> ${money(amount)}`,
        `<b>Trạng thái:</b> ${paidText}`
      ].join('\n')
    }).catch(() => null);
  }
  return populatedOrder;
};

const processVnpayResult = async (query) => {
  const order = await Order.findOne({ orderCode: query.vnp_TxnRef });
  if (!order) return { ok: false, message: 'Không tìm thấy đơn hàng' };
  if (!verifyReturn(query)) return { ok: false, message: 'Chữ ký VNPAY không hợp lệ', order };

  const expectedAmount = Math.round(Number(order.totalAmount || 0) * 100);
  const receivedAmount = Number(query.vnp_Amount || 0);
  if (receivedAmount !== expectedAmount) {
    return { ok: false, message: 'Số tiền VNPAY không khớp đơn hàng', order };
  }

  const success = query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';
  const shop = await Shop.findById(order.shopId);

  if (success) {
    if (order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.paidAt = new Date();
      order.paymentUpdatedAt = new Date();
      order.vnpayTransactionNo = String(query.vnp_TransactionNo || '');
      order.vnpayBankCode = String(query.vnp_BankCode || '');
      if (order.status === 'pending') order.status = 'confirmed';
      await order.save();
      if (shop) await rewardOrderCoins(order, shop);
      await broadcastPayment({ order, shop, channel: 'VNPAY', amount: order.totalAmount });
    }
  } else {
    if (order.paymentStatus !== 'paid') {
      order.paymentStatus = 'failed';
      order.paymentUpdatedAt = new Date();
      await order.save();
      if (shop) await releaseOrderBenefits(order, shop, 'Hoàn ưu đãi do VNPAY thất bại');
      const populatedOrder = await populateOrder(order._id);
      emitToShop(order.shopId, 'order:updated', { order: populatedOrder });
      emitToAdmins('order:updated', { order: populatedOrder });
    }
  }

  return {
    ok: success,
    order: await populateOrder(order._id),
    message: success ? 'Thanh toán thành công' : 'Thanh toán thất bại'
  };
};

exports.vnpayReturn = async (req, res, next) => {
  try {
    const result = await processVnpayResult(req.query);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const shopSlug = result.order?.shopId?.slug || '';
    const params = new URLSearchParams({
      status: result.ok ? 'success' : 'failed',
      orderCode: result.order?.orderCode || req.query.vnp_TxnRef || '',
      shopSlug,
      message: result.message
    });
    res.redirect(`${clientUrl}/payment-result?${params.toString()}`);
  } catch (error) {
    next(error);
  }
};

exports.vnpayIpn = async (req, res) => {
  try {
    const result = await processVnpayResult(req.query);
    if (!result.order) return res.json({ RspCode: '01', Message: 'Order not found' });
    if (!verifyReturn(req.query)) return res.json({ RspCode: '97', Message: 'Invalid signature' });
    return res.json({ RspCode: result.ok ? '00' : '02', Message: result.message });
  } catch (error) {
    console.error('VNPAY IPN error:', error);
    return res.json({ RspCode: '99', Message: 'Unknown error' });
  }
};

exports.sepayWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    const transactionId = String(payload.id || '').trim();
    if (!transactionId) return res.status(400).json({ success: false, message: 'Thiếu mã giao dịch SePay' });

    let transaction = await SepayTransaction.findOne({ transactionId });
    if (transaction?.matched) {
      return res.status(200).json({ success: true, duplicated: true, matched: true });
    }

    const orderCode = findOrderCodeInPayload(payload);
    const order = orderCode
      ? await Order.findOne({ $or: [{ paymentReference: orderCode }, { orderCode }] })
      : null;
    const shop = order ? await Shop.findById(order.shopId).select('+sepayWebhookApiKey') : null;

    const globalKey = String(process.env.SEPAY_WEBHOOK_API_KEY || '').trim();
    const shopKey = String(shop?.sepayWebhookApiKey || '').trim();
    if (!globalKey && !shopKey) {
      return res.status(503).json({ success: false, message: 'Chưa cấu hình API key webhook SePay' });
    }
    if (!verifyWebhookApiKey({ authorization: req.headers.authorization, globalKey, shopKey })) {
      return res.status(401).json({ success: false, message: 'API key webhook SePay không hợp lệ' });
    }

    const transferAmount = Math.max(0, Number(payload.transferAmount || 0));
    const incoming = String(payload.transferType || '').toLowerCase() === 'in';
    const receivedAccount = normalizeAccount(payload.accountNumber);
    const shopAccount = normalizeAccount(shop?.bankAccountNumber);
    const primaryAccount = normalizeAccount(process.env.BANK_ACCOUNT_NUMBER || process.env.SEPAY_PRIMARY_ACCOUNT_NUMBER || '');
    const allowedAccounts = [shopAccount, primaryAccount].filter(Boolean);

    // Mặc định SaaS đối soát bằng mã đơn/paymentReference trong nội dung CK.
    // SePay/VA có thể báo accountNumber là tài khoản chính thay vì VA của shop,
    // nên nếu khóa cứng theo shop.bankAccountNumber thì tiền vào rồi nhưng đơn không paid.
    // Chỉ bật strict nếu thật sự muốn bắt đúng accountNumber.
    const strictAccountCheck = String(process.env.SEPAY_STRICT_ACCOUNT_CHECK || '').toLowerCase() === 'true';
    const accountMatches = !strictAccountCheck || !receivedAccount || !allowedAccounts.length || allowedAccounts.includes(receivedAccount);

    if (!transaction) {
      transaction = await SepayTransaction.create({
        transactionId,
        orderId: order?._id || null,
        shopId: shop?._id || null,
        gateway: String(payload.gateway || ''),
        accountNumber: String(payload.accountNumber || ''),
        transferType: String(payload.transferType || ''),
        transferAmount,
        transactionDate: payload.transactionDate ? new Date(String(payload.transactionDate).replace(' ', 'T') + '+07:00') : new Date(),
        content: String(payload.content || ''),
        code: String(payload.code || ''),
        referenceCode: String(payload.referenceCode || ''),
        matched: Boolean(order && incoming && accountMatches),
        rawPayload: { ...payload, receivedAccount, allowedAccounts, strictAccountCheck }
      });
    } else {
      transaction.orderId = order?._id || transaction.orderId || null;
      transaction.shopId = shop?._id || transaction.shopId || null;
      transaction.gateway = String(payload.gateway || transaction.gateway || '');
      transaction.accountNumber = String(payload.accountNumber || transaction.accountNumber || '');
      transaction.transferType = String(payload.transferType || transaction.transferType || '');
      transaction.transferAmount = transferAmount || transaction.transferAmount || 0;
      transaction.transactionDate = payload.transactionDate ? new Date(String(payload.transactionDate).replace(' ', 'T') + '+07:00') : (transaction.transactionDate || new Date());
      transaction.content = String(payload.content || transaction.content || '');
      transaction.code = String(payload.code || transaction.code || '');
      transaction.referenceCode = String(payload.referenceCode || transaction.referenceCode || '');
      transaction.matched = Boolean(order && incoming && accountMatches);
      transaction.rawPayload = { ...payload, receivedAccount, allowedAccounts, strictAccountCheck, retriedAfterUnmatched: true };
      await transaction.save();
    }

    if (!order) return res.status(200).json({ success: true, matched: false, message: 'Không tìm thấy đơn tương ứng' });
    if (order.paymentMethod !== 'bank_transfer') {
      return res.status(200).json({ success: true, matched: false, message: 'Đơn không dùng chuyển khoản QR' });
    }
    if (!incoming || transferAmount <= 0) {
      return res.status(200).json({ success: true, matched: false, message: 'Không phải giao dịch tiền vào' });
    }
    if (!accountMatches) {
      transaction.matched = false;
      transaction.rawPayload = { ...(transaction.rawPayload || payload), receivedAccount, allowedAccounts, strictAccountCheck, rejectReason: 'account_mismatch' };
      await transaction.save();
      return res.status(200).json({
        success: true,
        matched: false,
        message: 'Sai tài khoản nhận tiền do SEPAY_STRICT_ACCOUNT_CHECK=true',
        receivedAccount,
        allowedAccounts
      });
    }

    order.bankReceivedAmount = Number(order.bankReceivedAmount || 0) + transferAmount;
    order.sepayTransactionId = transactionId;
    order.sepayReferenceCode = String(payload.referenceCode || '');
    order.sepayGateway = String(payload.gateway || '');
    order.paymentUpdatedAt = new Date();

    if (order.bankReceivedAmount >= Number(order.totalAmount || 0)) {
      order.paymentStatus = 'paid';
      order.paidAt = payload.transactionDate
        ? new Date(String(payload.transactionDate).replace(' ', 'T') + '+07:00')
        : new Date();
      if (order.status === 'pending') order.status = 'confirmed';
    } else {
      order.paymentStatus = 'partial';
    }
    await order.save();

    if (order.paymentStatus === 'paid' && shop) await rewardOrderCoins(order, shop);
    await broadcastPayment({ order, shop, channel: 'Chuyển khoản QR / SePay', amount: transferAmount });

    return res.status(200).json({
      success: true,
      matched: true,
      orderCode: order.orderCode,
      paymentStatus: order.paymentStatus,
      receivedAmount: order.bankReceivedAmount,
      totalAmount: order.totalAmount
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(200).json({ success: true, duplicated: true });
    console.error('SePay webhook error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Webhook error' });
  }
};

exports.getOrderPaymentStatus = async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderCode: String(req.params.orderCode || '').toUpperCase() })
      .select('orderCode paymentMethod paymentStatus paidAt totalAmount bankReceivedAmount paymentReference sepayGateway sepayReferenceCode status');
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    return res.json({
      orderCode: order.orderCode,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paidAt: order.paidAt,
      totalAmount: order.totalAmount,
      receivedAmount: order.bankReceivedAmount || (order.paymentStatus === 'paid' ? order.totalAmount : 0),
      remainingAmount: Math.max(0, Number(order.totalAmount || 0) - Number(order.bankReceivedAmount || 0)),
      paymentReference: order.paymentReference,
      gateway: order.sepayGateway,
      referenceCode: order.sepayReferenceCode,
      orderStatus: order.status
    });
  } catch (error) {
    return next(error);
  }
};
