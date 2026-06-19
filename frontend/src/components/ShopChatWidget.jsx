import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios.js';
import { connectSocket } from '../realtime/socket.js';
import { playMessageSound, requestNotificationPermission, showMessageNotification } from '../utils/messageNotifications.js';

const makeSession = () => `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const ShopChatWidget = ({ shop, slug }) => {
  const storageKey = `chat_session_${slug}`;
  const [sessionId] = useState(() => localStorage.getItem(storageKey) || makeSession());
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', text: '' });
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const messageEndRef = useRef(null);

  useEffect(() => { localStorage.setItem(storageKey, sessionId); }, [sessionId, storageKey]);

  useEffect(() => {
    api.get('/chat/customer/thread', { params: { shopSlug: slug, customerSessionId: sessionId } })
      .then((res) => setConversation(res.data.conversation))
      .catch(() => { });
  }, [slug, sessionId]);

  const markRead = async (thread = conversation) => {
    if (!thread?._id || !thread.unreadForCustomer) return;
    setConversation((current) => current ? { ...current, unreadForCustomer: 0 } : current);
    try {
      const res = await api.post(`/chat/customer/${thread._id}/read`, { customerSessionId: sessionId });
      setConversation(res.data.conversation);
    } catch {
      // Giữ UX tức thì; lần tải sau server sẽ đồng bộ lại.
    }
  };

  useEffect(() => {
    if (open && conversation?.unreadForCustomer > 0) markRead(conversation);
  }, [open, conversation?._id]);

  useEffect(() => {
    if (!shop?._id) return undefined;
    const socket = connectSocket();
    socket.emit('join:customer', { shopId: shop._id, customerSessionId: sessionId });

    const onReply = ({ conversation: next, notification }) => {
      if (open) {
        setConversation({ ...next, unreadForCustomer: 0 });
        api.post(`/chat/customer/${next._id}/read`, { customerSessionId: sessionId }).catch(() => { });
      } else {
        setConversation(next);
        setToast(notification?.title || `${shop.name} vừa trả lời bạn`);
        playMessageSound();
        showMessageNotification({
          title: notification?.title || `${shop.name} vừa trả lời`,
          body: notification?.body || next.lastMessage || 'Bạn có tin nhắn mới',
          tag: `customer-chat-${next._id}`,
          url: window.location.href
        });
      }
    };

    socket.on('chat:reply', onReply);
    return () => socket.off('chat:reply', onReply);
  }, [shop?._id, shop?.name, sessionId, open]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (open) messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [open, conversation?.messages?.length]);

  const messages = useMemo(() => conversation?.messages || [], [conversation]);
  const unread = Number(conversation?.unreadForCustomer || 0);

  const toggleChat = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      await requestNotificationPermission();
      if (conversation?.unreadForCustomer) markRead(conversation);
    }
  };

  const send = async () => {
    if (!form.text.trim()) return;
    if (!conversation && !form.customerName.trim()) {
      setError('Vui lòng nhập tên của bạn');
      return;
    }
    setError('');
    try {
      const res = conversation
        ? await api.post(`/chat/customer/${conversation._id}/reply`, {
          customerSessionId: sessionId,
          customerName: form.customerName || conversation.customerName,
          text: form.text
        })
        : await api.post('/chat/customer/start', {
          shopSlug: slug,
          customerSessionId: sessionId,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          text: form.text
        });
      // Response của chính người gửi phải luôn có unreadForCustomer = 0.
      setConversation({ ...res.data.conversation, unreadForCustomer: 0 });
      setForm((current) => ({ ...current, text: '' }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
  .shop-chat-fab {
    bottom: 20px !important; /* Dịch xuống dưới */
    right: auto !important;  /* Góc phải dưới */
  }
}
      `}</style>
      {toast && <div className="customer-chat-toast">💬 {toast}</div>}
      <button className={`shop-chat-fab ${unread ? 'has-unread' : ''}`} onClick={toggleChat} aria-label={`Nhắn cửa hàng, ${unread} tin chưa đọc`}>
        <span>✦</span>
        <div><b>Private concierge</b><small>Nhắn cửa hàng</small></div>
        {unread > 0 && <em>{unread > 99 ? '99+' : unread}</em>}
      </button>

      {open && (
        <div className="shop-chat-panel" role="dialog" aria-label="Trò chuyện với cửa hàng">
          <header>
            <div>
              <img src={shop?.logoUrl || 'https://placehold.co/80'} alt="" />
              <span><b>{shop?.name}</b><small>● Thường trả lời trong ít phút</small></span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Đóng trò chuyện">×</button>
          </header>

          <div className="shop-chat-messages">
            {messages.map((msg) => {
              const mine = msg.senderRole === 'customer';
              return (
                <div key={msg._id || msg.createdAt} className={`message ${mine ? 'mine' : 'theirs'}`}>
                  <small>{mine ? 'Bạn' : (msg.senderName || shop?.name || 'Cửa hàng')}</small>
                  <p>{msg.text}</p>
                </div>
              );
            })}
            {!messages.length && <div className="chat-welcome"><b>Xin chào 👋</b><p>Cửa hàng có thể hỗ trợ gì cho bạn?</p></div>}
            <div ref={messageEndRef} />
          </div>

          {!conversation && (
            <div className="chat-identity">
              <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Tên của bạn" />
              <input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="Số điện thoại (không bắt buộc)" inputMode="tel" />
            </div>
          )}
          {error && <small className="chat-error">{error}</small>}
          <footer>
            <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Nhập tin nhắn..." onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button onClick={send} aria-label="Gửi tin nhắn">➤</button>
          </footer>
        </div>
      )}
    </>
  );
};

export default ShopChatWidget;