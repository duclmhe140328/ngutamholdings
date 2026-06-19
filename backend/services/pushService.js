const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const Shop = require('../models/Shop');

const configured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

const setup = () => {
  if (!configured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return true;
};

setup();

const payloadString = (payload) => JSON.stringify({
  title: payload.title || 'Ngự Tâm Holdings',
  body: payload.body || 'Bạn có thông báo mới.',
  icon: payload.icon || '/icons/icon-192.png',
  badge: payload.badge || '/icons/icon-192.png',
  tag: payload.tag || `notification-${Date.now()}`,
  url: payload.url || '/dashboard',
  data: payload.data || {}
});

const sendToSubscriptions = async (subscriptions, payload) => {
  if (!configured() || !subscriptions.length) return { sent: 0, failed: 0, configured: configured() };
  setup();
  let sent = 0;
  let failed = 0;
  await Promise.all(subscriptions.map(async (record) => {
    try {
      await webpush.sendNotification({ endpoint: record.endpoint, keys: record.keys }, payloadString(payload), { TTL: 60 * 60 });
      sent += 1;
      record.lastUsedAt = new Date();
      record.isActive = true;
      await record.save().catch(() => null);
    } catch (error) {
      failed += 1;
      if ([404, 410].includes(error.statusCode)) {
        await PushSubscription.deleteOne({ _id: record._id }).catch(() => null);
      } else {
        console.error('Web Push lỗi:', error.statusCode || '', error.message);
      }
    }
  }));
  return { sent, failed, configured: true };
};

const sendPushToUser = async (userId, payload) => {
  if (!userId) return { sent: 0, failed: 0, configured: configured() };
  const subscriptions = await PushSubscription.find({ userId, isActive: true });
  return sendToSubscriptions(subscriptions, payload);
};

const sendPushToShop = async (shopId, payload) => {
  if (!shopId) return { sent: 0, failed: 0, configured: configured() };
  const shop = await Shop.findById(shopId).select('ownerId');
  if (!shop) return { sent: 0, failed: 0, configured: configured() };
  const subscriptions = await PushSubscription.find({ userId: shop.ownerId, isActive: true });
  return sendToSubscriptions(subscriptions, payload);
};

const sendPushToAdmins = async (payload) => {
  const subscriptions = await PushSubscription.find({ role: 'admin', isActive: true });
  return sendToSubscriptions(subscriptions, payload);
};

module.exports = { configured, sendToSubscriptions, sendPushToUser, sendPushToShop, sendPushToAdmins };
