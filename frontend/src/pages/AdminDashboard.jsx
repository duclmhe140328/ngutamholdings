import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { connectSocket } from '../realtime/socket.js';
import { playOrderSound } from '../utils/orderSound.js';
import { playMessageSound, requestNotificationPermission, showMessageNotification } from '../utils/messageNotifications.js';
import { useAuth } from '../context/AuthContext.jsx';
import ConversationWorkspace from '../components/ConversationWorkspace.jsx';
import Pagination from '../components/Pagination.jsx';
import PlatformMarketingPanel from '../components/PlatformMarketingPanel.jsx';
import { subscribeWebPush, testWebPush, isWebPushEnabled } from '../utils/webPush.js';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const formatDateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const statusLabels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị', ready: 'Sẵn sàng', serving: 'Đang phục vụ', shipping: 'Đang giao', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
const paymentLabels = { unpaid: 'Chưa thanh toán', partial: 'Đã thu một phần', pending: 'Đang xử lý', paid: 'Đã thanh toán', failed: 'Thất bại', refunded: 'Đã hoàn tiền' };
const typeLabels = { dine_in: 'Tại bàn', delivery: 'Giao tận nơi', pickup: 'Nhận tại shop', shipping: 'Gửi hàng' };
const paymentMethodLabels = { cash: 'Tiền mặt', pay_later: 'Thanh toán sau', bank_transfer: 'Chuyển khoản QR', vnpay: 'VNPAY' };
const emptyPagination = { page: 1, limit: 12, total: 0, totalPages: 1, hasNext: false, hasPrev: false };
const upsertFirst = (list, item, max = 50) => [item, ...list.filter((entry) => entry._id !== item._id)].slice(0, max);
const mergeById = (list, item) => list.some((entry) => entry._id === item._id) ? list.map((entry) => entry._id === item._id ? item : entry) : [item, ...list];
const toParams = (filters, page, limit = 12) => Object.fromEntries(Object.entries({ ...filters, page, limit }).filter(([, value]) => value !== '' && value !== null && value !== undefined && value !== false));


