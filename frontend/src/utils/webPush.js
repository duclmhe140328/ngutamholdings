import api from '../api/axios.js';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const getPushSupport = () => ({
  supported: Boolean('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window),
  permission: 'Notification' in window ? Notification.permission : 'unsupported',
  secure: window.isSecureContext
});

export const subscribeWebPush = async () => {
  const support = getPushSupport();
  if (!support.supported) throw new Error('Thiết bị hoặc trình duyệt chưa hỗ trợ Web Push');
  if (!support.secure && location.hostname !== 'localhost') throw new Error('Thông báo nền yêu cầu HTTPS');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Bạn chưa cho phép gửi thông báo');

  const keyResponse = await api.get('/push/public-key');
  if (!keyResponse.data.configured || !keyResponse.data.publicKey) {
    throw new Error('Server chưa cấu hình VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY');
  }

  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error('Service Worker chưa sẵn sàng. Hãy dùng bản production hoặc PWA đã cài.')), 8000))
  ]);
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyResponse.data.publicKey)
    });
  }

  await api.post('/push/subscribe', { subscription: subscription.toJSON() });
  localStorage.setItem('foodhub_web_push_enabled', '1');
  return subscription;
};

export const unsubscribeWebPush = async () => {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await api.post('/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => null);
    await subscription.unsubscribe();
  }
  localStorage.removeItem('foodhub_web_push_enabled');
};

export const testWebPush = async () => api.post('/push/test');

export const isWebPushEnabled = () => localStorage.getItem('foodhub_web_push_enabled') === '1';
