const Conversation = require('../models/Conversation');
const Shop = require('../models/Shop');
const { emitToShop, emitToAdmins, emitToCustomer } = require('../realtime');
const { parsePagination, buildPagination, escapeRegex } = require('../utils/query');
const { isApproved } = require('../utils/shopAccess');

const appendMessage = (conversation, message) => {
  conversation.messages.push(message);
  conversation.lastMessage = message.text;
  conversation.lastSenderRole = message.senderRole;

  // Chỉ người nhận được cộng chưa đọc.
  if (conversation.type === 'customer_shop') {
    if (message.senderRole === 'customer') conversation.unreadForSeller += 1;
    if (message.senderRole === 'seller') conversation.unreadForCustomer += 1;
  }
  if (conversation.type === 'shop_admin') {
    if (message.senderRole === 'seller') conversation.unreadForAdmin += 1;
    if (message.senderRole === 'admin') conversation.unreadForSeller += 1;
  }
};

const getSellerShop = async (userId) => Shop.findOne({ ownerId: userId });
const hydrate = async (conversation, fields = 'name slug logoUrl ownerId businessType') => {
  await conversation.populate('shopId', fields);
  return conversation;
};
const latestMessage = (conversation) => conversation.messages[conversation.messages.length - 1] || null;

const conversationFilter = (query, base = {}) => {
  const filter = { ...base };
  const search = String(query.search || '').trim();
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { customerName: regex },
      { customerPhone: regex },
      { subject: regex },
      { lastMessage: regex }
    ];
  }
  if (query.status && ['open', 'closed'].includes(query.status)) filter.status = query.status;
  return filter;
};

exports.customerStartConversation = async (req, res, next) => {
  try {
    const { shopSlug, customerSessionId, customerName, customerPhone, text } = req.body;
    if (!shopSlug || !customerSessionId || !customerName || !String(text || '').trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập tên và nội dung tin nhắn' });
    }

    const shop = await Shop.findOne({ slug: shopSlug });
    if (!shop || !shop.isActive || !isApproved(shop)) {
      return res.status(404).json({ message: 'Shop không tồn tại hoặc chưa khả dụng' });
    }

    let conversation = await Conversation.findOne({
      type: 'customer_shop',
      shopId: shop._id,
      customerSessionId,
      status: 'open'
    });

    if (!conversation) {
      conversation = new Conversation({
        type: 'customer_shop',
        shopId: shop._id,
        customerSessionId,
        customerName,
        customerPhone,
        subject: `Khách ${customerName} nhắn tin cho shop`
      });
    } else {
      conversation.customerName = customerName;
      conversation.customerPhone = customerPhone || conversation.customerPhone;
      conversation.unreadForCustomer = 0;
    }

    appendMessage(conversation, {
      senderRole: 'customer',
      senderName: customerName,
      text: String(text).trim()
    });

    await conversation.save();
    await hydrate(conversation);
    emitToShop(shop._id, 'chat:customer', {
      conversation,
      message: latestMessage(conversation),
      notification: { title: `Tin nhắn từ ${customerName}`, body: String(text).trim(), kind: 'customer_shop' }
    });
    return res.status(201).json({ conversation });
  } catch (error) {
    return next(error);
  }
};

exports.customerGetConversation = async (req, res, next) => {
  try {
    const { shopSlug, customerSessionId } = req.query;
    if (!shopSlug || !customerSessionId) return res.json({ conversation: null });
    const shop = await Shop.findOne({ slug: shopSlug });
    if (!shop) return res.json({ conversation: null });

    const conversation = await Conversation.findOne({
      type: 'customer_shop',
      shopId: shop._id,
      customerSessionId,
      status: 'open'
    }).populate('shopId', 'name slug logoUrl');
    return res.json({ conversation });
  } catch (error) {
    return next(error);
  }
};