const AdminIcon = ({ name, size = 20, strokeWidth = 1.8 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };

  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    shops: <><path d="M4 10h16" /><path d="M5 10V6.8L7 3h10l2 3.8V10" /><path d="M6 10v10h12V10" /><path d="M9 20v-6h6v6" /><path d="M4 10c0 1.4 1 2.5 2.3 2.5S8.7 11.4 8.7 10c0 1.4 1 2.5 2.3 2.5s2.3-1.1 2.3-2.5c0 1.4 1 2.5 2.3 2.5S18 11.4 18 10c0 1.4.8 2.5 2 2.5" /></>,
    orders: <><path d="M7 3h10v4H7z" /><path d="M5 5h14v16H5z" /><path d="M8 11h8" /><path d="M8 15h8" /><path d="M8 19h5" /></>,
    messages: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 9h8" /><path d="M8 13h5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
    sound: <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18 6a8.5 8.5 0 0 1 0 12" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    external: <><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></>,
    revenue: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5c-.8-.8-2-1.2-3.4-1.2-1.9 0-3.4.9-3.4 2.3 0 1.5 1.3 2.1 3.6 2.5 2.3.4 3.4 1 3.4 2.5 0 1.4-1.5 2.4-3.6 2.4-1.6 0-3-.5-4-1.5" /><path d="M12 5.5v13" /></>,
    pending: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    filter: <><path d="M4 5h16" /><path d="M7 12h10" /><path d="M10 19h4" /></>,
    trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 15H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" /></>
  };

  return <svg {...common}>{paths[name] || paths.overview}</svg>;
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('admin_sound') === 'on');
  const [pushEnabled, setPushEnabled] = useState(isWebPushEnabled());

  const [shops, setShops] = useState([]);
  const [shopPagination, setShopPagination] = useState(emptyPagination);
  const [shopPage, setShopPage] = useState(1);
  const [shopFilters, setShopFilters] = useState({ search: '', businessType: '', approvalStatus: '', isActive: '', dateFrom: '', dateTo: '' });
  const [shopLoading, setShopLoading] = useState(false);

  const [orders, setOrders] = useState([]);
  const [orderPagination, setOrderPagination] = useState(emptyPagination);
  const [orderPage, setOrderPage] = useState(1);
  const [orderFilters, setOrderFilters] = useState({ search: '', shopId: '', status: '', paymentStatus: '', orderType: '', paymentMethod: '', dateFrom: '', dateTo: '' });
  const [orderLoading, setOrderLoading] = useState(false);

  const [users, setUsers] = useState([]);
  const [userPagination, setUserPagination] = useState(emptyPagination);
  const [userPage, setUserPage] = useState(1);
  const [userFilters, setUserFilters] = useState({ search: '', role: '', isActive: '', dateFrom: '', dateTo: '' });
  const [userLoading, setUserLoading] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [chatPagination, setChatPagination] = useState(emptyPagination);
  const [chatPage, setChatPage] = useState(1);
  const [chatSearch, setChatSearch] = useState('');
  const [chatUnreadOnly, setChatUnreadOnly] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [activeChatId, setActiveChatId] = useState('');
  const [replyText, setReplyText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const showError = (err) => setError(err?.message || 'Có lỗi xảy ra');
  const loadStats = async () => { try { const res = await api.get('/admin/stats'); setStats(res.data.stats); } catch (err) { showError(err); } };

  const fetchShops = async (page = shopPage, filters = shopFilters) => {
    setShopLoading(true);
    try { const res = await api.get('/admin/shops', { params: toParams(filters, page, 10) }); setShops(res.data.shops || []); setShopPagination(res.data.pagination || emptyPagination); } catch (err) { showError(err); } finally { setShopLoading(false); }
  };
  const fetchOrders = async (page = orderPage, filters = orderFilters) => {
    setOrderLoading(true);
    try { const res = await api.get('/admin/orders', { params: toParams(filters, page) }); setOrders(res.data.orders || []); setOrderPagination(res.data.pagination || emptyPagination); } catch (err) { showError(err); } finally { setOrderLoading(false); }
  };
  const fetchUsers = async (page = userPage, filters = userFilters) => {
    setUserLoading(true);
    try { const res = await api.get('/admin/users', { params: toParams(filters, page, 8) }); setUsers(res.data.users || []); setUserPagination(res.data.pagination || emptyPagination); } catch (err) { showError(err); } finally { setUserLoading(false); }
  };
  const fetchChats = async (page = chatPage) => {
    setChatLoading(true);
    try {
      const res = await api.get('/chat/admin', { params: { page, limit: 10, search: chatSearch || undefined, unread: chatUnreadOnly || undefined } });
      const list = res.data.conversations || [];
      setConversations(list); setChatPagination(res.data.pagination || emptyPagination); setChatUnread(Number(res.data.unreadTotal || 0));
      if (!list.some((item) => item._id === activeChatId)) setActiveChatId(list[0]?._id || '');
    } catch (err) { showError(err); } finally { setChatLoading(false); }
  };
  const refreshChatUnread = async () => { try { const res = await api.get('/chat/admin', { params: { page: 1, limit: 1 } }); setChatUnread(Number(res.data.unreadTotal || 0)); } catch { /* no-op */ } };

  useEffect(() => {
    if (!pushEnabled) return;
    subscribeWebPush().catch(() => setPushEnabled(false));
  }, []);

  useEffect(() => { loadStats(); fetchShops(1); fetchOrders(1); fetchUsers(1); fetchChats(1); }, []);
  useEffect(() => { const timer = setTimeout(() => fetchShops(shopPage, shopFilters), 280); return () => clearTimeout(timer); }, [shopPage, JSON.stringify(shopFilters)]);
  useEffect(() => { const timer = setTimeout(() => fetchOrders(orderPage, orderFilters), 280); return () => clearTimeout(timer); }, [orderPage, JSON.stringify(orderFilters)]);
  useEffect(() => { const timer = setTimeout(() => fetchUsers(userPage, userFilters), 280); return () => clearTimeout(timer); }, [userPage, JSON.stringify(userFilters)]);
  useEffect(() => { const timer = setTimeout(() => fetchChats(chatPage), 280); return () => clearTimeout(timer); }, [chatPage, chatSearch, chatUnreadOnly]);

  useEffect(() => {
    const socket = connectSocket();
    const onNewOrder = ({ order }) => {
      setOrders((current) => upsertFirst(current, order, 12));
      setToast(`Đơn mới #${order.orderCode} từ ${order.shopId?.name || 'cửa hàng'}`);
      if (soundEnabled) playOrderSound();
      showMessageNotification({ title: 'Đơn mới toàn hệ thống', body: `${order.shopId?.name || 'Cửa hàng'} · #${order.orderCode} · ${money(order.totalAmount)}`, tag: `admin-order-${order._id}`, url: `${window.location.origin}/admin` });
      loadStats();
    };
    const onUpdate = ({ order }) => setOrders((current) => mergeById(current, order));
    const onChat = ({ conversation, notification }) => {
      const opened = tab === 'messages' && activeChatId === conversation._id;
      const next = opened ? { ...conversation, unreadForAdmin: 0 } : conversation;
      setConversations((current) => upsertFirst(current, next, 10)); setChatPage(1);
      if (!activeChatId) setActiveChatId(conversation._id);
      if (opened) api.post(`/chat/admin/${conversation._id}/read`).catch(() => { });
      else {
        setToast(notification?.title || `${conversation.shopId?.name || 'Một shop'} vừa nhắn admin`);
        if (soundEnabled) playMessageSound();
        showMessageNotification({ title: notification?.title || 'Tin nhắn mới từ shop', body: notification?.body || conversation.lastMessage, tag: `admin-shop-${conversation._id}`, url: `${window.location.origin}/admin` });
      }
      refreshChatUnread();
    };
    const onPendingShop = ({ shop }) => { setToast(`${shop.name} vừa gửi yêu cầu duyệt`); if (soundEnabled) playMessageSound(); setShopPage(1); fetchShops(1, shopFilters); loadStats(); };
    socket.on('order:new', onNewOrder); socket.on('order:updated', onUpdate); socket.on('chat:admin', onChat); socket.on('shop:pending', onPendingShop);
    return () => { socket.off('order:new', onNewOrder); socket.off('order:updated', onUpdate); socket.off('chat:admin', onChat); socket.off('shop:pending', onPendingShop); };
  }, [soundEnabled, tab, activeChatId]);

  useEffect(() => { if (!toast) return undefined; const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); }, [toast]);

  const revenue = useMemo(() => orders.filter((item) => item.paymentStatus === 'paid').reduce((sum, item) => sum + Number(item.totalAmount || 0), 0), [orders]);
  const updateShopFilter = (field, value) => { setShopPage(1); setShopFilters((current) => ({ ...current, [field]: value })); };
  const updateOrderFilter = (field, value) => { setOrderPage(1); setOrderFilters((current) => ({ ...current, [field]: value })); };
  const updateUserFilter = (field, value) => { setUserPage(1); setUserFilters((current) => ({ ...current, [field]: value })); };

  const toggleShop = async (shop) => { try { const res = await api.patch(`/admin/shops/${shop._id}/status`, { isActive: !shop.isActive }); setShops((current) => mergeById(current, { ...shop, ...res.data.shop })); } catch (err) { showError(err); } };
  const approveShop = async (shop, status) => {
    let note = '';
    if (status === 'rejected') note = window.prompt('Nhập lý do chưa duyệt để chủ shop chỉnh sửa:', shop.approvalNote || '') || '';
    try { const res = await api.patch(`/admin/shops/${shop._id}/approval`, { approvalStatus: status, approvalNote: note }); setShops((current) => mergeById(current, { ...shop, ...res.data.shop })); setToast(status === 'approved' ? `Đã duyệt ${shop.name}` : `Đã gửi góp ý tới ${shop.name}`); loadStats(); } catch (err) { showError(err); }
  };
  const toggleUser = async (account) => { try { const res = await api.patch(`/admin/users/${account._id}/status`, { isActive: !account.isActive }); setUsers((current) => mergeById(current, { ...account, ...res.data.user })); } catch (err) { showError(err); } };
  const updateStatus = async (id, status) => { try { const res = await api.put(`/admin/orders/${id}/status`, { status }); setOrders((current) => mergeById(current, res.data.order)); } catch (err) { showError(err); } };
  const updatePayment = async (id, paymentStatus) => {
    try {
      let loyaltyPhone = '';
      let skipLoyalty = false;
      if (paymentStatus === 'paid') {
        const source = orders.find((item) => item._id === id);
        const entered = window.prompt(
          'Nhập số điện thoại để tích xu cho khách.\nĐể trống nếu khách không có nhu cầu tích điểm.',
          source?.loyaltyPhone || source?.phone || ''
        );
        if (entered === null) return;
        loyaltyPhone = String(entered || '').trim();
        skipLoyalty = !loyaltyPhone;
      }
      const res = await api.put(`/admin/orders/${id}/payment`, { paymentStatus, loyaltyPhone, skipLoyalty });
      const affected = res.data.orders?.length ? res.data.orders : [res.data.order];
      setOrders((current) => affected.reduce((list, item) => mergeById(list, item), current));
      if (paymentStatus === 'paid') {
        const reward = Number(res.data.loyaltyRewardCoins || 0);
        setToast(reward > 0
          ? `Đã thanh toán và cộng ${reward.toLocaleString('vi-VN')} xu`
          : res.data.loyaltyPhone
            ? `Đã ghi nhận thanh toán và lưu SĐT ${res.data.loyaltyPhone}; xu của phiên bàn sẽ cộng khi Seller đóng phiên`
            : 'Đã ghi nhận thanh toán, khách bỏ qua tích xu');
      }
    } catch (err) { showError(err); }
  };

  const markChatRead = async (thread) => {
    setActiveChatId(thread._id);
    if (!thread.unreadForAdmin) return;
    setConversations((current) => current.map((item) => item._id === thread._id ? { ...item, unreadForAdmin: 0 } : item));
    try { const res = await api.post(`/chat/admin/${thread._id}/read`); setConversations((current) => mergeById(current, res.data.conversation)); } catch { /* no-op */ }
    refreshChatUnread();
  };
  const replySeller = async (id) => {
    const text = replyText.trim(); if (!text) return;
    try { const res = await api.post(`/chat/admin/${id}/reply`, { text }); setConversations((current) => upsertFirst(current, { ...res.data.conversation, unreadForAdmin: 0 }, 10)); setReplyText(''); refreshChatUnread(); } catch (err) { showError(err); }
  };
  const enableSound = async () => { playOrderSound(); playMessageSound(); await requestNotificationPermission(); localStorage.setItem('admin_sound', 'on'); setSoundEnabled(true); setToast('Đã bật âm báo và thông báo'); };
  const enableBackgroundPush = async () => { try { await subscribeWebPush(); setPushEnabled(true); setToast('Đã bật thông báo nền cho Admin'); } catch (err) { showError(err); } };
  const sendPushTest = async () => { try { await subscribeWebPush(); const res = await testWebPush(); setToast(res.data.message || 'Đã gửi thông báo thử'); } catch (err) { showError(err); } };

  const navItems = [
    ['overview', 'overview', 'Tổng quan'],
    ['shops', 'shops', 'Cửa hàng'],
    ['orders', 'orders', 'Đơn hàng'],
    ['marketing', 'revenue', 'Marketing'],
    ['messages', 'messages', 'Chat Tổng'],
    ['users', 'users', 'Tài khoản']
  ];
  const title = navItems.find((item) => item[0] === tab)?.[2] || 'Admin';
  const changeTab = (value) => {
    setTab(value);
    setSidebarOpen(false);
  };

  return (
    <section className="ad-app">

      <style>{`
        :root {
          --ad-ink: #172033;
          --ad-muted: #68758a;
          --ad-line: #e6eaf0;
          --ad-bg: #f4f6fa;
          --ad-card: #ffffff;
          --ad-sidebar: #111827;
          --ad-sidebar-2: #172033;
          --ad-accent: #d99a32;
          --ad-accent-dark: #a96a13;
          --ad-accent-soft: #fff5df;
          --ad-green: #138a63;
          --ad-green-soft: #e9f8f2;
          --ad-red: #d44b4b;
          --ad-red-soft: #fff0f0;
          --ad-blue: #4169e1;
          --ad-blue-soft: #edf2ff;
          --ad-shadow: 0 18px 45px rgba(22, 32, 51, 0.08);
        }

        * { box-sizing: border-box; }

        .ad-app {
          width: 100%;
          height: 100dvh;
          min-height: 620px;
          display: flex;
          overflow: hidden;
          color: var(--ad-ink);
          background:
            radial-gradient(circle at 82% 0%, rgba(217,154,50,.10), transparent 30%),
            radial-gradient(circle at 25% 100%, rgba(65,105,225,.06), transparent 32%),
            var(--ad-bg);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .ad-sidebar {
          width: 272px;
          height: 100%;
          flex: 0 0 272px;
          display: flex;
          flex-direction: column;
          background:
            linear-gradient(180deg, rgba(255,255,255,.035), transparent 32%),
            linear-gradient(160deg, var(--ad-sidebar-2), var(--ad-sidebar));
          color: #dbe3f0;
          border-right: 1px solid rgba(255,255,255,.06);
          box-shadow: 18px 0 50px rgba(17,24,39,.10);
          position: relative;
          z-index: 60;
        }

        .ad-sidebar::before {
          content: "";
          position: absolute;
          width: 170px;
          height: 170px;
          top: -80px;
          right: -65px;
          border-radius: 999px;
          background: rgba(217,154,50,.13);
          filter: blur(2px);
          pointer-events: none;
        }

        .ad-brand {
          padding: 24px 20px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid rgba(255,255,255,.075);
          position: relative;
          z-index: 1;
        }

        .ad-brand-mark {
          width: 46px;
          height: 46px;
          flex: 0 0 46px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          color: #2d210f;
          background: linear-gradient(145deg, #ffe9b8, #d99a32);
          box-shadow: 0 10px 30px rgba(217,154,50,.23), inset 0 1px 0 rgba(255,255,255,.65);
          font-family: Georgia, serif;
          font-size: 19px;
          font-weight: 800;
        }

        .ad-brand-copy { min-width: 0; flex: 1; }
        .ad-brand-copy b { display: block; color: #fff; font-size: 15px; letter-spacing: .01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-brand-copy small { display: block; margin-top: 4px; color: #8f9bb0; font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
        .ad-sidebar-close { display: none; width: 36px; height: 36px; align-items: center; justify-content: center; border: 0; border-radius: 11px; color: #cbd5e1; background: rgba(255,255,255,.07); cursor: pointer; }

        .ad-nav {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 18px 14px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,.12) transparent;
        }

        .ad-nav-label {
          display: block;
          padding: 4px 12px 10px;
          color: #6f7d94;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .17em;
          text-transform: uppercase;
        }

        .ad-nav button {
          width: 100%;
          min-height: 48px;
          margin-bottom: 6px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 11px;
          border: 1px solid transparent;
          border-radius: 14px;
          color: #aeb9ca;
          background: transparent;
          cursor: pointer;
          text-align: left;
          transition: .18s ease;
        }

        .ad-nav button:hover {
          color: #fff;
          background: rgba(255,255,255,.055);
          transform: translateX(2px);
        }

        .ad-nav button.active {
          color: #fff;
          border-color: rgba(255,221,154,.13);
          background: linear-gradient(90deg, rgba(217,154,50,.24), rgba(217,154,50,.09));
          box-shadow: inset 3px 0 0 var(--ad-accent);
        }

        .ad-nav-icon {
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          color: #9dacbf;
          background: rgba(255,255,255,.055);
          transition: .18s ease;
        }

        .ad-nav button.active .ad-nav-icon {
          color: #2b210f;
          background: linear-gradient(145deg, #ffe8b1, #d99a32);
          box-shadow: 0 6px 18px rgba(217,154,50,.25);
        }

        .ad-nav button b { flex: 1; font-size: 13px; font-weight: 650; }
        .ad-nav-badge {
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          color: #fff;
          background: #e05252;
          font-size: 10px;
          font-weight: 800;
          font-style: normal;
          box-shadow: 0 4px 12px rgba(224,82,82,.25);
        }

        .ad-account {
          padding: 14px;
          margin: 0 14px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 16px;
          background: rgba(255,255,255,.045);
        }

        .ad-avatar {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          color: #1e293b;
          background: #f7dca0;
          font-weight: 800;
        }

        .ad-account-copy { flex: 1; min-width: 0; }
        .ad-account-copy b, .ad-account-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-account-copy b { color: #f8fafc; font-size: 12px; }
        .ad-account-copy small { margin-top: 3px; color: #77859b; font-size: 10px; }
        .ad-logout { width: 34px; height: 34px; flex: 0 0 34px; display: grid; place-items: center; border: 0; border-radius: 10px; color: #9aa8bc; background: transparent; cursor: pointer; }
        .ad-logout:hover { color: #fff; background: rgba(212,75,75,.18); }

        .ad-backdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          border: 0;
          background: rgba(8,15,27,.58);
          backdrop-filter: blur(5px);
          opacity: 0;
          visibility: hidden;
          transition: .22s ease;
        }

        .ad-main {
          flex: 1;
          min-width: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .ad-header {
          min-height: 92px;
          padding: 18px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid rgba(222,227,235,.8);
          background: rgba(255,255,255,.82);
          backdrop-filter: blur(18px);
          position: relative;
          z-index: 30;
        }

        .ad-title-wrap { min-width: 0; display: flex; align-items: center; gap: 14px; }
        .ad-menu-btn {
          width: 43px;
          height: 43px;
          flex: 0 0 43px;
          display: none;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--ad-line);
          border-radius: 13px;
          color: var(--ad-ink);
          background: #fff;
          box-shadow: 0 8px 24px rgba(22,32,51,.07);
          cursor: pointer;
        }

        .ad-eyebrow { display: block; color: var(--ad-accent-dark); font-size: 10px; font-weight: 850; letter-spacing: .18em; text-transform: uppercase; }
        .ad-title h1 { margin: 4px 0 2px; color: var(--ad-ink); font-size: clamp(24px, 2.3vw, 34px); font-family: Georgia, "Times New Roman", serif; line-height: 1.05; }
        .ad-title p { margin: 0; color: var(--ad-muted); font-size: 12px; }

        .ad-header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }

        .ad-action {
          min-height: 42px;
          padding: 8px 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid var(--ad-line);
          border-radius: 13px;
          color: #354056;
          background: rgba(255,255,255,.92);
          box-shadow: 0 6px 20px rgba(22,32,51,.045);
          font-size: 11px;
          font-weight: 750;
          text-decoration: none;
          white-space: nowrap;
          cursor: pointer;
          transition: .18s ease;
        }

        .ad-action:hover { border-color: #d8bc86; transform: translateY(-1px); box-shadow: 0 10px 26px rgba(22,32,51,.08); }
        .ad-action.active { color: #0e7755; border-color: #bce8d8; background: var(--ad-green-soft); }
        .ad-action.primary { color: #2e230f; border-color: #f0d391; background: linear-gradient(145deg, #fff7e4, #f6d999); }
        .ad-action-icon { position: relative; display: grid; place-items: center; }
        .ad-action-badge {
          position: absolute;
          top: -8px;
          right: -9px;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          display: grid;
          place-items: center;
          border: 2px solid #fff;
          border-radius: 999px;
          color: #fff;
          background: var(--ad-red);
          font-size: 8px;
          font-weight: 850;
        }

        .ad-content {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 26px 28px 40px;
        }

        .ad-content-inner {
          width: min(100%, 1480px);
          margin: 0 auto;
        }

        .ad-toast {
          position: fixed;
          top: 18px;
          left: 50%;
          z-index: 9999;
          max-width: min(90vw, 520px);
          padding: 12px 18px;
          display: flex;
          align-items: center;
          gap: 9px;
          border-radius: 999px;
          color: #fff;
          background: #172033;
          box-shadow: 0 16px 45px rgba(17,24,39,.25);
          transform: translateX(-50%);
          font-size: 12px;
          font-weight: 700;
          animation: adToast .25s ease both;
        }

        @keyframes adToast { from { opacity: 0; transform: translate(-50%,-10px); } to { opacity: 1; transform: translate(-50%,0); } }

        .ad-alert {
          margin-bottom: 18px;
          padding: 13px 15px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #ffd0d0;
          border-radius: 14px;
          color: #9e3232;
          background: var(--ad-red-soft);
          font-size: 12px;
          font-weight: 650;
        }

        .ad-alert button { margin-left: auto; width: 30px; height: 30px; border: 0; border-radius: 9px; color: inherit; background: rgba(212,75,75,.08); cursor: pointer; }

        .ad-metric-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .ad-metric {
          min-height: 154px;
          padding: 19px;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(224,229,236,.9);
          border-radius: 19px;
          background: rgba(255,255,255,.92);
          box-shadow: 0 10px 35px rgba(22,32,51,.055);
        }

        .ad-metric::after {
          content: "";
          position: absolute;
          width: 90px;
          height: 90px;
          right: -30px;
          bottom: -35px;
          border-radius: 999px;
          background: var(--metric-soft, var(--ad-accent-soft));
        }

        .ad-metric-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .ad-metric-label { color: var(--ad-muted); font-size: 11px; font-weight: 750; }
        .ad-metric-icon { width: 37px; height: 37px; display: grid; place-items: center; border-radius: 12px; color: var(--metric-color, var(--ad-accent-dark)); background: var(--metric-soft, var(--ad-accent-soft)); }
        .ad-metric strong { display: block; margin: 18px 0 7px; color: var(--ad-ink); font-size: clamp(24px, 2.1vw, 31px); line-height: 1; letter-spacing: -.03em; }
        .ad-metric small { color: #8994a5; font-size: 10px; font-weight: 600; }

        .ad-overview-grid {
          margin-top: 18px;
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(280px, .8fr);
          gap: 16px;
        }

        .ad-card {
          border: 1px solid rgba(224,229,236,.9);
          border-radius: 19px;
          background: rgba(255,255,255,.94);
          box-shadow: 0 10px 35px rgba(22,32,51,.05);
          overflow: hidden;
        }

        .ad-card-head {
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid var(--ad-line);
        }

        .ad-card-head h2, .ad-section-head h2 { margin: 3px 0 0; color: var(--ad-ink); font-size: 18px; }
        .ad-text-btn { border: 0; color: var(--ad-accent-dark); background: transparent; font-size: 11px; font-weight: 800; cursor: pointer; }

        .ad-order-preview { display: flex; flex-direction: column; }
        .ad-order-preview button {
          width: 100%;
          padding: 14px 20px;
          display: grid;
          grid-template-columns: 42px minmax(0,1fr) auto auto;
          align-items: center;
          gap: 12px;
          border: 0;
          border-bottom: 1px solid #edf0f4;
          color: inherit;
          background: transparent;
          text-align: left;
          cursor: pointer;
          transition: .16s ease;
        }

        .ad-order-preview button:last-child { border-bottom: 0; }
        .ad-order-preview button:hover { background: #fbfaf7; }
        .ad-order-dot {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          color: #7c5313;
          background: var(--ad-accent-soft);
          font-size: 10px;
          font-weight: 850;
        }

        .ad-order-copy { min-width: 0; }
        .ad-order-copy b, .ad-order-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-order-copy b { font-size: 12px; }
        .ad-order-copy small { margin-top: 4px; color: var(--ad-muted); font-size: 10px; }
        .ad-order-preview strong { font-size: 12px; white-space: nowrap; }
        .ad-status {
          padding: 6px 9px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          color: #8b5b15;
          background: #fff5df;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }
        .ad-status.paid, .ad-status.completed, .ad-status.approved, .ad-status.active { color: #0d7956; background: var(--ad-green-soft); }
        .ad-status.failed, .ad-status.cancelled, .ad-status.rejected, .ad-status.locked { color: #a53838; background: var(--ad-red-soft); }
        .ad-status small { display: block; margin-left: 3px; color: inherit; opacity: .75; }

        .ad-attention { padding: 12px; display: grid; gap: 8px; }
        .ad-attention button {
          width: 100%;
          padding: 13px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid transparent;
          border-radius: 14px;
          color: inherit;
          background: #f8f9fb;
          text-align: left;
          cursor: pointer;
          transition: .16s ease;
        }
        .ad-attention button:hover { border-color: #ead5a8; background: #fffaf0; }
        .ad-attention-count { width: 41px; height: 41px; flex: 0 0 41px; display: grid; place-items: center; border-radius: 13px; color: #7e5211; background: var(--ad-accent-soft); font-weight: 850; }
        .ad-attention-copy b, .ad-attention-copy small { display: block; }
        .ad-attention-copy b { font-size: 12px; }
        .ad-attention-copy small { margin-top: 3px; color: var(--ad-muted); font-size: 10px; }

        .ad-section-head {
          margin-bottom: 16px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
        }

        .ad-section-head p { margin: 5px 0 0; color: var(--ad-muted); font-size: 11px; }
        .ad-count {
          padding: 8px 12px;
          border: 1px solid #f0d59a;
          border-radius: 999px;
          color: #7c5313;
          background: #fff8e9;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .ad-filter {
          margin-bottom: 17px;
          padding: 13px;
          display: grid;
          grid-template-columns: minmax(240px, 1.6fr) repeat(4, minmax(130px, .7fr)) auto;
          gap: 9px;
          border: 1px solid rgba(224,229,236,.95);
          border-radius: 17px;
          background: rgba(255,255,255,.92);
          box-shadow: 0 8px 28px rgba(22,32,51,.035);
        }

        .ad-filter.orders { grid-template-columns: minmax(230px, 1.6fr) repeat(6, minmax(125px, .65fr)) auto; }
        .ad-filter.users { grid-template-columns: minmax(250px, 1.5fr) repeat(4, minmax(130px, .7fr)) auto; }

        .ad-search {
          min-width: 0;
          height: 44px;
          position: relative;
          display: flex;
          align-items: center;
        }

        .ad-search svg { position: absolute; left: 14px; color: #8b98aa; pointer-events: none; }
        .ad-search input { width: 100%; height: 100%; padding: 0 40px 0 42px; }
        .ad-search button { position: absolute; right: 7px; width: 29px; height: 29px; display: grid; place-items: center; border: 0; border-radius: 9px; color: #7d8796; background: #f2f4f7; cursor: pointer; }

        .ad-filter input, .ad-filter select {
          width: 100%;
          min-width: 0;
          height: 44px;
          padding: 0 12px;
          border: 1px solid var(--ad-line);
          border-radius: 12px;
          outline: none;
          color: #354056;
          background: #fff;
          font-family: inherit;
          font-size: 11px;
          transition: .16s ease;
        }

        .ad-filter input:focus, .ad-filter select:focus {
          border-color: #dcb66f;
          box-shadow: 0 0 0 3px rgba(217,154,50,.12);
        }

        .ad-clear {
          min-height: 44px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid var(--ad-line);
          border-radius: 12px;
          color: #6a7484;
          background: #fff;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .ad-shop-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .ad-shop-card {
          overflow: hidden;
          border: 1px solid rgba(224,229,236,.95);
          border-radius: 19px;
          background: #fff;
          box-shadow: 0 10px 32px rgba(22,32,51,.05);
          transition: .18s ease;
        }

        .ad-shop-card:hover { transform: translateY(-2px); box-shadow: var(--ad-shadow); }
        .ad-shop-cover { height: 140px; padding: 14px; display: flex; justify-content: flex-end; align-items: flex-start; background-position: center; background-size: cover; position: relative; }
        .ad-shop-cover::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(17,24,39,.04), rgba(17,24,39,.38)); pointer-events: none; }
        .ad-shop-cover .ad-status { position: relative; z-index: 1; }
        .ad-shop-body { padding: 18px; }
        
        /* Đổi align-items thành flex-start để cụm chữ không bị đẩy lên */
        .ad-shop-title { position: relative; z-index: 2; display: flex; align-items: flex-start; gap: 14px; }
        
        /* Chỉ đưa margin-top âm vào riêng thẻ img để logo đè lên banner */
        .ad-shop-title img { width: 72px; height: 72px; flex: 0 0 72px; margin-top: -42px; object-fit: cover; border: 4px solid #fff; border-radius: 19px; background: #fff; box-shadow: 0 8px 24px rgba(17,24,39,.12); }
        
        /* Căn chỉnh lại padding cho cụm text thẳng hàng với nửa dưới logo */
        .ad-shop-title-copy { min-width: 0; padding-top: 4px; }
        .ad-shop-title h3 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 17px; font-weight: 700; color: var(--ad-ink); }
        .ad-shop-title p { margin: 5px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ad-muted); font-size: 11px; }
        .ad-shop-data {
          margin: 17px 0 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          border: 1px solid #edf0f4;
          border-radius: 14px;
          overflow: hidden;
        }

        .ad-shop-data > div { min-width: 0; padding: 12px; border-right: 1px solid #edf0f4; border-bottom: 1px solid #edf0f4; }
        .ad-shop-data > div:nth-child(2n) { border-right: 0; }
        .ad-shop-data > div:nth-last-child(-n+2) { border-bottom: 0; }
        .ad-shop-data dt { margin-bottom: 5px; color: #929bad; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .ad-shop-data dd { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #354056; font-size: 11px; font-weight: 750; }
        .ad-shop-data small { display: block; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #8a95a6; font-size: 9px; font-weight: 500; }
        .ad-note { margin-top: 13px; padding: 11px 12px; border-left: 3px solid var(--ad-accent); border-radius: 10px; color: #77521a; background: #fff8e9; font-size: 10px; line-height: 1.5; }

        .ad-shop-actions { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
        .ad-btn {
          min-height: 38px;
          padding: 8px 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid var(--ad-line);
          border-radius: 11px;
          color: #465166;
          background: #fff;
          font-size: 10px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }

        .ad-btn:hover { border-color: #d8bc86; background: #fffaf0; }
        .ad-btn.approve { color: #0d7654; border-color: #bde8d8; background: var(--ad-green-soft); }
        .ad-btn.danger { color: #a53d3d; border-color: #f0c6c6; background: var(--ad-red-soft); }

        .ad-order-list { display: grid; gap: 11px; }
        .ad-order-card {
          padding: 16px;
          display: grid;
          grid-template-columns: minmax(250px,1.1fr) minmax(260px,1fr) minmax(330px,1.15fr);
          align-items: center;
          gap: 16px;
          border: 1px solid rgba(224,229,236,.95);
          border-radius: 17px;
          background: #fff;
          box-shadow: 0 7px 25px rgba(22,32,51,.04);
        }

        .ad-order-main { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .ad-order-symbol { width: 48px; height: 48px; flex: 0 0 48px; display: grid; place-items: center; border-radius: 14px; color: #7e5212; background: var(--ad-accent-soft); font-size: 11px; font-weight: 850; }
        .ad-order-main-copy, .ad-order-summary { min-width: 0; }
        .ad-order-code { color: var(--ad-accent-dark); font-size: 9px; font-weight: 850; letter-spacing: .08em; }
        .ad-order-main h3 { margin: 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
        .ad-order-main p, .ad-order-summary p { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ad-muted); font-size: 10px; }
        .ad-order-summary b { display: block; margin-bottom: 5px; font-size: 16px; }
        .ad-received { display: block; margin-bottom: 5px; color: #0d7956; font-size: 9px; font-weight: 750; }

        .ad-order-controls {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          align-items: end;
          gap: 9px;
        }

        .ad-control label { display: block; margin-bottom: 5px; color: #8b95a5; font-size: 8px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
        .ad-control select { width: 100%; height: 39px; padding: 0 10px; border: 1px solid var(--ad-line); border-radius: 10px; outline: none; color: #40506a; background: #fff; font-size: 10px; }
        .ad-paid-time { min-height: 39px; padding: 6px 9px; display: flex; align-items: center; gap: 7px; border-radius: 10px; color: #0d7956; background: var(--ad-green-soft); }
        .ad-paid-time b, .ad-paid-time small { display: block; white-space: nowrap; }
        .ad-paid-time b { font-size: 9px; }
        .ad-paid-time small { margin-top: 2px; font-size: 8px; }

        .ad-chat-page { height: calc(100dvh - 165px); min-height: 500px; display: flex; flex-direction: column; }
        .ad-chat-page .ad-section-head { flex: 0 0 auto; }
        .ad-chat-shell {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          border: 1px solid rgba(224,229,236,.95);
          border-radius: 19px;
          background: #fff;
          box-shadow: var(--ad-shadow);
        }
        .ad-chat-shell > * { width: 100% !important; height: 100% !important; min-height: 0 !important; max-height: 100% !important; }

        .ad-user-wrap {
          overflow: hidden;
          border: 1px solid rgba(224,229,236,.95);
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 10px 32px rgba(22,32,51,.045);
        }

        .ad-user-head, .ad-user-row {
          display: grid;
          grid-template-columns: minmax(180px,1.1fr) minmax(190px,1.1fr) minmax(160px,1fr) 100px 105px 110px 120px;
          align-items: center;
          gap: 14px;
        }

        .ad-user-head {
          padding: 12px 16px;
          color: #8b95a5;
          background: #f7f8fa;
          border-bottom: 1px solid var(--ad-line);
          font-size: 8px;
          font-weight: 850;
          letter-spacing: .09em;
          text-transform: uppercase;
        }

        .ad-user-row {
          padding: 14px 16px;
          border-bottom: 1px solid #edf0f4;
          font-size: 10px;
        }

        .ad-user-row:last-child { border-bottom: 0; }
        .ad-user-row:hover { background: #fcfbf8; }
        .ad-user-identity { min-width: 0; display: flex; align-items: center; gap: 10px; }
        .ad-user-avatar { width: 38px; height: 38px; flex: 0 0 38px; display: grid; place-items: center; border-radius: 12px; color: #674311; background: var(--ad-accent-soft); font-weight: 850; }
        .ad-user-identity b, .ad-user-identity small, .ad-user-contact b, .ad-user-contact small, .ad-user-shop b, .ad-user-shop small, .ad-user-date b, .ad-user-date small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-user-identity b, .ad-user-contact b, .ad-user-shop b, .ad-user-date b { color: #354056; font-size: 10px; }
        .ad-user-identity small, .ad-user-contact small, .ad-user-shop small, .ad-user-date small { margin-top: 3px; color: #8a95a6; font-size: 8px; }
        .ad-role, .ad-user-state { width: fit-content; padding: 6px 9px; border-radius: 999px; font-size: 8px; font-weight: 850; white-space: nowrap; }
        .ad-role.admin { color: #5b42a3; background: #f1edff; }
        .ad-role.seller { color: #7b5314; background: var(--ad-accent-soft); }
        .ad-user-state.active { color: #0d7956; background: var(--ad-green-soft); }
        .ad-user-state.locked { color: #a43838; background: var(--ad-red-soft); }
        .ad-user-action { min-height: 35px; padding: 7px 10px; border: 1px solid; border-radius: 10px; font-size: 9px; font-weight: 800; cursor: pointer; }
        .ad-user-action.danger { color: #a43838; border-color: #f0c7c7; background: var(--ad-red-soft); }
        .ad-user-action.success { color: #0d7956; border-color: #bce8d7; background: var(--ad-green-soft); }
        .ad-user-action:disabled { opacity: .45; cursor: not-allowed; }

        .ad-loading, .ad-empty {
          grid-column: 1 / -1;
          min-height: 190px;
          padding: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          border: 1px dashed #d7dde6;
          border-radius: 17px;
          color: var(--ad-muted);
          background: rgba(255,255,255,.75);
        }

        .ad-loading { min-height: 110px; font-size: 11px; font-weight: 700; }
        .ad-empty-icon { width: 50px; height: 50px; margin-bottom: 12px; display: grid; place-items: center; border-radius: 15px; color: #8793a5; background: #eef1f5; }
        .ad-empty h3 { margin: 0 0 6px; color: var(--ad-ink); font-size: 15px; }
        .ad-empty p { margin: 0; font-size: 10px; }

        @media (max-width: 1320px) {
          .ad-filter, .ad-filter.orders, .ad-filter.users { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .ad-search { grid-column: span 2; }
          .ad-order-card { grid-template-columns: minmax(230px,1fr) minmax(220px,.9fr); }
          .ad-order-controls { grid-column: 1 / -1; }
          .ad-user-wrap { overflow-x: auto; }
          .ad-user-head, .ad-user-row { min-width: 1050px; }
        }

        @media (max-width: 1100px) {
          .ad-sidebar {
            position: fixed;
            inset: 0 auto 0 0;
            transform: translateX(-105%);
            transition: transform .24s ease;
          }
          .ad-sidebar.open { transform: translateX(0); }
          .ad-sidebar-close { display: flex; }
          .ad-backdrop.open { opacity: 1; visibility: visible; }
          .ad-menu-btn { display: inline-flex; }
          .ad-header { padding-inline: 20px; }
          .ad-content { padding-inline: 20px; }
        }

        @media (max-width: 880px) {
          .ad-header { align-items: flex-start; flex-direction: column; gap: 13px; }
          .ad-header-actions { width: 100%; justify-content: flex-start; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
          .ad-header-actions::-webkit-scrollbar { display: none; }
          .ad-metric-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .ad-overview-grid { grid-template-columns: 1fr; }
          .ad-shop-grid { grid-template-columns: 1fr; }
          .ad-filter, .ad-filter.orders, .ad-filter.users { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .ad-search { grid-column: 1 / -1; }
          .ad-clear { width: 100%; }
          .ad-order-card { grid-template-columns: 1fr; }
          .ad-order-controls { grid-column: auto; }
          .ad-chat-page { height: calc(100dvh - 215px); min-height: 430px; }
        }

        @media (max-width: 620px) {
          .ad-app { min-height: 100dvh; }
          .ad-sidebar { width: min(88vw, 310px); flex-basis: auto; }
          .ad-header { min-height: auto; padding: 12px; gap: 11px; }
          .ad-title-wrap { width: 100%; align-items: flex-start; }
          .ad-menu-btn { width: 41px; height: 41px; flex-basis: 41px; }
          .ad-title h1 { font-size: 24px; }
          .ad-title p { display: none; }
          .ad-header-actions { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 6px; overflow: visible; }
          .ad-action { min-width: 0; min-height: 48px; padding: 6px 4px; flex-direction: column; gap: 3px; border-radius: 12px; font-size: 8px; }
          .ad-action svg { width: 17px; height: 17px; }
          .ad-action-badge { top: -7px; right: -9px; }
          .ad-content { padding: 14px 12px 28px; }
          .ad-metric-grid { gap: 10px; }
          .ad-metric { min-height: 132px; padding: 14px; border-radius: 16px; }
          .ad-metric strong { margin-top: 14px; font-size: 22px; }
          .ad-overview-grid { gap: 10px; margin-top: 10px; }
          .ad-card { border-radius: 16px; }
          .ad-order-preview button { grid-template-columns: 37px minmax(0,1fr) auto; padding: 12px; gap: 9px; }
          .ad-order-preview .ad-status { grid-column: 2 / -1; width: fit-content; }
          .ad-section-head { align-items: flex-start; }
          .ad-section-head h2 { font-size: 17px; }
          .ad-count { padding: 7px 9px; font-size: 8px; }
          .ad-filter, .ad-filter.orders, .ad-filter.users { padding: 10px; grid-template-columns: 1fr; gap: 8px; border-radius: 15px; }
          .ad-search { grid-column: auto; height: 47px; }
          .ad-filter input, .ad-filter select { height: 47px; font-size: 16px; }
          .ad-clear { min-height: 45px; }
          .ad-shop-cover { height: 115px; } /* Thu gọn ảnh bìa một chút */
          .ad-shop-body { padding: 16px; }
          
          /* Responsive lại khoảng cách và kích thước logo */
          .ad-shop-title { gap: 12px; }
          .ad-shop-title img { width: 62px; height: 62px; flex: 0 0 62px; margin-top: -36px; border-width: 3px; border-radius: 16px; }
          .ad-shop-title-copy { padding-top: 2px; }
          .ad-shop-title h3 { font-size: 16px; }
          
          .ad-shop-data { grid-template-columns: 1fr; margin-top: 16px; }
          .ad-shop-data > div { border-right: 0; border-bottom: 1px solid #edf0f4 !important; padding: 10px 12px; }
          .ad-shop-data > div:last-child { border-bottom: 0 !important; }
          .ad-shop-actions .ad-btn { flex: 1 1 calc(50% - 4px); }
          .ad-order-card { padding: 13px; gap: 13px; }
          .ad-order-controls { grid-template-columns: 1fr 1fr; }
          .ad-paid-time { grid-column: 1 / -1; }
          .ad-chat-page { height: calc(100dvh - 205px); min-height: 390px; }
          .ad-user-wrap { overflow: visible; border: 0; background: transparent; box-shadow: none; }
          .ad-user-head { display: none; }
          .ad-user-list { display: grid; gap: 10px; }
          .ad-user-row {
            min-width: 0;
            padding: 14px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            border: 1px solid var(--ad-line);
            border-radius: 15px;
            background: #fff;
            box-shadow: 0 7px 22px rgba(22,32,51,.04);
          }
          .ad-user-identity, .ad-user-contact, .ad-user-shop { grid-column: 1 / -1; }
          .ad-user-action { width: 100%; }
        }

        @media (max-width: 390px) {
          .ad-header-actions { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .ad-metric-grid { grid-template-columns: 1fr; }
          .ad-order-controls { grid-template-columns: 1fr; }
          .ad-paid-time { grid-column: auto; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ad-app *, .ad-app *::before, .ad-app *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }
      `}</style>

      {toast && <div className="ad-toast"><AdminIcon name="check" size={17} />{toast}</div>}

      <button
        type="button"
        className={`ad-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Đóng menu"
      />

      <aside className={`ad-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="ad-brand">
          <div className="ad-brand-copy">
            <b>Admin Atelier</b>
            <small>System Control</small>
          </div>
          <button type="button" className="ad-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Đóng menu">
            <AdminIcon name="close" size={19} />
          </button>
        </div>

        <nav className="ad-nav">
          <span className="ad-nav-label">Trung tâm quản trị</span>
          {navItems.map(([value, icon, label]) => {
            const badge = value === 'messages'
              ? chatUnread
              : value === 'shops'
                ? Number(stats?.pendingShops || 0)
                : 0;

            return (
              <button
                type="button"
                key={value}
                className={tab === value ? 'active' : ''}
                onClick={() => changeTab(value)}
              >
                <span className="ad-nav-icon"><AdminIcon name={icon} size={17} /></span>
                <b>{label}</b>
                {badge > 0 && <i className="ad-nav-badge">{badge > 99 ? '99+' : badge}</i>}
              </button>
            );
          })}
        </nav>

        <div className="ad-account">
          <span className="ad-avatar">{(user?.name || 'A')[0]?.toUpperCase()}</span>
          <div className="ad-account-copy">
            <b>{user?.name || 'Quản trị viên'}</b>
            <small>{user?.email}</small>
          </div>
          <button
            type="button"
            className="ad-logout"
            onClick={() => { logout(); navigate('/'); }}
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <AdminIcon name="logout" size={17} />
          </button>
        </div>
      </aside>

      <main className="ad-main">
        <header className="ad-header">
          <div className="ad-title-wrap">
            <button type="button" className="ad-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Mở menu">
              <AdminIcon name="menu" size={21} />
            </button>
            <div className="ad-title">
              <span className="ad-eyebrow">Global administration</span>
              <h1>{title}</h1>
              <p>Kiểm soát dữ liệu và vận hành toàn nền tảng.</p>
            </div>
          </div>

          <div className="ad-header-actions">
            <button type="button" className="ad-action" onClick={() => changeTab('messages')}>
              <span className="ad-action-icon">
                <AdminIcon name="messages" size={18} />
                {chatUnread > 0 && <i className="ad-action-badge">{chatUnread > 99 ? '99+' : chatUnread}</i>}
              </span>
              <span>CHAT</span>
            </button>

            {!soundEnabled ? (
              <button type="button" className="ad-action" onClick={enableSound}>
                <AdminIcon name="sound" size={18} />
                <span>Bật âm báo</span>
              </button>
            ) : (
              <span className="ad-action active">
                <AdminIcon name="sound" size={18} />
                <span>Âm báo bật</span>
              </span>
            )}

            {!pushEnabled ? (
              <button type="button" className="ad-action" onClick={enableBackgroundPush}>
                <AdminIcon name="bell" size={18} />
                <span>Bật thông báo</span>
              </button>
            ) : (
              <button type="button" className="ad-action active" onClick={sendPushTest}>
                <AdminIcon name="bell" size={18} />
                <span>Thử Push</span>
              </button>
            )}

            <a className="ad-action primary" href="/" target="_blank" rel="noreferrer">
              <AdminIcon name="external" size={17} />
              <span>Trang tổng</span>
            </a>
          </div>
        </header>

        <div className="ad-content">
          <div className="ad-content-inner">
            {error && (
              <div className="ad-alert">
                <AdminIcon name="pending" size={18} />
                <span>{error}</span>
                <button type="button" onClick={() => setError('')} aria-label="Đóng thông báo">
                  <AdminIcon name="close" size={16} />
                </button>
              </div>
            )}

            {tab === 'overview' && (
              <>
                <div className="ad-metric-grid">
                  <article className="ad-metric" style={{ '--metric-color': '#9a6516', '--metric-soft': '#fff3d8' }}>
                    <div className="ad-metric-top">
                      <span className="ad-metric-label">Doanh thu trang hiện tại</span>
                      <span className="ad-metric-icon"><AdminIcon name="revenue" size={18} /></span>
                    </div>
                    <strong>{money(revenue)}</strong>
                    <small>Tổng từ các đơn đã thanh toán</small>
                  </article>

                  <article className="ad-metric" style={{ '--metric-color': '#4169e1', '--metric-soft': '#edf2ff' }}>
                    <div className="ad-metric-top">
                      <span className="ad-metric-label">Cửa hàng</span>
                      <span className="ad-metric-icon"><AdminIcon name="shops" size={18} /></span>
                    </div>
                    <strong>{stats?.shops || 0}</strong>
                    <small>{stats?.pendingShops || 0} hồ sơ đang chờ duyệt</small>
                  </article>

                  <article className="ad-metric" style={{ '--metric-color': '#138a63', '--metric-soft': '#e9f8f2' }}>
                    <div className="ad-metric-top">
                      <span className="ad-metric-label">Đơn hàng toàn hệ thống</span>
                      <span className="ad-metric-icon"><AdminIcon name="orders" size={18} /></span>
                    </div>
                    <strong>{stats?.orders || 0}</strong>
                    <small>{orders.filter((item) => item.status === 'pending').length} đơn mới trên trang</small>
                  </article>

                  <article className="ad-metric" style={{ '--metric-color': '#b04b7a', '--metric-soft': '#fff0f7' }}>
                    <div className="ad-metric-top">
                      <span className="ad-metric-label">Tin nhắn chưa đọc</span>
                      <span className="ad-metric-icon"><AdminIcon name="messages" size={18} /></span>
                    </div>
                    <strong>{chatUnread}</strong>
                    <small>{stats?.openConversations || 0} hội thoại đang mở</small>
                  </article>
                </div>

                <div className="ad-overview-grid">
                  <section className="ad-card">
                    <div className="ad-card-head">
                      <div>
                        <span className="ad-eyebrow">Platform activity</span>
                        <h2>Đơn hàng gần đây</h2>
                      </div>
                      <button type="button" className="ad-text-btn" onClick={() => changeTab('orders')}>Xem tất cả →</button>
                    </div>

                    <div className="ad-order-preview">
                      {orders.slice(0, 7).map((order) => (
                        <button type="button" key={order._id} onClick={() => changeTab('orders')}>
                          <span className="ad-order-dot">{order.tableNumber ? `B${order.tableNumber}` : 'Đơn'}</span>
                          <span className="ad-order-copy">
                            <b>#{order.orderCode}</b>
                            <small>{order.shopId?.name || 'Cửa hàng'} · {order.customerName || 'Khách hàng'}</small>
                          </span>
                          <strong>{money(order.totalAmount)}</strong>
                          <em className={`ad-status ${order.paymentStatus}`}>
                            {paymentLabels[order.paymentStatus]}
                            {order.paymentStatus === 'paid' && order.paidAt && <small>{formatDateTime(order.paidAt)}</small>}
                          </em>
                        </button>
                      ))}
                      {!orders.length && (
                        <div className="ad-empty">
                          <span className="ad-empty-icon"><AdminIcon name="orders" /></span>
                          <h3>Chưa có đơn hàng</h3>
                          <p>Đơn mới của hệ thống sẽ xuất hiện tại đây.</p>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="ad-card">
                    <div className="ad-card-head">
                      <div>
                        <span className="ad-eyebrow">Needs attention</span>
                        <h2>Việc cần xử lý</h2>
                      </div>
                    </div>

                    <div className="ad-attention">
                      <button type="button" onClick={() => {
                        setShopFilters((current) => ({ ...current, approvalStatus: 'pending' }));
                        setShopPage(1);
                        changeTab('shops');
                      }}>
                        <span className="ad-attention-count">{stats?.pendingShops || 0}</span>
                        <span className="ad-attention-copy"><b>Shop đang chờ duyệt</b><small>Kiểm tra hồ sơ đăng ký</small></span>
                        <AdminIcon name="chevron" size={16} />
                      </button>

                      <button type="button" onClick={() => changeTab('messages')}>
                        <span className="ad-attention-count">{chatUnread}</span>
                        <span className="ad-attention-copy"><b>Tin nhắn chưa đọc</b><small>Phản hồi chủ cửa hàng</small></span>
                        <AdminIcon name="chevron" size={16} />
                      </button>

                      <button type="button" onClick={() => {
                        setOrderFilters((current) => ({ ...current, status: 'pending' }));
                        changeTab('orders');
                      }}>
                        <span className="ad-attention-count">{orders.filter((item) => item.status === 'pending').length}</span>
                        <span className="ad-attention-copy"><b>Đơn hàng mới</b><small>Theo dõi toàn hệ thống</small></span>
                        <AdminIcon name="chevron" size={16} />
                      </button>
                    </div>
                  </section>
                </div>
              </>
            )}

            {tab === 'shops' && (
              <section>
                <div className="ad-section-head">
                  <div>
                    <span className="ad-eyebrow">Merchant approval</span>
                    <h2>Quản trị cửa hàng</h2>
                    <p>{shopPagination.total} cửa hàng phù hợp bộ lọc.</p>
                  </div>
                  <span className="ad-count">{stats?.pendingShops || 0} chờ duyệt</span>
                </div>

                <div className="ad-filter">
                  <div className="ad-search">
                    <AdminIcon name="search" size={17} />
                    <input
                      value={shopFilters.search}
                      onChange={(event) => updateShopFilter('search', event.target.value)}
                      placeholder="Tên shop, chủ shop hoặc domain..."
                    />
                    {shopFilters.search && (
                      <button type="button" onClick={() => updateShopFilter('search', '')} aria-label="Xóa tìm kiếm">
                        <AdminIcon name="close" size={14} />
                      </button>
                    )}
                  </div>

                  <select value={shopFilters.businessType} onChange={(event) => updateShopFilter('businessType', event.target.value)}>
                    <option value="">Mọi mô hình</option>
                    <option value="restaurant">Nhà hàng</option>
                    <option value="retail">Thương mại</option>
                  </select>

                  <select value={shopFilters.approvalStatus} onChange={(event) => updateShopFilter('approvalStatus', event.target.value)}>
                    <option value="">Mọi trạng thái duyệt</option>
                    <option value="pending">Chờ duyệt</option>
                    <option value="approved">Đã duyệt</option>
                    <option value="rejected">Chưa duyệt</option>
                  </select>

                  <select value={shopFilters.isActive} onChange={(event) => updateShopFilter('isActive', event.target.value)}>
                    <option value="">Mọi hoạt động</option>
                    <option value="true">Đang mở</option>
                    <option value="false">Đang khóa</option>
                  </select>

                  <input type="date" value={shopFilters.dateFrom} onChange={(event) => updateShopFilter('dateFrom', event.target.value)} />
                  <input type="date" value={shopFilters.dateTo} onChange={(event) => updateShopFilter('dateTo', event.target.value)} />

                  <button type="button" className="ad-clear" onClick={() => {
                    setShopFilters({ search: '', businessType: '', approvalStatus: '', isActive: '', dateFrom: '', dateTo: '' });
                    setShopPage(1);
                  }}>
                    <AdminIcon name="trash" size={15} /> Xóa lọc
                  </button>
                </div>

                <div className="ad-shop-grid">
                  {shopLoading && <div className="ad-loading">Đang tải dữ liệu cửa hàng...</div>}

                  {!shopLoading && shops.map((shop) => {
                    const approval = shop.approvalStatus || 'approved';
                    return (
                      <article className="ad-shop-card" key={shop._id}>
                        <div
                          className="ad-shop-cover"
                          style={{ backgroundImage: `url(${shop.bannerUrl || 'https://placehold.co/800x320/1b1712/dabf8a?text=FoodHub'})` }}
                        >
                          <span className={`ad-status ${approval}`}>
                            {approval === 'approved' ? 'Đã duyệt' : approval === 'pending' ? 'Chờ duyệt' : 'Chưa duyệt'}
                          </span>
                        </div>

                        <div className="ad-shop-body">
                          <div className="ad-shop-title">
                            <img src={shop.logoUrl || 'https://placehold.co/100/17130f/efd7a6?text=FH'} alt="" />
                            <div className="ad-shop-title-copy">
                              <h3>{shop.name}</h3>
                              <p>{shop.businessType === 'restaurant' ? 'Nhà hàng / quán ăn' : 'Cửa hàng thương mại'} · /shop/{shop.slug}</p>
                            </div>
                          </div>

                          <dl className="ad-shop-data">
                            <div><dt>Chủ shop</dt><dd>{shop.ownerId?.name || 'Chưa cập nhật'}<small>{shop.ownerId?.email || '—'}</small></dd></div>
                            <div><dt>Nhận tiền</dt><dd>{shop.bankName || 'Chưa cập nhật'}<small>{shop.bankAccountNumber || '—'}</small></dd></div>
                            <div><dt>Domain riêng</dt><dd>{shop.customDomain || 'Chưa gắn'}<small>{shop.customDomain ? 'Cần DNS + HTTPS' : 'Dùng domain hệ thống'}</small></dd></div>
                            <div><dt>Bàn</dt><dd>{shop.numberOfTables || 0}<small>{shop.serviceModes?.map((item) => typeLabels[item]).join(' · ') || 'Không dùng tại bàn'}</small></dd></div>
                          </dl>

                          {shop.approvalNote && <div className="ad-note"><b>Ghi chú:</b> {shop.approvalNote}</div>}

                          <div className="ad-shop-actions">
                            {approval !== 'approved' && (
                              <button type="button" className="ad-btn approve" onClick={() => approveShop(shop, 'approved')}>
                                <AdminIcon name="check" size={15} /> Duyệt & mở shop
                              </button>
                            )}
                            {approval !== 'rejected' && (
                              <button type="button" className="ad-btn danger" onClick={() => approveShop(shop, 'rejected')}>
                                Yêu cầu chỉnh sửa
                              </button>
                            )}
                            {approval === 'approved' && (
                              <button type="button" className="ad-btn" onClick={() => toggleShop(shop)}>
                                {shop.isActive ? 'Khóa hoạt động' : 'Mở hoạt động'}
                              </button>
                            )}
                            <a className="ad-btn" href={shop.customDomain ? `https://${shop.customDomain}` : `/shop/${shop.slug}`} target="_blank" rel="noreferrer">
                              Xem shop <AdminIcon name="external" size={14} />
                            </a>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {!shopLoading && !shops.length && (
                    <div className="ad-empty">
                      <span className="ad-empty-icon"><AdminIcon name="shops" /></span>
                      <h3>Không tìm thấy cửa hàng</h3>
                      <p>Thử thay đổi bộ lọc tìm kiếm.</p>
                    </div>
                  )}
                </div>

                <Pagination pagination={shopPagination} onPageChange={setShopPage} />
              </section>
            )}

            {tab === 'orders' && (
              <section>
                <div className="ad-section-head">
                  <div>
                    <span className="ad-eyebrow">Global orders</span>
                    <h2>Toàn bộ đơn hàng</h2>
                    <p>{orderPagination.total} đơn hàng phù hợp bộ lọc.</p>
                  </div>
                </div>

                <div className="ad-filter orders">
                  <div className="ad-search">
                    <AdminIcon name="search" size={17} />
                    <input
                      value={orderFilters.search}
                      onChange={(event) => updateOrderFilter('search', event.target.value)}
                      placeholder="Mã đơn, khách hàng hoặc SĐT..."
                    />
                    {orderFilters.search && (
                      <button type="button" onClick={() => updateOrderFilter('search', '')} aria-label="Xóa tìm kiếm">
                        <AdminIcon name="close" size={14} />
                      </button>
                    )}
                  </div>

                  <select value={orderFilters.shopId} onChange={(event) => updateOrderFilter('shopId', event.target.value)}>
                    <option value="">Mọi cửa hàng</option>
                    {shops.map((shop) => <option key={shop._id} value={shop._id}>{shop.name}</option>)}
                  </select>

                  <select value={orderFilters.status} onChange={(event) => updateOrderFilter('status', event.target.value)}>
                    <option value="">Mọi trạng thái</option>
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>

                  <select value={orderFilters.paymentStatus} onChange={(event) => updateOrderFilter('paymentStatus', event.target.value)}>
                    <option value="">Mọi thanh toán</option>
                    {Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>

                  <select value={orderFilters.orderType} onChange={(event) => updateOrderFilter('orderType', event.target.value)}>
                    <option value="">Mọi loại đơn</option>
                    {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>

                  <select value={orderFilters.paymentMethod} onChange={(event) => updateOrderFilter('paymentMethod', event.target.value)}>
                    <option value="">Mọi phương thức</option>
                    {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>

                  <input type="date" value={orderFilters.dateFrom} onChange={(event) => updateOrderFilter('dateFrom', event.target.value)} />
                  <input type="date" value={orderFilters.dateTo} onChange={(event) => updateOrderFilter('dateTo', event.target.value)} />

                  <button type="button" className="ad-clear" onClick={() => {
                    setOrderFilters({ search: '', shopId: '', status: '', paymentStatus: '', orderType: '', paymentMethod: '', dateFrom: '', dateTo: '' });
                    setOrderPage(1);
                  }}>
                    <AdminIcon name="trash" size={15} /> Xóa lọc
                  </button>
                </div>

                <div className="ad-order-list">
                  {orderLoading && <div className="ad-loading">Đang tải danh sách đơn hàng...</div>}

                  {!orderLoading && orders.map((order) => (
                    <article className="ad-order-card" key={order._id}>
                      <div className="ad-order-main">
                        <span className="ad-order-symbol">{order.tableNumber ? `B${order.tableNumber}` : 'Đơn'}</span>
                        <div className="ad-order-main-copy">
                          <span className="ad-order-code">#{order.orderCode}</span>
                          <h3>{order.shopId?.name || 'Cửa hàng'}</h3>
                          <p>{order.tableNumber ? `Bàn ${order.tableNumber}` : order.customerName} · {typeLabels[order.orderType]} · {new Date(order.createdAt).toLocaleString('vi-VN')}</p>
                        </div>
                      </div>

                      <div className="ad-order-summary">
                        <b>{money(order.totalAmount)}</b>
                        {order.paymentMethod === 'bank_transfer' && Number(order.bankReceivedAmount || 0) > 0 && (
                          <small className="ad-received">
                            Đã nhận {money(order.bankReceivedAmount)}
                            {order.paymentStatus !== 'paid' ? ` · Còn ${money(Math.max(0, order.totalAmount - order.bankReceivedAmount))}` : ''}
                          </small>
                        )}
                        <p>{order.products?.map((item) => `${item.name} ×${item.quantity}`).join(', ')}</p>
                      </div>

                      <div className="ad-order-controls">
                        <div className="ad-control">
                          <label>Trạng thái</label>
                          <select value={order.status} onChange={(event) => updateStatus(order._id, event.target.value)}>
                            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </div>

                        <div className="ad-control">
                          <label>Thanh toán</label>
                          <select value={order.paymentStatus} onChange={(event) => updatePayment(order._id, event.target.value)}>
                            {Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </div>

                        {order.paymentStatus === 'paid' && order.paidAt && (
                          <div className="ad-paid-time">
                            <AdminIcon name="check" size={14} />
                            <div><b>Đã thanh toán</b><small>{formatDateTime(order.paidAt)}</small></div>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}

                  {!orderLoading && !orders.length && (
                    <div className="ad-empty">
                      <span className="ad-empty-icon"><AdminIcon name="orders" /></span>
                      <h3>Không tìm thấy đơn hàng</h3>
                      <p>Thử thay đổi bộ lọc tìm kiếm.</p>
                    </div>
                  )}
                </div>

                <Pagination pagination={orderPagination} onPageChange={setOrderPage} />
              </section>
            )}

            {tab === 'messages' && (
              <section className="ad-chat-page">
                <div className="ad-section-head">
                  <div>
                    <span className="ad-eyebrow">Merchant support</span>
                    <h2>Tin nhắn từ cửa hàng</h2>
                    <p>Hội thoại mới nhất tự động được đưa lên đầu.</p>
                  </div>
                  <span className="ad-count">{chatUnread} chưa đọc</span>
                </div>

                <div className="ad-chat-shell">
                  <ConversationWorkspace
                    conversations={conversations}
                    viewerRole="admin"
                    activeId={activeChatId}
                    onSelect={markChatRead}
                    onReply={replySeller}
                    replyValue={replyText}
                    onReplyChange={setReplyText}
                    search={chatSearch}
                    onSearchChange={(value) => { setChatSearch(value); setChatPage(1); }}
                    unreadOnly={chatUnreadOnly}
                    onUnreadOnlyChange={(value) => { setChatUnreadOnly(value); setChatPage(1); }}
                    pagination={chatPagination}
                    onPageChange={setChatPage}
                    titleFor={(thread) => thread.shopId?.name || 'Cửa hàng'}
                    subtitleFor={(thread) => thread.subject || 'Hỗ trợ cửa hàng'}
                    unreadField="unreadForAdmin"
                    loading={chatLoading}
                  />
                </div>
              </section>
            )}

            {tab === 'marketing' && (
              <PlatformMarketingPanel onToast={setToast} onError={showError} />
            )}

            {tab === 'users' && (
              <section>
                <div className="ad-section-head">
                  <div>
                    <span className="ad-eyebrow">Accounts</span>
                    <h2>Tài khoản người dùng</h2>
                    <p>{userPagination.total} tài khoản phù hợp bộ lọc.</p>
                  </div>
                  <span className="ad-count">{users.filter((item) => item.isActive).length} đang hoạt động</span>
                </div>

                <div className="ad-filter users">
                  <div className="ad-search">
                    <AdminIcon name="search" size={17} />
                    <input
                      value={userFilters.search}
                      onChange={(event) => updateUserFilter('search', event.target.value)}
                      placeholder="Tên, email hoặc số điện thoại..."
                    />
                    {userFilters.search && (
                      <button type="button" onClick={() => updateUserFilter('search', '')} aria-label="Xóa tìm kiếm">
                        <AdminIcon name="close" size={14} />
                      </button>
                    )}
                  </div>

                  <select value={userFilters.role} onChange={(event) => updateUserFilter('role', event.target.value)}>
                    <option value="">Mọi vai trò</option>
                    <option value="seller">Chủ cửa hàng</option>
                    <option value="admin">Quản trị viên</option>
                  </select>

                  <select value={userFilters.isActive} onChange={(event) => updateUserFilter('isActive', event.target.value)}>
                    <option value="">Mọi trạng thái</option>
                    <option value="true">Đang hoạt động</option>
                    <option value="false">Đã khóa</option>
                  </select>

                  <input type="date" value={userFilters.dateFrom} onChange={(event) => updateUserFilter('dateFrom', event.target.value)} />
                  <input type="date" value={userFilters.dateTo} onChange={(event) => updateUserFilter('dateTo', event.target.value)} />

                  <button type="button" className="ad-clear" onClick={() => {
                    setUserFilters({ search: '', role: '', isActive: '', dateFrom: '', dateTo: '' });
                    setUserPage(1);
                  }}>
                    <AdminIcon name="trash" size={15} /> Xóa lọc
                  </button>
                </div>

                <div className="ad-user-wrap">
                  <div className="ad-user-head">
                    <span>Người dùng</span>
                    <span>Liên hệ</span>
                    <span>Cửa hàng</span>
                    <span>Vai trò</span>
                    <span>Ngày tạo</span>
                    <span>Trạng thái</span>
                    <span>Thao tác</span>
                  </div>

                  <div className="ad-user-list">
                    {userLoading && <div className="ad-loading">Đang tải danh sách tài khoản...</div>}

                    {!userLoading && users.map((account) => (
                      <article className="ad-user-row" key={account._id}>
                        <div className="ad-user-identity">
                          <span className="ad-user-avatar">{account.name?.[0]?.toUpperCase() || 'U'}</span>
                          <div>
                            <b>{account.name}</b>
                            <small>ID: {String(account._id).slice(-8).toUpperCase()}</small>
                          </div>
                        </div>

                        <div className="ad-user-contact">
                          <b>{account.email}</b>
                          <small>{account.phone || 'Chưa cập nhật SĐT'}</small>
                        </div>

                        <div className="ad-user-shop">
                          {account.shop ? (
                            <>
                              <b>{account.shop.name}</b>
                              <small>/{account.shop.slug} · {account.shop.approvalStatus || 'approved'}</small>
                            </>
                          ) : (
                            <>
                              <b>Chưa có cửa hàng</b>
                              <small>Không có dữ liệu shop</small>
                            </>
                          )}
                        </div>

                        <span className={`ad-role ${account.role}`}>{account.role === 'admin' ? 'Admin tổng' : 'Chủ shop'}</span>

                        <div className="ad-user-date">
                          <b>{new Date(account.createdAt).toLocaleDateString('vi-VN')}</b>
                          <small>{new Date(account.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small>
                        </div>

                        <span className={`ad-user-state ${account.isActive ? 'active' : 'locked'}`}>
                          {account.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                        </span>

                        <button
                          type="button"
                          className={`ad-user-action ${account.isActive ? 'danger' : 'success'}`}
                          disabled={String(account._id) === String(user?.id || user?._id)}
                          onClick={() => toggleUser(account)}
                        >
                          {account.isActive ? 'Khóa tài khoản' : 'Mở lại'}
                        </button>
                      </article>
                    ))}

                    {!userLoading && !users.length && (
                      <div className="ad-empty">
                        <span className="ad-empty-icon"><AdminIcon name="users" /></span>
                        <h3>Không tìm thấy tài khoản</h3>
                        <p>Thử thay đổi bộ lọc tìm kiếm.</p>
                      </div>
                    )}
                  </div>
                </div>

                <Pagination pagination={userPagination} onPageChange={setUserPage} />
              </section>
            )}
          </div>
        </div>
      </main>
    </section>
  );
};

export default AdminDashboard;
