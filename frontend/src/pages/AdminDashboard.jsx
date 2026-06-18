import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { connectSocket } from '../realtime/socket.js';
import { playOrderSound } from '../utils/orderSound.js';
import { playMessageSound, requestNotificationPermission, showMessageNotification } from '../utils/messageNotifications.js';
import { useAuth } from '../context/AuthContext.jsx';
import ChatNotificationButton from '../components/ChatNotificationButton.jsx';
import ConversationWorkspace from '../components/ConversationWorkspace.jsx';
import Pagination from '../components/Pagination.jsx';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const formatDateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const statusLabels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị', ready: 'Sẵn sàng', serving: 'Đang phục vụ', shipping: 'Đang giao', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
const paymentLabels = { unpaid: 'Chưa thanh toán', pending: 'Đang xử lý', paid: 'Đã thanh toán', failed: 'Thất bại', refunded: 'Đã hoàn tiền' };
const typeLabels = { dine_in: 'Tại bàn', delivery: 'Giao tận nơi', pickup: 'Nhận tại shop', shipping: 'Gửi hàng' };
const paymentMethodLabels = { cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', vnpay: 'VNPAY' };
const emptyPagination = { page: 1, limit: 12, total: 0, totalPages: 1, hasNext: false, hasPrev: false };
const upsertFirst = (list, item, max = 50) => [item, ...list.filter((entry) => entry._id !== item._id)].slice(0, max);
const mergeById = (list, item) => list.some((entry) => entry._id === item._id) ? list.map((entry) => entry._id === item._id ? item : entry) : [item, ...list];
const toParams = (filters, page, limit = 12) => Object.fromEntries(Object.entries({ ...filters, page, limit }).filter(([, value]) => value !== '' && value !== null && value !== undefined && value !== false));

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('admin_sound') === 'on');

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
      if (opened) api.post(`/chat/admin/${conversation._id}/read`).catch(() => {});
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
  const updatePayment = async (id, paymentStatus) => { try { const res = await api.put(`/admin/orders/${id}/payment`, { paymentStatus }); setOrders((current) => mergeById(current, res.data.order)); } catch (err) { showError(err); } };

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

  const navItems = [['overview','⌂','Tổng quan'],['shops','◇','Cửa hàng'],['orders','☷','Đơn hàng'],['messages','◌','Tin nhắn'],['users','♙','Tài khoản']];
  const title = navItems.find((item) => item[0] === tab)?.[2] || 'Admin';

  // CSS Đẹp Toàn Bộ (Giao diện Modern Dashboard)
  const styles = `
    :root {
      --bg-app: #f4f7fe;
      --bg-surface: #ffffff;
      --bg-sidebar: #111c44;
      --c-primary: #4318FF;
      --c-primary-hover: #3311db;
      --c-text-main: #2b3674;
      --c-text-muted: #a3aed1;
      --c-sidebar-text: #a3aed1;
      --c-sidebar-active: #ffffff;
      --c-sidebar-hover: #1b2559;
      --c-border: #e2e8f0;
      --c-success: #05cd99;
      --c-warning: #ffce20;
      --c-danger: #ee5d50;
      --radius-sm: 8px;
      --radius-md: 16px;
      --radius-lg: 24px;
      --shadow-soft: 0px 18px 40px rgba(112, 144, 176, 0.12);
      --shadow-sm: 0px 4px 12px rgba(112, 144, 176, 0.08);
      --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    .modern-dashboard {
      display: flex;
      height: 100vh;
      background: var(--bg-app);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: var(--c-text-main);
      overflow: hidden;
    }

    /* TOAST & ALERTS */
    .toast-message {
      position: fixed;
      top: 24px; right: 24px;
      background: var(--c-primary); color: white;
      padding: 14px 24px; border-radius: var(--radius-sm);
      box-shadow: var(--shadow-soft); z-index: 9999;
      font-weight: 500; display: flex; align-items: center; gap: 8px;
      animation: slideIn 0.4s ease-out;
    }
    .alert-error {
      background: #fee2e2; color: #991b1b;
      padding: 16px; border-radius: var(--radius-sm);
      margin-bottom: 24px; display: flex; justify-content: space-between;
      border: 1px solid #f87171;
    }
    .alert-error button { background: none; border: none; color: inherit; font-size: 20px; cursor: pointer; }

    /* SIDEBAR */
    .sidebar {
      width: 280px; background: var(--bg-sidebar);
      display: flex; flex-direction: column;
      transition: var(--transition);
      z-index: 10;
    }
    .sidebar-brand {
      height: 90px; display: flex; align-items: center; gap: 16px;
      padding: 0 32px; color: white; border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .brand-icon {
      width: 40px; height: 40px; background: var(--c-primary);
      border-radius: 12px; display: flex; align-items: center; justify-content: center;
      font-weight: bold; font-size: 20px;
    }
    .sidebar-nav { flex: 1; padding: 24px 16px; display: flex; flex-direction: column; gap: 8px; }
    .sidebar-nav button {
      background: transparent; border: none; width: 100%;
      padding: 14px 16px; border-radius: var(--radius-sm);
      color: var(--c-sidebar-text); font-size: 15px; font-weight: 500;
      display: flex; align-items: center; gap: 16px; cursor: pointer;
      transition: var(--transition); text-align: left;
    }
    .sidebar-nav button:hover { background: var(--c-sidebar-hover); color: var(--c-sidebar-active); }
    .sidebar-nav button.active { background: var(--c-primary); color: white; }
    .sidebar-nav button span { font-size: 20px; width: 24px; text-align: center; }
    .sidebar-nav button i {
      margin-left: auto; background: var(--c-danger); color: white;
      font-size: 11px; padding: 2px 8px; border-radius: 20px; font-style: normal; font-weight: bold;
    }
    .sidebar-footer {
      padding: 24px; border-top: 1px solid rgba(255,255,255,0.05);
      display: flex; align-items: center; gap: 12px; color: white;
    }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: #475569; display: grid; place-items: center; font-weight: bold;}
    .user-info { flex: 1; overflow: hidden; }
    .user-info b { display: block; font-size: 14px; white-space: nowrap; text-overflow: ellipsis; }
    .user-info small { color: var(--c-sidebar-text); font-size: 12px; }
    .btn-logout { background: none; border: none; color: var(--c-sidebar-text); cursor: pointer; padding: 8px; border-radius: 8px; }
    .btn-logout:hover { background: rgba(255,255,255,0.1); color: white; }

    /* MAIN CONTENT */
    .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .header {
      height: 90px; padding: 0 40px; display: flex; align-items: center; justify-content: space-between;
      background: rgba(244, 247, 254, 0.8); backdrop-filter: blur(10px); z-index: 5;
    }
    .header-title h1 { font-size: 24px; font-weight: 700; color: var(--c-text-main); margin-bottom: 4px; }
    .header-title p { font-size: 14px; color: var(--c-text-muted); }
    .header-actions { display: flex; align-items: center; gap: 16px; }
    
    .btn {
      padding: 10px 20px; border-radius: var(--radius-sm); font-weight: 600; font-size: 14px;
      cursor: pointer; transition: var(--transition); border: none;
      display: flex; align-items: center; gap: 8px; text-decoration: none;
    }
    .btn-primary { background: var(--c-primary); color: white; }
    .btn-primary:hover { background: var(--c-primary-hover); }
    .btn-outline { border: 1px solid var(--c-border); background: var(--bg-surface); color: var(--c-text-main); }
    .btn-outline:hover { background: #f8fafc; }
    .btn-danger { background: #fee2e2; color: #ef4444; }
    .btn-success { background: #dcfce7; color: #22c55e; }

    .content-scroll { flex: 1; overflow-y: auto; padding: 24px 40px 40px; }

    /* METRICS GRID */
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-bottom: 32px; }
    .metric-card {
      background: var(--bg-surface); padding: 24px; border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 8px;
    }
    .metric-card span { color: var(--c-text-muted); font-size: 14px; font-weight: 500; }
    .metric-card b { font-size: 28px; color: var(--c-text-main); font-weight: 700; }
    .metric-card small { color: var(--c-primary); font-size: 13px; font-weight: 500; background: rgba(67, 24, 255, 0.08); padding: 4px 12px; border-radius: 20px; align-self: flex-start;}

    /* LAYOUT GRIDS */
    .dashboard-2col { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
    .card { background: var(--bg-surface); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); overflow: hidden; }
    .card-header { padding: 24px; border-bottom: 1px solid var(--c-border); display: flex; justify-content: space-between; align-items: center; }
    .card-header h2 { font-size: 18px; font-weight: 700; }
    .card-body { padding: 24px; }

    /* LISTS & ITEMS */
    .list-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 0; border-bottom: 1px solid var(--c-border); cursor: pointer; transition: var(--transition);
    }
    .list-item:hover { transform: translateX(4px); }
    .list-item:last-child { border-bottom: none; }
    .item-info { display: flex; align-items: center; gap: 16px; }
    .item-icon { width: 48px; height: 48px; border-radius: var(--radius-sm); background: #f1f5f9; display: grid; place-items: center; font-weight: 600; color: var(--c-primary); }
    .item-details h4 { font-size: 15px; margin-bottom: 4px; }
    .item-details p { font-size: 13px; color: var(--c-text-muted); }
    .item-meta { text-align: right; }
    .item-meta b { display: block; font-size: 15px; margin-bottom: 4px; }
    
    /* BADGES */
    .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-warning { background: #fef9c3; color: #854d0e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-neutral { background: #f1f5f9; color: #475569; }

    /* FILTER BAR */
    .filter-bar {
      display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;
      background: var(--bg-surface); padding: 16px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);
    }
    .filter-input {
      flex: 1; min-width: 200px; padding: 10px 16px; border: 1px solid var(--c-border);
      border-radius: var(--radius-sm); outline: none; font-family: inherit; transition: var(--transition);
    }
    .filter-input:focus { border-color: var(--c-primary); box-shadow: 0 0 0 3px rgba(67, 24, 255, 0.1); }
    .filter-select {
      padding: 10px 16px; border: 1px solid var(--c-border); border-radius: var(--radius-sm);
      outline: none; background: white; cursor: pointer;
    }

    /* TABLES */
    .table-container { width: 100%; overflow-x: auto; background: var(--bg-surface); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 16px 24px; background: #f8fafc; color: var(--c-text-muted); font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--c-border); white-space: nowrap;}
    td { padding: 16px 24px; border-bottom: 1px solid var(--c-border); font-size: 14px; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover { background: #f8fafc; }

    /* SHOP CARDS GRID */
    .shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
    .shop-card { background: var(--bg-surface); border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-sm); display: flex; flex-direction: column;}
    .shop-cover { height: 120px; background-size: cover; background-position: center; position: relative; }
    .shop-status-abs { position: absolute; top: 12px; right: 12px; }
    .shop-body { padding: 20px; position: relative; flex: 1; display: flex; flex-direction: column;}
    .shop-logo { width: 64px; height: 64px; border-radius: 12px; border: 4px solid white; position: absolute; top: -32px; left: 20px; background: white; box-shadow: var(--shadow-sm); }
    .shop-info { margin-top: 32px; margin-bottom: 16px; }
    .shop-info h3 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .shop-info p { font-size: 13px; color: var(--c-text-muted); }
    .shop-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); }
    .shop-stats div small { display: block; color: var(--c-text-muted); font-size: 11px; margin-bottom: 2px; }
    .shop-stats div b { font-size: 13px; color: var(--c-text-main); }
    .shop-actions { margin-top: auto; display: flex; gap: 8px; }
    .shop-actions button { flex: 1; padding: 8px; font-size: 13px; }

    /* EMPTY STATE */
    .empty-state { padding: 60px 24px; text-align: center; color: var(--c-text-muted); }
    .empty-state span { font-size: 48px; display: block; margin-bottom: 16px; opacity: 0.5; }
    .empty-state h3 { font-size: 18px; color: var(--c-text-main); margin-bottom: 8px; }

    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="modern-dashboard">
        {toast && (
          <div className="toast-message">
            <span>✦</span> {toast}
          </div>
        )}

        <aside className="sidebar">
          <div className="sidebar-brand">
          <img src="/icons/icon-192.png" alt="FoodHub" width={60} height={60}/>
            <div>
              <b style={{display:'block', fontSize:'18px'}}>Ngự Tâm</b>
              <small style={{color:'var(--c-text-muted)'}}>Control Center</small>
            </div>
          </div>
          
          <nav className="sidebar-nav">
            {navItems.map(([value, icon, label]) => (
              <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>
                <span>{icon}</span>
                {label}
                {value === 'messages' && chatUnread > 0 && <i>{chatUnread > 99 ? '99+' : chatUnread}</i>}
                {value === 'shops' && stats?.pendingShops > 0 && <i>{stats.pendingShops}</i>}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="avatar">{(user?.name || 'A')[0]}</div>
            <div className="user-info">
              <b>{user?.name}</b>
              <small>{user?.email}</small>
            </div>
            <button className="btn-logout" onClick={() => { logout(); navigate('/'); }} title="Đăng xuất">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        </aside>

        <main className="main-content">
          <header className="header">
            <div className="header-title">
              <h1>{title}</h1>
              <p>Hệ thống quản trị và kiểm soát dữ liệu toàn nền tảng</p>
            </div>
            <div className="header-actions">
              <ChatNotificationButton unread={chatUnread} onClick={() => setTab('messages')} label="Tin nhắn từ shop" />
              {!soundEnabled ? (
                <button className="btn btn-primary" onClick={enableSound}>
                  <span>🔊</span> Bật thông báo
                </button>
              ) : (
                <span className="badge badge-success" style={{padding: '8px 16px'}}>● Realtime On</span>
              )}
              <a className="btn btn-outline" href="/" target="_blank" rel="noreferrer">Xem trang tổng ↗</a>
            </div>
          </header>

          <div className="content-scroll">
            {error && (
              <div className="alert-error">
                {error}
                <button onClick={() => setError('')}>×</button>
              </div>
            )}

            {tab === 'overview' && (
              <>
                <div className="metric-grid">
                  <article className="metric-card">
                    <span>Doanh thu hiện tại</span>
                    <b>{money(revenue)}</b>
                    <small>Đơn đã thanh toán</small>
                  </article>
                  <article className="metric-card">
                    <span>Tổng cửa hàng</span>
                    <b>{stats?.shops || 0}</b>
                    <small className="badge-warning" style={{background: 'rgba(255, 206, 32, 0.2)', color: '#854d0e'}}>{stats?.pendingShops || 0} chờ duyệt</small>
                  </article>
                  <article className="metric-card">
                    <span>Tổng đơn hàng</span>
                    <b>{stats?.orders || 0}</b>
                    <small>{orders.filter((item) => item.status === 'pending').length} đơn mới</small>
                  </article>
                  <article className="metric-card">
                    <span>Tin chưa đọc</span>
                    <b>{chatUnread}</b>
                    <small>{stats?.openConversations || 0} hội thoại mở</small>
                  </article>
                </div>

                <div className="dashboard-2col">
                  <section className="card">
                    <div className="card-header">
                      <h2>Đơn hàng gần đây</h2>
                      <button className="btn btn-outline" onClick={() => setTab('orders')} style={{padding:'6px 12px', fontSize:'12px'}}>Xem tất cả</button>
                    </div>
                    <div className="card-body" style={{padding: 0}}>
                      {orders.slice(0, 7).map((order) => (
                        <div key={order._id} className="list-item" onClick={() => setTab('orders')} style={{padding: '16px 24px'}}>
                          <div className="item-info">
                            <div className="item-icon">{order.tableNumber ? `B${order.tableNumber}` : 'Đ'}</div>
                            <div className="item-details">
                              <h4>#{order.orderCode} - {order.shopId?.name}</h4>
                              <p>{order.customerName} · {typeLabels[order.orderType]}</p>
                            </div>
                          </div>
                          <div className="item-meta">
                            <b>{money(order.totalAmount)}</b>
                            <span className={`badge ${order.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                              {paymentLabels[order.paymentStatus]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="card">
                    <div className="card-header"><h2>Cần xử lý</h2></div>
                    <div className="card-body">
                      <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
                        <button className="btn btn-outline" style={{justifyContent: 'space-between', padding: '16px'}} onClick={() => { setShopFilters((f) => ({...f,approvalStatus:'pending'})); setShopPage(1); setTab('shops'); }}>
                          <div style={{textAlign:'left'}}>
                            <div style={{fontWeight:'bold'}}>Shop chờ duyệt</div>
                            <div style={{fontSize:'12px', color:'var(--c-text-muted)'}}>Kiểm tra hồ sơ đăng ký</div>
                          </div>
                          <span className="badge badge-warning" style={{fontSize:'14px'}}>{stats?.pendingShops || 0}</span>
                        </button>
                        <button className="btn btn-outline" style={{justifyContent: 'space-between', padding: '16px'}} onClick={() => setTab('messages')}>
                          <div style={{textAlign:'left'}}>
                            <div style={{fontWeight:'bold'}}>Tin nhắn mới</div>
                            <div style={{fontSize:'12px', color:'var(--c-text-muted)'}}>Hỗ trợ chủ cửa hàng</div>
                          </div>
                          <span className="badge badge-danger" style={{fontSize:'14px'}}>{chatUnread}</span>
                        </button>
                        <button className="btn btn-outline" style={{justifyContent: 'space-between', padding: '16px'}} onClick={() => { setOrderFilters((f) => ({...f,status:'pending'})); setTab('orders'); }}>
                          <div style={{textAlign:'left'}}>
                            <div style={{fontWeight:'bold'}}>Đơn hàng mới</div>
                            <div style={{fontSize:'12px', color:'var(--c-text-muted)'}}>Theo dõi toàn hệ thống</div>
                          </div>
                          <span className="badge badge-neutral" style={{fontSize:'14px'}}>{orders.filter((item) => item.status === 'pending').length}</span>
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </>
            )}

            {tab === 'shops' && (
              <section>
                <div className="filter-bar">
                  <input className="filter-input" value={shopFilters.search} onChange={(e) => updateShopFilter('search', e.target.value)} placeholder="Tên shop, chủ shop, domain..." />
                  <select className="filter-select" value={shopFilters.businessType} onChange={(e) => updateShopFilter('businessType', e.target.value)}>
                    <option value="">Mọi mô hình</option><option value="restaurant">Nhà hàng</option><option value="retail">Thương mại</option>
                  </select>
                  <select className="filter-select" value={shopFilters.approvalStatus} onChange={(e) => updateShopFilter('approvalStatus', e.target.value)}>
                    <option value="">Mọi trạng thái duyệt</option><option value="pending">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="rejected">Chưa duyệt</option>
                  </select>
                  <select className="filter-select" value={shopFilters.isActive} onChange={(e) => updateShopFilter('isActive', e.target.value)}>
                    <option value="">Mọi hoạt động</option><option value="true">Đang mở</option><option value="false">Đang khóa</option>
                  </select>
                  <button className="btn btn-outline" onClick={() => { setShopFilters({ search: '', businessType: '', approvalStatus: '', isActive: '', dateFrom: '', dateTo: '' }); setShopPage(1); }}>Xóa lọc</button>
                </div>

                <div className="shop-grid">
                  {shopLoading && <div className="empty-state">Đang tải dữ liệu...</div>}
                  {!shopLoading && shops.map((shop) => {
                    const approval = shop.approvalStatus || 'approved';
                    const badgeClass = approval === 'approved' ? 'badge-success' : approval === 'pending' ? 'badge-warning' : 'badge-danger';
                    const badgeText = approval === 'approved' ? 'Đã duyệt' : approval === 'pending' ? 'Chờ duyệt' : 'Chưa duyệt';
                    return (
                      <article className="shop-card" key={shop._id}>
                        <div className="shop-cover" style={{ backgroundImage: `url(${shop.bannerUrl || 'https://placehold.co/800x320/1b1712/dabf8a?text=Cover'})` }}>
                          <span className={`badge ${badgeClass} shop-status-abs`}>{badgeText}</span>
                        </div>
                        <div className="shop-body">
                          <img className="shop-logo" src={shop.logoUrl || 'https://placehold.co/100/17130f/efd7a6?text=Logo'} alt="" />
                          <div className="shop-info">
                            <h3>{shop.name}</h3>
                            <p>{shop.businessType === 'restaurant' ? 'Nhà hàng / quán ăn' : 'Thương mại'} · /shop/{shop.slug}</p>
                          </div>
                          <div className="shop-stats">
                            <div><small>Chủ shop</small><b>{shop.ownerId?.name || '—'}</b></div>
                            <div><small>Ngân hàng</small><b>{shop.bankName || '—'}</b></div>
                            <div><small>Domain</small><b>{shop.customDomain || 'Hệ thống'}</b></div>
                            <div><small>Trạng thái</small><b style={{color: shop.isActive ? 'var(--c-success)' : 'var(--c-danger)'}}>{shop.isActive ? 'Đang mở' : 'Đang khóa'}</b></div>
                          </div>
                          {shop.approvalNote && <p style={{fontSize:'12px', color:'var(--c-danger)', marginBottom:'16px', background:'#fee2e2', padding:'8px', borderRadius:'8px'}}>Ghi chú: {shop.approvalNote}</p>}
                          <div className="shop-actions">
                            {approval !== 'approved' && <button className="btn btn-success" onClick={() => approveShop(shop, 'approved')}>✓ Duyệt</button>}
                            {approval !== 'rejected' && <button className="btn btn-danger" onClick={() => approveShop(shop, 'rejected')}>Từ chối</button>}
                            {approval === 'approved' && <button className="btn btn-outline" onClick={() => toggleShop(shop)}>{shop.isActive ? 'Khóa shop' : 'Mở shop'}</button>}
                            <a className="btn btn-primary" href={shop.customDomain ? `https://${shop.customDomain}` : `/shop/${shop.slug}`} target="_blank" rel="noreferrer" style={{display:'grid', placeItems:'center'}}>↗</a>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!shopLoading && !shops.length && (
                  <div className="empty-state">
                    <span>◇</span><h3>Không tìm thấy cửa hàng</h3><p>Thử thay đổi bộ lọc tìm kiếm.</p>
                  </div>
                )}
                <div style={{marginTop: '32px'}}><Pagination pagination={shopPagination} onPageChange={setShopPage} /></div>
              </section>
            )}

            {tab === 'orders' && (
              <section>
                <div className="filter-bar">
                  <input className="filter-input" value={orderFilters.search} onChange={(e) => updateOrderFilter('search', e.target.value)} placeholder="Mã đơn, SĐT..." />
                  <select className="filter-select" value={orderFilters.shopId} onChange={(e) => updateOrderFilter('shopId', e.target.value)}>
                    <option value="">Mọi cửa hàng</option>
                    {shops.map((shop) => <option key={shop._id} value={shop._id}>{shop.name}</option>)}
                  </select>
                  <select className="filter-select" value={orderFilters.status} onChange={(e) => updateOrderFilter('status', e.target.value)}>
                    <option value="">Mọi trạng thái</option>
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <select className="filter-select" value={orderFilters.paymentStatus} onChange={(e) => updateOrderFilter('paymentStatus', e.target.value)}>
                    <option value="">Mọi thanh toán</option>
                    {Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <button className="btn btn-outline" onClick={() => { setOrderFilters({ search: '', shopId: '', status: '', paymentStatus: '', orderType: '', paymentMethod: '', dateFrom: '', dateTo: '' }); setOrderPage(1); }}>Xóa lọc</button>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Mã đơn</th>
                        <th>Cửa hàng</th>
                        <th>Khách hàng</th>
                        <th>Loại đơn</th>
                        <th>Tổng tiền</th>
                        <th>Trạng thái</th>
                        <th>Thanh toán</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderLoading && <tr><td colSpan="7" className="empty-state">Đang tải...</td></tr>}
                      {!orderLoading && orders.map(order => (
                        <tr key={order._id}>
                          <td><b>#{order.orderCode}</b><br/><span style={{fontSize:'12px',color:'var(--c-text-muted)'}}>{new Date(order.createdAt).toLocaleDateString('vi-VN')}</span></td>
                          <td>{order.shopId?.name || '—'}</td>
                          <td>{order.customerName}<br/><span style={{fontSize:'12px',color:'var(--c-text-muted)'}}>{order.customerPhone}</span></td>
                          <td><span className="badge badge-neutral">{typeLabels[order.orderType]}</span>{order.tableNumber && ` (Bàn ${order.tableNumber})`}</td>
                          <td><b>{money(order.totalAmount)}</b></td>
                          <td>
                            <select className="filter-select" style={{padding:'6px', fontSize:'13px'}} value={order.status} onChange={(e) => updateStatus(order._id, e.target.value)}>
                              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          </td>
                          <td>
                            <select className={`filter-select ${order.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`} style={{padding:'6px', fontSize:'13px', border:'none'}} value={order.paymentStatus} onChange={(e) => updatePayment(order._id, e.target.value)}>
                              {Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!orderLoading && !orders.length && (
                    <div className="empty-state">
                      <span>☷</span><h3>Không tìm thấy đơn hàng</h3><p>Thử thay đổi bộ lọc tìm kiếm.</p>
                    </div>
                  )}
                </div>
                <div style={{marginTop: '32px'}}><Pagination pagination={orderPagination} onPageChange={setOrderPage} /></div>
              </section>
            )}

            {tab === 'messages' && (
              <div style={{height: 'calc(100vh - 180px)'}}>
                <ConversationWorkspace conversations={conversations} viewerRole="admin" activeId={activeChatId} onSelect={markChatRead} onReply={replySeller} replyValue={replyText} onReplyChange={setReplyText} search={chatSearch} onSearchChange={(value) => { setChatSearch(value); setChatPage(1); }} unreadOnly={chatUnreadOnly} onUnreadOnlyChange={(value) => { setChatUnreadOnly(value); setChatPage(1); }} pagination={chatPagination} onPageChange={setChatPage} titleFor={(thread) => thread.shopId?.name || 'Cửa hàng'} subtitleFor={(thread) => thread.subject || 'Hỗ trợ cửa hàng'} unreadField="unreadForAdmin" loading={chatLoading} />
              </div>
            )}

            {tab === 'users' && (
              <section>
                <div className="filter-bar">
                  <input className="filter-input" value={userFilters.search} onChange={(e) => updateUserFilter('search', e.target.value)} placeholder="Tên, email, SĐT..." />
                  <select className="filter-select" value={userFilters.role} onChange={(e) => updateUserFilter('role', e.target.value)}>
                    <option value="">Mọi vai trò</option><option value="seller">Chủ shop</option><option value="admin">Admin</option>
                  </select>
                  <select className="filter-select" value={userFilters.isActive} onChange={(e) => updateUserFilter('isActive', e.target.value)}>
                    <option value="">Mọi trạng thái</option><option value="true">Hoạt động</option><option value="false">Đã khóa</option>
                  </select>
                  <button className="btn btn-outline" onClick={() => { setUserFilters({ search: '', role: '', isActive: '', dateFrom: '', dateTo: '' }); setUserPage(1); }}>Xóa bộ lọc</button>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Người dùng</th>
                        <th>Liên hệ</th>
                        <th>Vai trò / Cửa hàng</th>
                        <th>Ngày tham gia</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userLoading && <tr><td colSpan="6" className="empty-state">Đang tải...</td></tr>}
                      {!userLoading && users.map((account) => (
                        <tr key={account._id}>
                          <td>
                            <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                              <div className="avatar" style={{width:'36px', height:'36px', fontSize:'14px', background:'var(--c-primary)', color:'white'}}>{account.name?.[0]?.toUpperCase() || 'U'}</div>
                              <div><b>{account.name}</b><br/><span style={{fontSize:'12px', color:'var(--c-text-muted)'}}>ID: {String(account._id).slice(-6).toUpperCase()}</span></div>
                            </div>
                          </td>
                          <td>{account.email}<br/><span style={{fontSize:'12px', color:'var(--c-text-muted)'}}>{account.phone || 'Chưa cập nhật'}</span></td>
                          <td>
                            <span className={`badge ${account.role === 'admin' ? 'badge-danger' : 'badge-neutral'}`}>{account.role === 'admin' ? 'Admin tổng' : 'Chủ shop'}</span>
                            {account.shop && <div style={{fontSize:'12px', marginTop:'4px'}}>{account.shop.name}</div>}
                          </td>
                          <td>{new Date(account.createdAt).toLocaleDateString('vi-VN')}</td>
                          <td><span className={`badge ${account.isActive ? 'badge-success' : 'badge-danger'}`}>{account.isActive ? 'Đang hoạt động' : 'Đã khóa'}</span></td>
                          <td>
                            <button className={`btn ${account.isActive ? 'btn-outline' : 'btn-success'}`} style={{padding:'6px 12px', fontSize:'12px'}} disabled={String(account._id) === String(user?.id || user?._id)} onClick={() => toggleUser(account)}>
                              {account.isActive ? 'Khóa tài khoản' : 'Mở lại'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!userLoading && !users.length && (
                    <div className="empty-state">
                      <span>♙</span><h3>Không tìm thấy tài khoản</h3><p>Thử thay đổi bộ lọc tìm kiếm.</p>
                    </div>
                  )}
                </div>
                <div style={{marginTop: '32px'}}><Pagination pagination={userPagination} onPageChange={setUserPage} /></div>
              </section>
            )}

          </div>
        </main>
      </div>
    </>
  );
};

export default AdminDashboard;