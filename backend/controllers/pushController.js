const PushSubscription = require('../models/PushSubscription');
const Shop = require('../models/Shop');
const { configured, sendPushToUser } = require('../services/pushService');

exports.getPublicKey = async (req, res) => {
  return res.json({ configured: configured(), publicKey: configured() ? process.env.VAPID_PUBLIC_KEY : '' });
};

exports.subscribe = async (req, res, next) => {
  try {
    const subscription = req.body.subscription || req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ message: 'Push subscription không hợp lệ' });
    }
    const shop = req.user.role === 'seller' ? await Shop.findOne({ ownerId: req.user._id }).select('_id') : null;
    const record = await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: {
          userId: req.user._id,
          shopId: shop?._id || null,
          role: req.user.role,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          userAgent: String(req.headers['user-agent'] || ''),
          isActive: true,
          lastUsedAt: new Date()
        }
      },
      { upsert: true, new: true, runValidators: true }
    );
    return res.status(201).json({ subscription: record, configured: configured(), message: 'Đã bật thông báo nền cho thiết bị này' });
  } catch (error) {
    return next(error);
  }
};

exports.unsubscribe = async (req, res, next) => {
  try {
    const endpoint = String(req.body.endpoint || '');
    if (endpoint) await PushSubscription.deleteOne({ endpoint, userId: req.user._id });
    return res.json({ message: 'Đã tắt thông báo nền trên thiết bị này' });
  } catch (error) {
    return next(error);
  }
};

exports.test = async (req, res, next) => {
  try {
    const result = await sendPushToUser(req.user._id, {
      title: 'Ngự Tâm Holdings',
      body: 'Thông báo nền trên thiết bị này đã hoạt động.',
      tag: `push-test-${req.user._id}`,
      url: req.user.role === 'admin' ? '/admin' : '/dashboard'
    });
    return res.json({ ...result, message: result.sent ? 'Đã gửi thông báo thử' : 'Chưa có thiết bị nhận push hoặc VAPID chưa cấu hình' });
  } catch (error) {
    return next(error);
  }
};