exports.customerReply = async (req, res, next) => {
  try {
    const { customerSessionId, customerName, text } = req.body;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.type !== 'customer_shop') {
      return res.status(404).json({ message: 'Không tìm thấy hội thoại' });
    }
    if (conversation.customerSessionId !== customerSessionId) {
      return res.status(403).json({ message: 'Không có quyền gửi tin nhắn vào hội thoại này' });
    }
    if (!String(text || '').trim()) return res.status(400).json({ message: 'Tin nhắn không được để trống' });

    conversation.unreadForCustomer = 0;
    appendMessage(conversation, {
      senderRole: 'customer',
      senderName: customerName || conversation.customerName || 'Khách hàng',
      text: String(text).trim()
    });

    await conversation.save();
    await hydrate(conversation);
    emitToShop(conversation.shopId._id || conversation.shopId, 'chat:customer', {
      conversation,
      message: latestMessage(conversation),
      notification: { title: `Tin nhắn từ ${conversation.customerName || 'khách hàng'}`, body: String(text).trim(), kind: 'customer_shop' }
    });
    return res.json({ conversation });
  } catch (error) {
    return next(error);
  }
};

exports.customerMarkRead = async (req, res, next) => {
  try {
    const { customerSessionId } = req.body;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.type !== 'customer_shop') return res.status(404).json({ message: 'Không tìm thấy hội thoại' });
    if (conversation.customerSessionId !== customerSessionId) return res.status(403).json({ message: 'Không có quyền thao tác hội thoại này' });
    conversation.unreadForCustomer = 0;
    await conversation.save();
    await hydrate(conversation);
    return res.json({ conversation });
  } catch (error) {
    return next(error);
  }
};

exports.sellerListConversations = async (req, res, next) => {
  try {
    const shop = await getSellerShop(req.user._id);
    if (!shop) return res.status(400).json({ message: 'Bạn chưa tạo shop' });

    const type = ['customer_shop', 'shop_admin'].includes(req.query.type) ? req.query.type : undefined;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });
    const filter = conversationFilter(req.query, { shopId: shop._id, ...(type ? { type } : {}) });
    if (req.query.unread === 'true') filter.unreadForSeller = { $gt: 0 };

    const [conversations, total, unreadBreakdown] = await Promise.all([
      Conversation.find(filter)
        .select({ messages: { $slice: -120 } })
        .populate('shopId', 'name slug logoUrl businessType')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments(filter),
      Conversation.aggregate([
        { $match: { shopId: shop._id } },
        { $group: { _id: '$type', unread: { $sum: '$unreadForSeller' } } }
      ])
    ]);

    const unreadTotals = unreadBreakdown.reduce((acc, item) => {
      acc[item._id] = item.unread || 0;
      return acc;
    }, { customer_shop: 0, shop_admin: 0 });

    return res.json({
      shop,
      conversations,
      unreadTotals,
      pagination: buildPagination({ page, limit, total })
    });
  } catch (error) {
    return next(error);
  }
};

exports.sellerMarkRead = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Không tìm thấy hội thoại' });
    const shop = await Shop.findById(conversation.shopId);
    if (!shop || String(shop.ownerId) !== String(req.user._id)) return res.status(403).json({ message: 'Không có quyền thao tác hội thoại này' });
    conversation.unreadForSeller = 0;
    await conversation.save();
    await hydrate(conversation);
    return res.json({ conversation });
  } catch (error) {
    return next(error);
  }
};

exports.sellerReplyCustomer = async (req, res, next) => {
  try {
    const { text } = req.body;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.type !== 'customer_shop') return res.status(404).json({ message: 'Không tìm thấy hội thoại khách hàng' });

    const shop = await Shop.findById(conversation.shopId);
    if (!shop || String(shop.ownerId) !== String(req.user._id)) return res.status(403).json({ message: 'Bạn không có quyền trả lời hội thoại này' });
    if (!String(text || '').trim()) return res.status(400).json({ message: 'Tin nhắn không được để trống' });

    conversation.unreadForSeller = 0;
    appendMessage(conversation, {
      senderRole: 'seller',
      senderId: req.user._id,
      senderName: req.user.name,
      text: String(text).trim()
    });

    await conversation.save();
    await hydrate(conversation);
    emitToCustomer(conversation.shopId._id || conversation.shopId, conversation.customerSessionId, 'chat:reply', {
      conversation,
      message: latestMessage(conversation),
      notification: { title: `${shop.name} vừa trả lời`, body: String(text).trim(), kind: 'customer_shop' }
    });
    return res.json({ conversation });
  } catch (error) {
    return next(error);
  }
};

exports.sellerSendAdmin = async (req, res, next) => {
  try {
    const { text, subject } = req.body;
    const shop = await getSellerShop(req.user._id);
    if (!shop) return res.status(400).json({ message: 'Bạn chưa tạo shop' });
    if (!String(text || '').trim()) return res.status(400).json({ message: 'Vui lòng nhập nội dung tin nhắn' });

    let conversation = await Conversation.findOne({ type: 'shop_admin', shopId: shop._id, status: 'open' });
    if (!conversation) {
      conversation = new Conversation({
        type: 'shop_admin',
        shopId: shop._id,
        subject: subject || `Shop ${shop.name} liên hệ admin tổng`
      });
    }

    conversation.unreadForSeller = 0;
    appendMessage(conversation, {
      senderRole: 'seller',
      senderId: req.user._id,
      senderName: req.user.name,
      text: String(text).trim()
    });

    await conversation.save();
    await hydrate(conversation);
    emitToAdmins('chat:admin', {
      conversation,
      message: latestMessage(conversation),
      notification: { title: `${shop.name} vừa nhắn admin`, body: String(text).trim(), kind: 'shop_admin' }
    });
    return res.status(201).json({ conversation });
  } catch (error) {
    return next(error);
  }
};

exports.adminListConversations = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });
    const filter = conversationFilter(req.query, { type: 'shop_admin' });
    if (req.query.unread === 'true') filter.unreadForAdmin = { $gt: 0 };

    const [conversations, total, unreadAgg] = await Promise.all([
      Conversation.find(filter)
        .select({ messages: { $slice: -120 } })
        .populate('shopId', 'name slug logoUrl ownerId businessType customDomain')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments(filter),
      Conversation.aggregate([
        { $match: { type: 'shop_admin' } },
        { $group: { _id: null, unread: { $sum: '$unreadForAdmin' } } }
      ])
    ]);
    return res.json({
      conversations,
      unreadTotal: unreadAgg[0]?.unread || 0,
      pagination: buildPagination({ page, limit, total })
    });
  } catch (error) {
    return next(error);
  }
};

exports.adminMarkRead = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.type !== 'shop_admin') return res.status(404).json({ message: 'Không tìm thấy hội thoại với shop' });
    conversation.unreadForAdmin = 0;
    await conversation.save();
    await hydrate(conversation);
    return res.json({ conversation });
  } catch (error) {
    return next(error);
  }
};

exports.adminReplySeller = async (req, res, next) => {
  try {
    const { text } = req.body;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.type !== 'shop_admin') return res.status(404).json({ message: 'Không tìm thấy hội thoại với shop' });
    if (!String(text || '').trim()) return res.status(400).json({ message: 'Tin nhắn không được để trống' });

    conversation.unreadForAdmin = 0;
    appendMessage(conversation, {
      senderRole: 'admin',
      senderId: req.user._id,
      senderName: req.user.name,
      text: String(text).trim()
    });

    await conversation.save();
    await hydrate(conversation);
    emitToShop(conversation.shopId._id || conversation.shopId, 'chat:seller', {
      conversation,
      message: latestMessage(conversation),
      notification: { title: 'Admin tổng vừa trả lời', body: String(text).trim(), kind: 'shop_admin' }
    });
    return res.json({ conversation });
  } catch (error) {
    return next(error);
  }
};
