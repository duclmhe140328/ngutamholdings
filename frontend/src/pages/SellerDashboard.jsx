import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { connectSocket } from '../realtime/socket.js';
import { playOrderSound } from '../utils/orderSound.js';
import { playMessageSound, requestNotificationPermission, showMessageNotification } from '../utils/messageNotifications.js';
import { useAuth } from '../context/AuthContext.jsx';
import TableQrCard from '../components/TableQrCard.jsx';
import OrderNotificationBell from '../components/OrderNotificationBell.jsx';
import ChatNotificationButton from '../components/ChatNotificationButton.jsx';
import ConversationWorkspace from '../components/ConversationWorkspace.jsx';
import Pagination from '../components/Pagination.jsx';
import InvoicePrintModal from '../components/InvoicePrintModal.jsx';
import LoyaltyManager from '../components/LoyaltyManager.jsx';
import { getPublicAppUrl } from '../utils/publicAppUrl.js';
import { 
  LayoutDashboard, MonitorCheck, ScrollText, ScanLine, 
  PackageSearch, MessageCircle, ShieldQuestion, Settings,
  LogOut, Volume2, VolumeX, ExternalLink, Plus, Search,
  ChevronRight, AlertCircle, RefreshCcw, CheckCircle2, XCircle, Menu,
  Receipt, Award, Printer
} from 'lucide-react';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const formatDateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const statusLabels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị', ready: 'Sẵn sàng', serving: 'Đang phục vụ', shipping: 'Đang giao', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
const paymentLabels = { unpaid: 'Chưa thanh toán', pending: 'Đang xử lý', paid: 'Đã thanh toán', failed: 'Thất bại', refunded: 'Đã hoàn tiền' };
const orderTypeLabels = { dine_in: 'Tại bàn', delivery: 'Giao tận nơi', pickup: 'Nhận tại shop', shipping: 'Gửi hàng' };
const paymentMethodLabels = { cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', vnpay: 'VNPAY' };
const invoiceStatusLabels = { not_issued: 'Chưa lập', draft: 'Phiếu nháp', external_issued: 'Đã phát hành HĐĐT', cancelled: 'Đã hủy' };
const emptyProduct = { name: '', description: '', price: '', salePrice: '', category: '', stock: 0, images: '', isActive: true };
const emptyPagination = { page: 1, limit: 12, total: 0, totalPages: 1, hasNext: false, hasPrev: false };
const upsertFirst = (list, item, max = 50) => [item, ...list.filter((entry) => entry._id !== item._id)].slice(0, max);
const mergeById = (list, item) => list.some((entry) => entry._id === item._id) ? list.map((entry) => entry._id === item._id ? item : entry) : [item, ...list];
const toParams = (filters, page, limit = 12) => Object.fromEntries(Object.entries({ ...filters, page, limit }).filter(([, value]) => value !== '' && value !== null && value !== undefined && value !== false));

const SellerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [shopForm, setShopForm] = useState({});
  const [tables, setTables] = useState([]);
  const [tab, setTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('seller_sound') === 'on');

  const [orders, setOrders] = useState([]);
  const [orderSummary, setOrderSummary] = useState({ totalOrders: 0, revenue: 0, pending: 0, unpaid: 0, dineIn: 0 });
  const [orderPagination, setOrderPagination] = useState(emptyPagination);
  const [orderPage, setOrderPage] = useState(1);
  const [orderFilters, setOrderFilters] = useState({ search: '', status: '', paymentStatus: '', orderType: '', paymentMethod: '', dateFrom: '', dateTo: '' });
  const [orderLoading, setOrderLoading] = useState(false);
  
  const [invoiceOrders, setInvoiceOrders] = useState([]);
  const [invoicePagination, setInvoicePagination] = useState(emptyPagination);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceFilters, setInvoiceFilters] = useState({ search: '', invoiceStatus: '', dateFrom: '', dateTo: '' });
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  
  const [posOrders, setPosOrders] = useState([]);
  const [posFilters, setPosFilters] = useState({ search: '', status: 'active', paymentStatus: '' });

  const [products, setProducts] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [productPagination, setProductPagination] = useState(emptyPagination);
  const [productPage, setProductPage] = useState(1);
  const [productFilters, setProductFilters] = useState({ search: '', category: '', isActive: '', stock: '' });
  const [productLoading, setProductLoading] = useState(false);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState(null);

  const [customerThreads, setCustomerThreads] = useState([]);
  const [customerPagination, setCustomerPagination] = useState(emptyPagination);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerUnreadOnly, setCustomerUnreadOnly] = useState(false);
  const [activeCustomerId, setActiveCustomerId] = useState('');
  const [customerReply, setCustomerReply] = useState('');
  const [customerChatLoading, setCustomerChatLoading] = useState(false);

  const [adminThreads, setAdminThreads] = useState([]);
  const [activeAdminId, setActiveAdminId] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [unreadTotals, setUnreadTotals] = useState({ customer_shop: 0, shop_admin: 0 });

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [orderNotifications, setOrderNotifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem('seller_order_notifications') || '[]'); } catch { return []; }
  });
  const [publicUrlDraft, setPublicUrlDraft] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [tableStatus, setTableStatus] = useState('all');
  const [tablePage, setTablePage] = useState(1);
  const [addTableCount, setAddTableCount] = useState(1);
  const [addingTables, setAddingTables] = useState(false);

  const showError = (err) => setError(err?.message || 'Có lỗi xảy ra');

  const loadShop = async () => {
    const res = await api.get('/shops/me/current');
    const current = res.data.shop;
    setShop(current);
    if (!current) return null;
    setShopForm({ ...current, serviceModes: current.serviceModes || [], paymentMethods: current.paymentMethods || [] });
    setPublicUrlDraft(getPublicAppUrl(current.publicBaseUrl));
    return current;
  };

  const fetchOrders = async (page = orderPage, filters = orderFilters) => {
    setOrderLoading(true);
    try {
      const res = await api.get('/orders/my-shop', { params: toParams(filters, page) });
      setOrders(res.data.orders || []);
      setOrderSummary(res.data.summary || orderSummary);
      setOrderPagination(res.data.pagination || emptyPagination);
    } catch (err) { showError(err); } finally { setOrderLoading(false); }
  };

  const fetchInvoiceOrders = async (page = invoicePage, filters = invoiceFilters) => {
    setInvoiceLoading(true);
    try {
      const res = await api.get('/orders/my-shop', { params: toParams({ ...filters, paymentStatus: 'paid' }, page, 10) });
      setInvoiceOrders(res.data.orders || []);
      setInvoicePagination(res.data.pagination || emptyPagination);
    } catch (err) { showError(err); } finally { setInvoiceLoading(false); }
  };

  const fetchPosOrders = async () => {
    try {
      const res = await api.get('/orders/my-shop', { params: { orderType: 'dine_in', page: 1, limit: 100 } });
      setPosOrders(res.data.orders || []);
      if (res.data.summary) setOrderSummary(res.data.summary);
    } catch (err) { showError(err); }
  };

  const fetchProducts = async (page = productPage, filters = productFilters) => {
    setProductLoading(true);
    try {
      const res = await api.get('/products/my-shop', { params: toParams(filters, page) });
      setProducts(res.data.products || []);
      setProductCategories(res.data.categories || []);
      setProductPagination(res.data.pagination || emptyPagination);
    } catch (err) { showError(err); } finally { setProductLoading(false); }
  };

  const fetchCustomerChats = async (page = customerPage) => {
    setCustomerChatLoading(true);
    try {
      const res = await api.get('/chat/seller', { params: { type: 'customer_shop', page, limit: 10, search: customerSearch || undefined, unread: customerUnreadOnly || undefined } });
      const list = res.data.conversations || [];
      setCustomerThreads(list);
      setCustomerPagination(res.data.pagination || emptyPagination);
      setUnreadTotals(res.data.unreadTotals || { customer_shop: 0, shop_admin: 0 });
      if (!list.some((item) => item._id === activeCustomerId)) setActiveCustomerId(list[0]?._id || '');
    } catch (err) { showError(err); } finally { setCustomerChatLoading(false); }
  };

  const fetchAdminChat = async () => {
    try {
      const res = await api.get('/chat/seller', { params: { type: 'shop_admin', page: 1, limit: 5 } });
      const list = res.data.conversations || [];
      setAdminThreads(list);
      setUnreadTotals(res.data.unreadTotals || { customer_shop: 0, shop_admin: 0 });
      setActiveAdminId(list[0]?._id || '');
    } catch (err) { showError(err); }
  };

  const refreshUnreadCounts = async () => {
    try {
      const res = await api.get('/chat/seller', { params: { type: 'customer_shop', page: 1, limit: 1 } });
      setUnreadTotals(res.data.unreadTotals || { customer_shop: 0, shop_admin: 0 });
    } catch { }
  };

  const loadTables = async (currentShop) => {
    if (!currentShop || currentShop.businessType !== 'restaurant') return;
    try { const res = await api.get('/tables/my-shop'); setTables(res.data.tables || []); } catch { setTables([]); }
  };

  useEffect(() => {
    Promise.all([loadShop(), fetchOrders(1, orderFilters), fetchInvoiceOrders(1, invoiceFilters), fetchProducts(1, productFilters), fetchCustomerChats(1), fetchAdminChat()])
      .then(([currentShop]) => loadTables(currentShop))
      .catch(showError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchOrders(orderPage, orderFilters), 280);
    return () => window.clearTimeout(timer);
  }, [orderPage, JSON.stringify(orderFilters)]);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchInvoiceOrders(invoicePage, invoiceFilters), 280);
    return () => window.clearTimeout(timer);
  }, [invoicePage, JSON.stringify(invoiceFilters)]);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchProducts(productPage, productFilters), 280);
    return () => window.clearTimeout(timer);
  }, [productPage, JSON.stringify(productFilters)]);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchCustomerChats(customerPage), 280);
    return () => window.clearTimeout(timer);
  }, [customerPage, customerSearch, customerUnreadOnly]);

  useEffect(() => {
    const socket = connectSocket();
    const onNewOrder = ({ order }) => {
      setOrders((current) => upsertFirst(current, order, 12));
      if (order.orderType === 'dine_in') setPosOrders((current) => upsertFirst(current, order, 100));
      setOrderSummary((current) => ({ ...current, totalOrders: Number(current.totalOrders || 0) + 1, pending: Number(current.pending || 0) + 1, unpaid: Number(current.unpaid || 0) + (order.paymentStatus === 'paid' ? 0 : 1), dineIn: Number(current.dineIn || 0) + (order.orderType === 'dine_in' ? 1 : 0) }));
      const notification = { id: `${order._id}-${Date.now()}`, orderId: order._id, orderCode: order.orderCode, title: order.tableNumber ? `Bàn ${order.tableNumber} vừa gọi món` : `${order.customerName || 'Khách hàng'} vừa đặt đơn`, tableNumber: order.tableNumber || null, totalAmount: order.totalAmount || 0, createdAt: new Date().toISOString(), seen: false };
      setOrderNotifications((current) => [notification, ...current].slice(0, 50));
      setToast(`${notification.title} · #${order.orderCode}`);
      if (soundEnabled) playOrderSound();
      showMessageNotification({ title: 'Đơn hàng mới', body: `${notification.title} · ${money(order.totalAmount)}`, tag: `order-${order._id}`, url: `${window.location.origin}/dashboard` });
    };
    const onOrderUpdated = ({ order }) => {
      setOrders((current) => mergeById(current, order));
      setInvoiceOrders((current) => order.paymentStatus === 'paid' ? mergeById(current, order) : current.filter((item) => item._id !== order._id));
      if (order.orderType === 'dine_in') setPosOrders((current) => mergeById(current, order));
    };
    const onCustomerChat = ({ conversation, notification }) => {
      const opened = tab === 'messages' && activeCustomerId === conversation._id;
      const next = opened ? { ...conversation, unreadForSeller: 0 } : conversation;
      setCustomerThreads((current) => upsertFirst(current, next, 10));
      setCustomerPage(1);
      if (!activeCustomerId) setActiveCustomerId(conversation._id);
      if (opened) api.post(`/chat/seller/${conversation._id}/read`).catch(() => {});
      else {
        setToast(notification?.title || `Tin nhắn mới từ ${conversation.customerName || 'khách hàng'}`);
        if (soundEnabled) playMessageSound();
        showMessageNotification({ title: notification?.title || 'Tin nhắn khách hàng', body: notification?.body || conversation.lastMessage, tag: `seller-customer-${conversation._id}`, url: `${window.location.origin}/dashboard` });
      }
      refreshUnreadCounts();
    };
    const onAdminChat = ({ conversation, notification }) => {
      const opened = tab === 'admin-chat' && activeAdminId === conversation._id;
      const next = opened ? { ...conversation, unreadForSeller: 0 } : conversation;
      setAdminThreads((current) => upsertFirst(current, next, 5));
      setActiveAdminId(conversation._id);
      if (opened) api.post(`/chat/seller/${conversation._id}/read`).catch(() => {});
      else {
        setToast(notification?.title || 'Admin tổng vừa trả lời');
        if (soundEnabled) playMessageSound();
        showMessageNotification({ title: notification?.title || 'Admin tổng vừa trả lời', body: notification?.body || conversation.lastMessage, tag: `seller-admin-${conversation._id}`, url: `${window.location.origin}/dashboard` });
      }
      refreshUnreadCounts();
    };
    const onApproval = ({ shop: nextShop, notification }) => {
      setShop(nextShop); setShopForm(nextShop); setToast(notification?.title || 'Trạng thái duyệt đã thay đổi');
      if (soundEnabled) playMessageSound();
    };
    socket.on('order:new', onNewOrder);
    socket.on('order:updated', onOrderUpdated);
    socket.on('chat:customer', onCustomerChat);
    socket.on('chat:seller', onAdminChat);
    socket.on('shop:approval', onApproval);
    return () => {
      socket.off('order:new', onNewOrder); socket.off('order:updated', onOrderUpdated); socket.off('chat:customer', onCustomerChat); socket.off('chat:seller', onAdminChat); socket.off('shop:approval', onApproval);
    };
  }, [soundEnabled, tab, activeCustomerId, activeAdminId]);

  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 5000); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => { localStorage.setItem('seller_order_notifications', JSON.stringify(orderNotifications)); }, [orderNotifications]);

  const enableSound = async () => { playOrderSound(); playMessageSound(); await requestNotificationPermission(); localStorage.setItem('seller_sound', 'on'); setSoundEnabled(true); setToast('Đã bật âm báo và thông báo'); };
  const updateOrderFilter = (field, value) => { setOrderPage(1); setOrderFilters((current) => ({ ...current, [field]: value })); };
  const updateProductFilter = (field, value) => { setProductPage(1); setProductFilters((current) => ({ ...current, [field]: value })); };
  const updateStatus = async (id, status) => { try { const res = await api.put(`/orders/${id}/status`, { status }); setOrders((current) => mergeById(current, res.data.order)); setPosOrders((current) => mergeById(current, res.data.order)); } catch (err) { showError(err); } };
  
  const updatePayment = async (id, paymentStatus) => { 
    try { 
      const res = await api.put(`/orders/${id}/payment`, { paymentStatus }); 
      setOrders((current) => mergeById(current, res.data.order)); 
      setPosOrders((current) => mergeById(current, res.data.order)); 
      setInvoiceOrders((current) => paymentStatus === 'paid' ? upsertFirst(current, res.data.order, 10) : current.filter((item) => item._id !== id)); 
      if (paymentStatus === 'paid') setToast('Đã xác nhận thanh toán'); 
    } catch (err) { showError(err); } 
  };
  
  const updateInvoiceFilter = (field, value) => { setInvoicePage(1); setInvoiceFilters((current) => ({ ...current, [field]: value })); };
  
  const saveInvoiceData = async (payload) => {
    if (!invoiceOrder) return;
    try {
      const res = await api.put(`/orders/${invoiceOrder._id}/invoice`, payload);
      setInvoiceOrder(res.data.order);
      setInvoiceOrders((current) => mergeById(current, res.data.order));
      setOrders((current) => mergeById(current, res.data.order));
      setPosOrders((current) => mergeById(current, res.data.order));
      setToast('Đã lưu dữ liệu hóa đơn');
    } catch (err) { showError(err); throw err; }
  };

  const markCustomerRead = async (thread) => {
    setActiveCustomerId(thread._id);
    if (!thread.unreadForSeller) return;
    setCustomerThreads((current) => current.map((item) => item._id === thread._id ? { ...item, unreadForSeller: 0 } : item));
    try { const res = await api.post(`/chat/seller/${thread._id}/read`); setCustomerThreads((current) => mergeById(current, res.data.conversation)); } catch { }
    refreshUnreadCounts();
  };
  const replyCustomer = async (id) => {
    const text = customerReply.trim(); if (!text) return;
    try { const res = await api.post(`/chat/seller/customer/${id}/reply`, { text }); setCustomerThreads((current) => upsertFirst(current, { ...res.data.conversation, unreadForSeller: 0 }, 10)); setCustomerReply(''); refreshUnreadCounts(); } catch (err) { showError(err); }
  };
  const markAdminRead = async (thread) => {
    setActiveAdminId(thread._id);
    if (!thread.unreadForSeller) return;
    setAdminThreads((current) => current.map((item) => item._id === thread._id ? { ...item, unreadForSeller: 0 } : item));
    try { const res = await api.post(`/chat/seller/${thread._id}/read`); setAdminThreads((current) => mergeById(current, res.data.conversation)); } catch { }
    refreshUnreadCounts();
  };
  const sendAdmin = async () => {
    const text = adminMessage.trim(); if (!text) return;
    try { const res = await api.post('/chat/seller/admin', { text }); setAdminThreads((current) => upsertFirst(current, { ...res.data.conversation, unreadForSeller: 0 }, 5)); setActiveAdminId(res.data.conversation._id); setAdminMessage(''); refreshUnreadCounts(); } catch (err) { showError(err); }
  };

  const submitProduct = async (event) => {
    event.preventDefault();
    try {
      const payload = { ...productForm, price: Number(productForm.price), salePrice: Number(productForm.salePrice || 0), stock: Number(productForm.stock || 0) };
      if (editingProductId) await api.put(`/products/${editingProductId}`, payload); else await api.post('/products', payload);
      setProductForm(emptyProduct); setEditingProductId(null); setTab('products'); setProductPage(1); fetchProducts(1, productFilters); setToast('Đã lưu sản phẩm');
    } catch (err) { showError(err); }
  };
  const editProduct = (product) => { setEditingProductId(product._id); setProductForm({ ...product, images: (product.images || []).join('\n') }); setTab('product-form'); };
  const toggleProduct = async (product) => { try { await api.put(`/products/${product._id}`, { isActive: !product.isActive }); fetchProducts(productPage, productFilters); } catch (err) { showError(err); } };

  const toggleArray = (field, value) => setShopForm((current) => ({ ...current, [field]: current[field]?.includes(value) ? current[field].filter((item) => item !== value) : [...(current[field] || []), value] }));
  const saveShop = async (event) => {
    event.preventDefault();
    try {
      const res = await api.put(`/shops/${shop._id}`, shopForm);
      setShop(res.data.shop); setShopForm(res.data.shop); setPublicUrlDraft(getPublicAppUrl(res.data.shop.publicBaseUrl)); await loadTables(res.data.shop); setToast('Đã lưu cấu hình cửa hàng');
    } catch (err) { showError(err); }
  };
  
  const savePublicBaseUrl = async () => { try { const res = await api.put(`/shops/${shop._id}`, { publicBaseUrl: publicUrlDraft }); setShop(res.data.shop); setShopForm((current) => ({ ...current, publicBaseUrl: res.data.shop.publicBaseUrl })); setToast('Đã cập nhật domain tạo QR'); } catch (err) { showError(err); } };
  const regenerateQr = async (id) => { try { const res = await api.patch(`/tables/${id}/regenerate`); setTables((current) => current.map((item) => item._id === id ? res.data.table : item)); } catch (err) { showError(err); } };
  const toggleTable = async (table) => { try { const res = await api.patch(`/tables/${table._id}/status`, { isActive: !table.isActive }); setTables((current) => current.map((item) => item._id === table._id ? res.data.table : item)); } catch (err) { showError(err); } };
  
  const addDiningTables = async (event) => {
    event?.preventDefault();
    if (!(shop?.businessType === 'restaurant' && shop?.serviceModes?.includes('dine_in'))) {
      setError('Chỉ nhà hàng có phục vụ tại bàn mới được thêm bàn và tạo QR');
      return;
    }
    setAddingTables(true);
    try {
      const count = Math.max(1, Math.min(50, Number(addTableCount || 1)));
      const res = await api.post('/tables/my-shop/add', { count });
      setTables(res.data.tables || []);
      setShop(res.data.shop);
      setShopForm((current) => ({ ...current, numberOfTables: res.data.shop.numberOfTables }));
      setAddTableCount(1);
      setTablePage(Math.max(1, Math.ceil((res.data.tables || []).length / 12)));
      setToast(res.data.message || `Đã thêm ${count} bàn mới`);
    } catch (err) { showError(err); } finally { setAddingTables(false); }
  };

  const openOrderNotification = (item) => { setOrderNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, seen: true } : entry)); setNotificationOpen(false); setTab(item.tableNumber ? 'pos' : 'orders'); };
  const filteredPosOrders = useMemo(() => posOrders.filter((order) => {
    const q = posFilters.search.trim().toLowerCase();
    const statusMatch = posFilters.status === 'all' || (posFilters.status === 'active' ? !['completed', 'cancelled'].includes(order.status) : order.status === posFilters.status);
    return statusMatch && (!posFilters.paymentStatus || order.paymentStatus === posFilters.paymentStatus) && (!q || `${order.orderCode} ${order.tableNumber || ''} ${order.customerName}`.toLowerCase().includes(q));
  }), [posOrders, posFilters]);
  
  const filteredTables = useMemo(() => tables.filter((table) => (tableStatus === 'all' || String(table.isActive) === tableStatus) && (!tableSearch || `${table.name} ${table.tableNumber}`.toLowerCase().includes(tableSearch.toLowerCase()))), [tables, tableSearch, tableStatus]);
  const tableLimit = 12;
  const tableTotalPages = Math.max(1, Math.ceil(filteredTables.length / tableLimit));
  const safeTablePage = Math.min(tablePage, tableTotalPages);
  const pagedTables = filteredTables.slice((safeTablePage - 1) * tableLimit, safeTablePage * tableLimit);
  const tablePagination = { page: safeTablePage, limit: tableLimit, total: filteredTables.length, totalPages: tableTotalPages, hasNext: safeTablePage < tableTotalPages, hasPrev: safeTablePage > 1 };

  const approval = shop?.approvalStatus || 'approved';
  const storeUrl = shop?.customDomain ? `https://${shop.customDomain}` : shop ? `/shop/${shop.slug}` : '#';
  
  const navItems = [
    ['overview', <LayoutDashboard size={20}/>, 'Tổng quan'], 
    ['pos', <MonitorCheck size={20}/>, 'POS / Tính tiền'], 
    ['orders', <ScrollText size={20}/>, 'Đơn hàng'], 
    ['invoices', <Receipt size={20}/>, 'In hóa đơn'], 
    ['loyalty', <Award size={20}/>, 'Ưu đãi & xu'], 
    ['tables', <ScanLine size={20}/>, 'Bàn & QR'], 
    ['products', <PackageSearch size={20}/>, 'Sản phẩm'], 
    ['messages', <MessageCircle size={20}/>, 'Khách hàng'], 
    ['admin-chat', <ShieldQuestion size={20}/>, 'Admin tổng'], 
    ['settings', <Settings size={20}/>, 'Cài đặt']
  ];

if (loading) {
  return (
    <div 
      style={{
        position: 'fixed', /* Ép dính vào màn hình */
        top: 0,
        left: 0,
        width: '100vw', /* Rộng 100% màn hình */
        height: '100vh', /* Cao 100% màn hình */
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        zIndex: 9999, /* Đảm bảo luôn đè lên các phần tử khác */
        margin: 0
      }}
    >
      <style>
        {`
          @keyframes image-pulse {
            0%, 100% { 
              transform: scale(0.95); 
              opacity: 0.8; 
              filter: drop-shadow(0 0 0 rgba(56, 189, 248, 0)); 
            }
            50% { 
              transform: scale(1.05); 
              opacity: 1; 
              filter: drop-shadow(0 0 15px rgba(56, 189, 248, 0.6)); 
            }
          }
          @keyframes text-fade {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
        `}
      </style>

      <img 
        src="/icons/icon-192.png" 
        alt="FoodHub" 
        width={80} 
        height={80}
        style={{
          marginBottom: '20px',
          animation: 'image-pulse 1.5s infinite ease-in-out'
        }}
      />

      <p 
        style={{
          fontSize: '1.1rem',
          color: '#94a3b8',
          margin: 0,
          animation: 'text-fade 1.5s infinite ease-in-out'
        }}
      >
        Đang tải trung tâm vận hành...
      </p>
    </div>
  );
}  if (!shop) return (
    <section className="fh-empty-dashboard">
      <div className="fh-empty-box">
        <img src="/icons/icon-192.png" alt="Chưa có cửa hàng" width={200} height={200}/>
        <h1>Bạn chưa có cửa hàng</h1>
        <p>Vui lòng hoàn tất thiết lập ban đầu để bắt đầu quản lý sản phẩm, đơn hàng và hệ thống mã QR.</p>
        <Link className="fh-btn-gold" to="/create-shop">Tạo cửa hàng ngay <ChevronRight size={18}/></Link>
      </div>
    </section>
  );

  return (
    <section className="fh-dashboard">
      {/* KHỐI CSS NỘI BỘ - THIẾT KẾ LUXURY VÀ RESPONSIVE */}
      <style>{`
        :root {
          --fh-bg: #f8fafc;
          --fh-surface: #ffffff;
          --fh-sidebar: #0f172a;
          --fh-text-main: #334155;
          --fh-text-light: #64748b;
          --fh-border: #e2e8f0;
          --fh-gold: #f59e0b;
          --fh-gold-hover: #d97706;
          --fh-red: #ef4444;
          --fh-green: #10b981;
        }

        .fh-dashboard {
          display: flex;
          height: 100vh;
          background-color: var(--fh-bg);
          font-family: system-ui, -apple-system, sans-serif;
          overflow: hidden;
        }

        /* --- UI COMPONENTS --- */
        .fh-btn-gold {
          background: var(--fh-gold); color: #fff; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px;
          border: none; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; justify-content: center;
        }
        .fh-btn-gold:hover:not(:disabled) { background: var(--fh-gold-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2); }
        .fh-btn-gold:disabled { opacity: 0.7; cursor: not-allowed; }
        
        .fh-btn-outline {
          background: #fff; color: var(--fh-text-main); padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px;
          border: 1px solid var(--fh-border); cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none;
        }
        .fh-btn-outline:hover { border-color: var(--fh-text-light); background: #f1f5f9; }

        .fh-btn-mini { background: #f1f5f9; border: 1px solid var(--fh-border); color: var(--fh-text-main); padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px;}
        .fh-btn-mini:hover { background: #e2e8f0; color: var(--fh-dark); }

        /* --- TOAST --- */
        .fh-toast {
          position: fixed; top: 24px; left: 50%; transform: translateX(-50%); z-index: 9999;
          background: #0f172a; color: #fff; padding: 12px 24px; border-radius: 999px;
          font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2); animation: slideDown 0.3s ease;
        }
        @keyframes slideDown { from { top: -50px; opacity: 0; } to { top: 24px; opacity: 1; } }

        /* --- SIDEBAR --- */
        .fh-sidebar {
          width: 260px; background: var(--fh-sidebar); color: #94a3b8; display: flex; flex-direction: column;
          flex-shrink: 0; transition: transform 0.3s ease; z-index: 1000;
        }
        .fh-brand { padding: 24px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .fh-brand-icon {
          width: 40px; height: 40px; background: rgba(255,255,255,0.1); color: var(--fh-gold);
          border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px;
        }
        .fh-brand-info b { color: #fff; font-size: 16px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
        .fh-brand-info small { font-size: 12px; color: #64748b; }

        .fh-nav { flex: 1; overflow-y: auto; padding: 24px 16px; display: flex; flex-direction: column; gap: 8px; }
        .fh-nav button {
          display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border-radius: 12px;
          background: transparent; border: none; color: #94a3b8; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s; text-align: left;
        }
        .fh-nav button:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .fh-nav button.active { color: #fff; background: var(--fh-gold); font-weight: 600; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2); }
        .fh-nav button i { margin-left: auto; background: #ef4444; color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 999px; font-style: normal; font-weight: 700; }

        .fh-sidebar-footer { padding: 20px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 12px; }
        .fh-avatar { width: 36px; height: 36px; background: #334155; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
        .fh-user-info { flex: 1; overflow: hidden; }
        .fh-user-info b { color: #fff; font-size: 14px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fh-user-info small { font-size: 12px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fh-logout-btn { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 8px; border-radius: 8px; transition: all 0.2s; }
        .fh-logout-btn:hover { color: var(--fh-red); background: rgba(239,68,68,0.1); }

        .fh-sidebar-backdrop { display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 999; }

        /* --- MAIN CONTENT --- */
        .fh-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative;}
        
        .fh-header {
          background: #fff; padding: 20px 32px; border-bottom: 1px solid var(--fh-border);
          display: flex; justify-content: space-between; align-items: center; z-index: 10;
        }
        
        .fh-mobile-menu-btn { display: none; background: none; border: none; color: var(--fh-sidebar); padding: 8px; margin-right: 12px; cursor: pointer; }

        .fh-header-title { display: flex; align-items: center; }
        .fh-header-title h1 { font-size: 24px; font-weight: 700; color: var(--fh-sidebar); margin: 0 0 4px 0; }
        .fh-header-title p { font-size: 14px; color: var(--fh-text-light); margin: 0; }
        .fh-header-actions { display: flex; align-items: center; gap: 12px; }

        .fh-content-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 32px; }
        .fh-container-inner { max-width: 1200px; min-height: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; box-sizing: border-box; }

        /* Khi mở tab chat: khóa cuộn bên ngoài và dùng đúng phần chiều cao còn lại */
        .fh-content-scroll.fh-chat-mode { overflow: hidden; }
        .fh-content-scroll.fh-chat-mode .fh-container-inner { height: 100%; min-height: 0; }

        /* --- ALERTS --- */
        .fh-alert { padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 12px; font-size: 14px; margin-bottom: 24px; }
        .fh-alert.error { background: #fef2f2; border: 1px solid #fee2e2; color: #b91c1c; }
        .fh-alert.warning { background: #fffbeb; border: 1px solid #fef3c7; color: #b45309; }
        .fh-alert.info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; margin-bottom: 16px;}
        .fh-alert.warning button { background: #d97706; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-left: auto; }

        /* --- METRICS GRID --- */
        .fh-metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        .fh-metric-card { background: #fff; padding: 24px; border-radius: 16px; border: 1px solid var(--fh-border); box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .fh-metric-card span { display: block; font-size: 14px; color: var(--fh-text-light); font-weight: 500; margin-bottom: 8px; }
        .fh-metric-card b { display: block; font-size: 28px; color: var(--fh-sidebar); font-weight: 800; line-height: 1; margin-bottom: 8px; }
        .fh-metric-card small { font-size: 13px; color: #94a3b8; }

        /* --- DASHBOARD TWO COL --- */
        .fh-two-col { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
        .fh-card { background: #fff; border-radius: 16px; border: 1px solid var(--fh-border); overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .fh-card-header { padding: 20px 24px; border-bottom: 1px solid var(--fh-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;}
        .fh-card-header h2 { font-size: 18px; font-weight: 700; color: var(--fh-sidebar); margin: 0; }
        .fh-card-header button { background: none; border: none; color: var(--fh-gold); font-weight: 600; font-size: 14px; cursor: pointer; }

        /* --- KHUNG CHAT: luôn giữ phần nhập tin nhắn trong màn hình --- */
        .fh-chat-page {
          flex: 1; min-height: 0; height: 100%;
          display: flex; flex-direction: column;
        }
        .fh-chat-page-header {
          flex: 0 0 auto; display: flex; justify-content: space-between;
          align-items: center; gap: 16px; margin-bottom: 16px;
        }
        .fh-chat-wrapper {
          flex: 1; min-height: 0; width: 100%;
          background: #fff; border-radius: 16px; border: 1px solid var(--fh-border);
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
          overflow: hidden; display: flex; box-sizing: border-box;
        }
        .fh-chat-wrapper > * {
          width: 100% !important; height: 100% !important;
          min-width: 0 !important; min-height: 0 !important;
        }

        /* --- QUICK LISTS --- */
        .fh-list-item {
          display: flex; align-items: center; gap: 16px; padding: 16px 24px; border-bottom: 1px solid var(--fh-border);
          background: transparent; border-left: none; border-right: none; border-top: none; width: 100%; text-align: left; cursor: pointer; transition: background 0.2s;
        }
        .fh-list-item:hover { background: #f8fafc; }
        .fh-list-item:last-child { border-bottom: none; }
        .fh-item-icon { width: 40px; height: 40px; background: #f1f5f9; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--fh-text-main); font-weight: 700; font-size: 13px; flex-shrink: 0;}
        .fh-item-icon.dine_in { background: #fff7ed; color: #d97706; }
        .fh-item-info { flex: 1; min-width: 0;}
        .fh-item-info b { display: block; font-size: 15px; color: var(--fh-sidebar); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
        .fh-item-info small { display: block; font-size: 13px; color: var(--fh-text-light); }
        .fh-item-value { text-align: right; flex-shrink: 0;}
        .fh-item-value strong { display: block; font-size: 15px; color: var(--fh-sidebar); margin-bottom: 4px; }

        /* --- STATUS BADGES --- */
        .fh-badge { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; display: inline-block;}
        .fh-badge.paid, .fh-badge.completed, .fh-badge.external_issued { background: #dcfce7; color: #166534; }
        .fh-badge.unpaid, .fh-badge.cancelled { background: #fee2e2; color: #991b1b; }
        .fh-badge.pending, .fh-badge.draft { background: #fef3c7; color: #92400e; }
        .fh-badge.neutral, .fh-badge.not_issued { background: #f1f5f9; color: #475569; }

        /* --- FILTER PANEL --- */
        .fh-filter-panel { display: flex; flex-wrap: wrap; gap: 12px; background: #fff; padding: 16px; border-radius: 12px; border: 1px solid var(--fh-border); margin-bottom: 24px; }
        .fh-search-box { position: relative; flex: 1; min-width: 250px; }
        .fh-search-box svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .fh-search-box input { width: 100%; padding: 10px 16px 10px 40px; border: 1px solid var(--fh-border); border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box; }
        .fh-search-box input:focus { border-color: var(--fh-gold); box-shadow: 0 0 0 3px rgba(245,158,11,0.1); }
        .fh-filter-panel select, .fh-filter-panel input[type="date"] { padding: 10px 16px; border: 1px solid var(--fh-border); border-radius: 8px; font-size: 14px; outline: none; background: #fff; cursor: pointer; }

        /* --- TABLES & GRIDS --- */
        .fh-data-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
        
        .fh-ticket { background: #fff; border: 1px solid var(--fh-border); border-radius: 16px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; }
        .fh-ticket.is-paid { border-top: 4px solid var(--fh-green); }
        .fh-ticket header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px dashed var(--fh-border); padding-bottom: 12px; }
        .fh-ticket header span { font-weight: 800; font-size: 18px; color: var(--fh-sidebar); }
        .fh-ticket header time { font-size: 13px; color: var(--fh-text-light); }
        .fh-ticket-code { font-size: 13px; font-family: monospace; color: #94a3b8; margin-bottom: 16px; }
        .fh-ticket-items { flex: 1; display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .fh-ticket-items p { display: flex; justify-content: space-between; font-size: 14px; margin: 0; color: var(--fh-text-main); }
        .fh-ticket-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; color: var(--fh-sidebar); border-top: 1px dashed var(--fh-border); padding-top: 16px; margin-bottom: 20px; }
        .fh-ticket-actions { display: flex; gap: 12px; align-items: center; }
        .fh-ticket-actions select { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--fh-border); font-size: 14px; font-weight: 600; width: 100%;}
        
        .fh-stamp-paid { color: var(--fh-green); font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 6px; }
        .fh-stamp-paid small { display: block; font-weight: 500; font-size: 11px; color: #64748b; margin-top: 2px;}

        /* --- SETTINGS FORM --- */
        .fh-form-section { background: #fff; padding: 32px; border-radius: 16px; border: 1px solid var(--fh-border); margin-bottom: 24px; }
        .fh-form-section h3 { font-size: 18px; font-weight: 700; margin: 0 0 8px 0; color: var(--fh-sidebar); }
        .fh-form-section > p { font-size: 14px; color: var(--fh-text-light); margin: 0 0 24px 0; border-bottom: 1px solid var(--fh-border); padding-bottom: 16px;}
        
        .fh-input-group { margin-bottom: 20px; width: 100%;}
        .fh-input-group label { display: block; font-size: 14px; font-weight: 600; color: var(--fh-text-main); margin-bottom: 8px; }
        .fh-input-group input, .fh-input-group textarea, .fh-input-group select { width: 100%; padding: 12px 16px; border: 1px solid var(--fh-border); border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box; transition: all 0.2s; background: #fff;}
        .fh-input-group input:focus, .fh-input-group textarea:focus, .fh-input-group select:focus { border-color: var(--fh-gold); box-shadow: 0 0 0 3px rgba(245,158,11,0.1); }
        .fh-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .fh-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
        
        /* Chip Options */
        .fh-chips { display: flex; flex-wrap: wrap; gap: 12px; }
        .fh-chip { background: #f1f5f9; border: 1px solid transparent; padding: 8px 16px; border-radius: 999px; font-size: 14px; font-weight: 500; color: var(--fh-text-main); cursor: pointer; transition: all 0.2s; }
        .fh-chip.active { background: #fffbeb; border-color: #fcd34d; color: #b45309; }

        /* Empty State */
        .fh-empty { text-align: center; padding: 64px 20px; background: #fff; border-radius: 16px; border: 1px dashed #cbd5e1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .fh-empty svg { color: #cbd5e1; margin-bottom: 16px; }
        .fh-empty h3 { font-size: 18px; font-weight: 600; color: var(--fh-sidebar); margin: 0 0 8px 0; }
        .fh-empty p { font-size: 14px; color: var(--fh-text-light); margin: 0; }

        /* =========================================
           🚀 RESPONSIVE CHO TABLET & MOBILE
           ========================================= */

        /* Tablet (max-width: 1024px) */
        @media (max-width: 1024px) {
          .fh-metric-grid { grid-template-columns: repeat(2, 1fr); }
          .fh-two-col { grid-template-columns: 1fr; }
          .fh-grid-3 { grid-template-columns: 1fr 1fr; }
        }

        /* Mobile (max-width: 768px) */
        @media (max-width: 768px) {
          .fh-sidebar {
            position: fixed; top: 0; bottom: 0; left: 0;
            transform: translateX(-100%);
            z-index: 1000; box-shadow: 20px 0 25px -5px rgba(0,0,0,0.2);
          }
          .fh-sidebar.open { transform: translateX(0); }
          .fh-sidebar-backdrop { display: block; }
          
          .fh-mobile-menu-btn { display: block; }
          .fh-header { padding: 16px; }
          .fh-header-title p { display: none; }
          .fh-header-title h1 { font-size: 20px; margin: 0;}
          
          .fh-header-actions .fh-btn-outline span { display: none; }
          .fh-header-actions .fh-btn-outline { padding: 8px; }
          .fh-header-actions .fh-badge { padding: 6px; }
          
          .fh-content-scroll { padding: 16px; }
          .fh-container-inner { gap: 16px; }
          
          .fh-metric-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
          .fh-metric-card { padding: 16px; }
          .fh-metric-card b { font-size: 20px; }

          .fh-grid-2, .fh-grid-3 { grid-template-columns: 1fr; gap: 16px; }
          
          .fh-filter-panel { flex-direction: column; gap: 12px; }
          .fh-search-box { width: 100%; }
          .fh-filter-panel select, .fh-filter-panel input, .fh-filter-panel button { width: 100%; }

          .fh-data-grid { grid-template-columns: 1fr; gap: 16px; }
          
          .fh-order-card { flex-direction: column; align-items: flex-start !important; gap: 16px; padding: 16px !important; }
          .fh-order-card > div { width: 100%; }
          .fh-order-selects { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

          .fh-chat-page-header { align-items: flex-start; gap: 12px; }
          .fh-chat-wrapper { flex: 1; min-height: 0; height: auto; }

          .fh-form-section { padding: 20px; }
          .fh-form-section h3 { font-size: 16px; margin-bottom: 8px; }
        }
      `}</style>

      {toast && <div className="fh-toast"><CheckCircle2 size={18}/> {toast}</div>}

      {/* --- BACKDROP CHO MOBILE --- */}
      {sidebarOpen && <div className="fh-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* --- SIDEBAR --- */}
      <aside className={`fh-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="fh-brand">
          <img src="/icons/icon-192.png" alt="FoodHub" width={80} height={80}/>
          <div className="fh-brand-info">
            <b>{shop.name}</b>
            <small>{shop.businessType === 'restaurant' ? 'Restaurant Console' : 'Commerce Console'}</small>
          </div>
        </div>
        
        <nav className="fh-nav">
          {navItems.map(([value, icon, label]) => {
            if (value === 'tables' && !shop.serviceModes?.includes('dine_in')) return null;
            const badge = value === 'messages' ? unreadTotals.customer_shop : value === 'admin-chat' ? unreadTotals.shop_admin : 0;
            return (
              <button 
                key={value} 
                className={tab === value ? 'active' : ''} 
                onClick={() => { 
                  setTab(value); 
                  setSidebarOpen(false); 
                  if (value === 'pos') fetchPosOrders(); 
                }}
              >
                {icon}
                <span>{label}</span>
                {badge > 0 && <i>{badge > 99 ? '99+' : badge}</i>}
              </button>
            );
          })}
        </nav>

        <div className="fh-sidebar-footer">
          <div className="fh-avatar">{(user?.name || 'S')[0]}</div>
          <div className="fh-user-info">
            <b>{user?.name}</b>
            <small>{user?.email}</small>
          </div>
          <button className="fh-logout-btn" onClick={() => { logout(); navigate('/'); }} title="Đăng xuất">
            <LogOut size={18}/>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="fh-main">
        <header className="fh-header">
          <div className="fh-header-title">
            <button className="fh-mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <div>
              <h1>{navItems.find((item) => item[0] === tab)?.[2] || 'Quản trị'}</h1>
              <p>FoodHub Atelier · Quản lý tập trung, cập nhật thời gian thực.</p>
            </div>
          </div>
          <div className="fh-header-actions">
            <OrderNotificationBell notifications={orderNotifications} open={notificationOpen} onToggle={() => setNotificationOpen((value) => !value)} onMarkAllRead={() => setOrderNotifications((current) => current.map((item) => ({ ...item, seen: true })))} onOpenOrder={openOrderNotification} />
            <ChatNotificationButton unread={unreadTotals.customer_shop + unreadTotals.shop_admin} onClick={() => setTab(unreadTotals.customer_shop ? 'messages' : 'admin-chat')} label="Tin nhắn" />
            
            {!soundEnabled ? (
              <button className="fh-btn-outline" onClick={enableSound} title="Bật âm báo">
                <VolumeX size={16}/> <span>Bật âm</span>
              </button>
            ) : (
              <span className="fh-badge paid" style={{display:'flex', alignItems:'center', gap:'6px', padding:'8px 12px'}} title="Đã bật âm thanh"><Volume2 size={16}/> <span>Đã bật</span></span>
            )}
            
            <a className="fh-btn-outline" href={storeUrl} target={shop.customDomain ? '_blank' : undefined} rel="noreferrer" style={{background: '#0f172a', color: '#fff', borderColor: '#0f172a'}} title="Xem cửa hàng">
               <span>Xem Shop</span> <ExternalLink size={16}/>
            </a>
          </div>
        </header>

        <div className={`fh-content-scroll ${tab === 'messages' || tab === 'admin-chat' ? 'fh-chat-mode' : ''}`}>
          <div className="fh-container-inner">
            
            {error && (
              <div className="fh-alert error">
                <XCircle size={20}/>
                <span style={{flex:1}}>{error}</span>
                <button onClick={() => setError('')} style={{background:'none', border:'none', color:'inherit', cursor:'pointer'}}><XCircle size={16}/></button>
              </div>
            )}
            
            {approval !== 'approved' && (
              <div className={`fh-alert warning`}>
                <AlertCircle size={20}/>
                <div style={{flex:1}}>
                  <strong style={{display:'block', marginBottom:'4px'}}>{approval === 'pending' ? 'Cửa hàng đang chờ admin tổng duyệt' : 'Cửa hàng chưa được duyệt'}</strong>
                  <span>{shop.approvalNote || (approval === 'pending' ? 'Bạn vẫn có thể chuẩn bị sản phẩm, hình ảnh và QR. Khách chỉ truy cập được sau khi admin duyệt.' : 'Hãy chỉnh sửa thông tin theo góp ý rồi nhắn admin tổng để được kiểm tra lại.')}</span>
                </div>
                <button className="fh-btn-gold" style={{marginLeft: 'auto'}} onClick={() => setTab('admin-chat')}>Nhắn admin</button>
              </div>
            )}

            {/* TAB: OVERVIEW */}
            {tab === 'overview' && (
              <>
                <div className="fh-metric-grid">
                  <div className="fh-metric-card"><span>Doanh thu đã thu</span><b>{money(orderSummary.revenue)}</b><small>Từ đơn đã thanh toán</small></div>
                  <div className="fh-metric-card"><span>Đơn đang xử lý</span><b>{orderSummary.pending || 0}</b><small>Cần theo dõi</small></div>
                  <div className="fh-metric-card"><span>Chưa thanh toán</span><b>{orderSummary.unpaid || 0}</b><small>Đơn chưa thu tiền</small></div>
                  <div className="fh-metric-card"><span>Tin chưa đọc</span><b>{unreadTotals.customer_shop + unreadTotals.shop_admin}</b><small>Khách hàng & admin</small></div>
                </div>

                <div className="fh-two-col">
                  <section className="fh-card">
                    <div className="fh-card-header">
                      <h2>Đơn hàng gần đây</h2>
                      <button onClick={() => setTab('orders')}>Xem tất cả</button>
                    </div>
                    <div>
                      {orders.slice(0, 7).map((order) => (
                        <button key={order._id} className="fh-list-item" onClick={() => setTab(order.orderType === 'dine_in' ? 'pos' : 'orders')}>
                          <div className={`fh-item-icon ${order.orderType}`}>{order.tableNumber ? `B${order.tableNumber}` : <ScrollText size={18}/>}</div>
                          <div className="fh-item-info">
                            <b>#{order.orderCode}</b>
                            <small>{order.tableNumber ? `Bàn ${order.tableNumber}` : order.customerName} · {statusLabels[order.status]}</small>
                          </div>
                          <div className="fh-item-value">
                            <strong>{money(order.totalAmount)}</strong>
                            <span className={`fh-badge ${order.paymentStatus === 'paid' ? 'paid' : 'unpaid'}`}>{paymentLabels[order.paymentStatus]}</span>
                          </div>
                        </button>
                      ))}
                      {!orders.length && <div className="fh-empty" style={{border:'none'}}><ScrollText size={32}/> <p>Chưa có đơn hàng nào.</p></div>}
                    </div>
                  </section>

                  <section className="fh-card">
                    <div className="fh-card-header">
                      <h2>Tác vụ nhanh</h2>
                    </div>
                    <div>
                      <button className="fh-list-item" onClick={() => setTab('product-form')}>
                        <div className="fh-item-icon"><Plus size={18}/></div>
                        <div className="fh-item-info"><b>Thêm sản phẩm</b><small>Cập nhật menu ngay</small></div>
                      </button>
                      {shop.serviceModes?.includes('dine_in') && (
                        <button className="fh-list-item" onClick={() => setTab('tables')}>
                          <div className="fh-item-icon"><ScanLine size={18}/></div>
                          <div className="fh-item-info"><b>Mã QR tại bàn</b><small>{tables.length} bàn đã tạo</small></div>
                        </button>
                      )}
                      <button className="fh-list-item" onClick={() => setTab('messages')}>
                        <div className="fh-item-icon"><MessageCircle size={18}/></div>
                        <div className="fh-item-info"><b>Trả lời khách hàng</b><small>{unreadTotals.customer_shop} tin chưa đọc</small></div>
                      </button>
                      <button className="fh-list-item" onClick={() => setTab('settings')}>
                        <div className="fh-item-icon"><Settings size={18}/></div>
                        <div className="fh-item-info"><b>Cấu hình cửa hàng</b><small>{shop.customDomain || 'Dùng domain hệ thống'}</small></div>
                      </button>
                    </div>
                  </section>
                </div>
              </>
            )}

            {/* TAB: POS */}
            {tab === 'pos' && (
              <>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}>
                  <div>
                    <h2 style={{fontSize:'20px', fontWeight:700, margin:'0 0 4px 0', color:'#0f172a'}}>Màn hình tính tiền tại bàn</h2>
                    <p style={{color:'#64748b', margin:0, fontSize:'14px'}}>Đơn gọi món từ QR sẽ tự động xuất hiện tại đây.</p>
                  </div>
                  <button className="fh-btn-outline" onClick={fetchPosOrders}><RefreshCcw size={16}/> <span>Làm mới</span></button>
                </div>
                
                <div className="fh-filter-panel">
                  <div className="fh-search-box">
                    <Search size={16} />
                    <input value={posFilters.search} onChange={(e) => setPosFilters({ ...posFilters, search: e.target.value })} placeholder="Tìm mã đơn, số bàn..." />
                  </div>
                  <select value={posFilters.status} onChange={(e) => setPosFilters({ ...posFilters, status: e.target.value })}>
                    <option value="active">Đang phục vụ</option>
                    <option value="all">Tất cả trạng thái</option>
                    {Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <select value={posFilters.paymentStatus} onChange={(e) => setPosFilters({ ...posFilters, paymentStatus: e.target.value })}>
                    <option value="">Mọi thanh toán</option>
                    {Object.entries(paymentLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>

                <div className="fh-data-grid">
                  {filteredPosOrders.map((order) => (
                    <article className={`fh-ticket ${order.paymentStatus === 'paid' ? 'is-paid' : ''}`} key={order._id}>
                      <header>
                        <span>BÀN {order.tableNumber || '—'}</span>
                        <time>{new Date(order.createdAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</time>
                      </header>
                      <div className="fh-ticket-code">#{order.orderCode}</div>
                      <div className="fh-ticket-items">
                        {order.products.map((item) => (
                          <p key={`${order._id}-${item.productId}`}><span>{item.quantity}× {item.name}</span><b>{money(item.price * item.quantity)}</b></p>
                        ))}
                      </div>
                      <div className="fh-ticket-total">
                        <span>Tổng cộng</span>
                        <b>{money(order.totalAmount)}</b>
                      </div>
                      <div className="fh-ticket-actions">
                        <select value={order.status} onChange={(e) => updateStatus(order._id,e.target.value)}>
                          {Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        {order.paymentStatus === 'paid' ? (
                          <div style={{display:'flex', gap:'8px', width:'100%', alignItems:'center'}}>
                            <div className="fh-stamp-paid" style={{flex:1}}>
                              <CheckCircle2 size={16}/> ĐÃ THU 
                              <small>{order.paidAt ? formatDateTime(order.paidAt) : ''}</small>
                            </div>
                            <button className="fh-btn-mini" onClick={() => setInvoiceOrder(order)} title="In hóa đơn"><Printer size={16}/></button>
                          </div>
                        ) : (
                          <button className="fh-btn-gold" style={{flex:1}} onClick={() => updatePayment(order._id,'paid')}>Xác nhận thu</button>
                        )}
                      </div>
                    </article>
                  ))}
                  {!filteredPosOrders.length && <div className="fh-empty" style={{gridColumn: '1 / -1'}}><MonitorCheck size={40}/><h3>Chưa có đơn tại bàn</h3><p>Hoặc không có đơn nào khớp với bộ lọc của bạn.</p></div>}
                </div>
              </>
            )}

            {/* TAB: ORDERS */}
            {tab === 'orders' && (
              <>
                <div style={{marginBottom:'16px'}}>
                  <h2 style={{fontSize:'20px', fontWeight:700, margin:'0 0 4px 0', color:'#0f172a'}}>Quản lý đơn hàng tổng</h2>
                  <p style={{color:'#64748b', margin:0, fontSize:'14px'}}>Đang hiển thị {orderPagination.total} đơn hàng.</p>
                </div>
                <div className="fh-filter-panel">
                  <div className="fh-search-box">
                    <Search size={16} />
                    <input value={orderFilters.search} onChange={(e) => updateOrderFilter('search',e.target.value)} placeholder="Tên khách, SĐT, mã đơn..." />
                  </div>
                  <select value={orderFilters.status} onChange={(e) => updateOrderFilter('status',e.target.value)}>
                    <option value="">Mọi trạng thái</option>
                    {Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <select value={orderFilters.paymentStatus} onChange={(e) => updateOrderFilter('paymentStatus',e.target.value)}>
                    <option value="">Mọi thanh toán</option>
                    {Object.entries(paymentLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <select value={orderFilters.orderType} onChange={(e) => updateOrderFilter('orderType',e.target.value)}>
                    <option value="">Loại đơn</option>
                    {Object.entries(orderTypeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input type="date" value={orderFilters.dateFrom} onChange={(e) => updateOrderFilter('dateFrom',e.target.value)} title="Từ ngày" />
                  <input type="date" value={orderFilters.dateTo} onChange={(e) => updateOrderFilter('dateTo',e.target.value)} title="Đến ngày" />
                  <button className="fh-btn-outline" onClick={() => { setOrderFilters({ search:'',status:'',paymentStatus:'',orderType:'',paymentMethod:'',dateFrom:'',dateTo:'' }); setOrderPage(1); }}>Xóa lọc</button>
                </div>

                <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
                  {orderLoading && <p style={{textAlign:'center', color:'#64748b', padding:'20px'}}>Đang tải dữ liệu...</p>}
                  {!orderLoading && orders.map((order) => (
                    <article key={order._id} className="fh-card fh-order-card" style={{display:'flex', alignItems:'center', padding:'20px 24px', gap:'24px'}}>
                      <div className="fh-item-icon" style={{width:'48px', height:'48px', fontSize:'16px'}}>
                        {order.tableNumber ? `B${order.tableNumber}` : <ScrollText size={20}/>}
                      </div>
                      <div style={{flex:2}}>
                        <div style={{fontSize:'13px', color:'#94a3b8', fontFamily:'monospace', marginBottom:'4px'}}>#{order.orderCode}</div>
                        <h3 style={{margin:'0 0 4px 0', fontSize:'16px', color:'#0f172a'}}>{order.tableNumber ? `Bàn ${order.tableNumber}` : order.customerName}</h3>
                        <p style={{margin:0, fontSize:'13px', color:'#64748b'}}>{orderTypeLabels[order.orderType]} · {order.phone || 'Không SĐT'} · {new Date(order.createdAt).toLocaleString('vi-VN')}</p>
                      </div>
                      <div style={{flex:3}}>
                        <b style={{fontSize:'16px', color:'#0f172a', display:'block', marginBottom:'4px'}}>{money(order.totalAmount)}</b>
                        <p style={{margin:0, fontSize:'13px', color:'#64748b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{order.products.map((item) => `${item.name} ×${item.quantity}`).join(', ')}</p>
                      </div>
                      <div className="fh-order-selects" style={{flex:1, display:'flex', flexDirection:'column', gap:'8px'}}>
                        <select style={{padding:'6px 10px', borderRadius:'6px', border:'1px solid #e2e8f0', fontSize:'13px'}} value={order.status} onChange={(e) => updateStatus(order._id,e.target.value)}>
                          {Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        <select style={{padding:'6px 10px', borderRadius:'6px', border:'1px solid #e2e8f0', fontSize:'13px', backgroundColor: order.paymentStatus==='paid'?'#dcfce7':'#fee2e2'}} value={order.paymentStatus} onChange={(e) => updatePayment(order._id,e.target.value)}>
                          {Object.entries(paymentLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        {order.paymentStatus === 'paid' && (
                          <button className="fh-btn-mini" style={{justifyContent:'center'}} onClick={() => setInvoiceOrder(order)}><Printer size={14}/> In hóa đơn</button>
                        )}
                      </div>
                    </article>
                  ))}
                  {!orderLoading && !orders.length && <div className="fh-empty"><ScrollText size={40}/><h3>Không tìm thấy đơn hàng</h3></div>}
                </div>
                <div style={{marginTop:'24px'}}><Pagination pagination={orderPagination} onPageChange={setOrderPage} /></div>
              </>
            )}

            {/* TAB: INVOICES (IN HÓA ĐƠN) */}
            {tab === 'invoices' && (
              <section>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'12px'}}>
                  <div>
                    <h2 style={{fontSize:'20px', fontWeight:700, margin:'0 0 4px 0', color:'#0f172a'}}>In hóa đơn & Phiếu bán hàng</h2>
                    <p style={{color:'#64748b', margin:0, fontSize:'14px'}}>Chỉ hiển thị các đơn hàng đã thanh toán thành công.</p>
                  </div>
                  <button className="fh-btn-outline" onClick={() => setTab('settings')}><Settings size={16}/> Cấu hình Thuế</button>
                </div>

                <div className="fh-alert info">
                  <Info size={20}/>
                  <div style={{flex:1}}>
                    <strong style={{display:'block', marginBottom:'4px'}}>Lưu ý về Hóa đơn điện tử</strong>
                    <span>Hệ thống tạo mẫu in đẹp và lưu dữ liệu. Để phát hành HĐĐT hợp lệ, bạn vẫn cần thao tác qua nhà cung cấp phần mềm HĐĐT (MISA, VNPT...) hoặc cơ quan thuế.</span>
                  </div>
                </div>

                <div className="fh-filter-panel">
                  <div className="fh-search-box">
                    <Search size={16} />
                    <input value={invoiceFilters.search} onChange={(e) => updateInvoiceFilter('search', e.target.value)} placeholder="Mã đơn, tên khách, SĐT..." />
                  </div>
                  <select value={invoiceFilters.invoiceStatus} onChange={(e) => updateInvoiceFilter('invoiceStatus', e.target.value)}>
                    <option value="">Trạng thái hóa đơn</option>
                    {Object.entries(invoiceStatusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input type="date" value={invoiceFilters.dateFrom} onChange={(e) => updateInvoiceFilter('dateFrom', e.target.value)} title="Từ ngày" />
                  <input type="date" value={invoiceFilters.dateTo} onChange={(e) => updateInvoiceFilter('dateTo', e.target.value)} title="Đến ngày" />
                  <button className="fh-btn-outline" onClick={() => { setInvoiceFilters({ search:'', invoiceStatus:'', dateFrom:'', dateTo:'' }); setInvoicePage(1); }}>Xóa lọc</button>
                </div>

                <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
                  {invoiceLoading && <p style={{textAlign:'center', color:'#64748b', padding:'20px'}}>Đang tải dữ liệu hóa đơn...</p>}
                  {!invoiceLoading && invoiceOrders.map((order) => (
                    <article key={order._id} className="fh-card" style={{display:'flex', alignItems:'center', padding:'20px 24px', gap:'24px', flexWrap:'wrap'}}>
                      <div className="fh-item-icon" style={{width:'48px', height:'48px', fontSize:'16px', background:'#eff6ff', color:'#2563eb'}}>
                        <Receipt size={20}/>
                      </div>
                      <div style={{flex:2, minWidth:'200px'}}>
                        <div style={{fontSize:'13px', color:'#94a3b8', fontFamily:'monospace', marginBottom:'4px'}}>ĐƠN #{order.orderCode}</div>
                        <h3 style={{margin:'0 0 4px 0', fontSize:'16px', color:'#0f172a'}}>{order.buyerCompanyName || order.buyerName || order.customerName || 'Khách lẻ'}</h3>
                        <p style={{margin:0, fontSize:'13px', color:'#64748b'}}>{order.tableNumber ? `Bàn ${order.tableNumber}` : (order.phone || 'Mua tại quầy')} · Đã thu {formatDateTime(order.paidAt)}</p>
                      </div>
                      <div style={{flex:2, minWidth:'200px'}}>
                        <b style={{fontSize:'16px', color:'#0f172a', display:'block', marginBottom:'4px'}}>{money(order.totalAmount)}</b>
                        <span className={`fh-badge ${order.invoiceStatus || 'not_issued'}`}>{invoiceStatusLabels[order.invoiceStatus || 'not_issued']}</span>
                      </div>
                      <button className="fh-btn-gold" style={{flexShrink:0}} onClick={() => setInvoiceOrder(order)}>
                        <Printer size={16}/> Mở hóa đơn
                      </button>
                    </article>
                  ))}
                  {!invoiceLoading && !invoiceOrders.length && <div className="fh-empty"><Receipt size={40}/><h3>Chưa có đơn đã thanh toán</h3><p>Hóa đơn chỉ có thể lập sau khi đơn hàng xác nhận đã thu tiền.</p></div>}
                </div>
                <div style={{marginTop:'24px'}}><Pagination pagination={invoicePagination} onPageChange={setInvoicePage} /></div>
              </section>
            )}

            {/* TAB: TABLES */}
            {tab === 'tables' && shop.businessType === 'restaurant' && shop.serviceModes?.includes('dine_in') && (
              <>
                 <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}>
                  <div>
                    <h2 style={{fontSize:'20px', fontWeight:700, margin:'0 0 4px 0', color:'#0f172a'}}>Quản lý Bàn & Mã QR</h2>
                    <p style={{color:'#64748b', margin:0, fontSize:'14px'}}>Khách quét QR sẽ mở đúng menu của cửa hàng và gắn sẵn số bàn.</p>
                  </div>
                  <span className="fh-badge neutral">{tables.filter((item) => item.isActive).length}/{tables.length} bàn mở</span>
                </div>

                <form className="fh-card" style={{padding:'24px', marginBottom:'24px', display:'flex', gap:'20px', alignItems:'center', flexWrap:'wrap'}} onSubmit={addDiningTables}>
                  <div className="fh-item-icon" style={{background:'#fef3c7', color:'#d97706'}}><Plus size={20}/></div>
                  <div style={{flex:1, minWidth:'250px'}}>
                    <b style={{display:'block', fontSize:'15px', marginBottom:'4px'}}>Thêm bàn mới tự động</b>
                    <span style={{fontSize:'13px', color:'#64748b'}}>Hệ thống sẽ nối tiếp số bàn hiện tại và sinh QR tự động (Tối đa 50 bàn/lần).</span>
                  </div>
                  <div style={{display:'flex', gap:'12px', alignItems:'center'}}>
                    <input type="number" min="1" max="50" style={{padding:'10px 16px', borderRadius:'8px', border:'1px solid #e2e8f0', width:'80px', textAlign:'center'}} value={addTableCount} onChange={(e) => setAddTableCount(e.target.value)} />
                    <button type="submit" className="fh-btn-gold" disabled={addingTables}>{addingTables ? 'Đang tạo...' : `Thêm ${addTableCount} bàn`}</button>
                  </div>
                </form>

                <div className="fh-card" style={{padding:'24px', marginBottom:'24px', display:'flex', flexWrap: 'wrap', gap:'16px', alignItems:'center'}}>
                  <div style={{flex:1, minWidth: '250px'}}>
                    <b style={{display:'block', fontSize:'15px', marginBottom:'4px'}}>Domain cấu hình cho mã QR</b>
                    <span style={{fontSize:'13px', color:'#64748b'}}>Chỉ thay đổi nếu bạn đang test (ngrok) hoặc dùng domain riêng.</span>
                  </div>
                  <div style={{display:'flex', gap:'12px', width: '100%', flex: 1, minWidth: '250px'}}>
                    <input style={{flex: 1, padding:'10px 16px', borderRadius:'8px', border:'1px solid #e2e8f0', minWidth:'0'}} value={publicUrlDraft} onChange={(e) => setPublicUrlDraft(e.target.value)} placeholder="https://..." />
                    <button className="fh-btn-outline" onClick={savePublicBaseUrl}>Lưu Link</button>
                  </div>
                </div>

                <div className="fh-filter-panel">
                  <div className="fh-search-box">
                    <Search size={16} />
                    <input value={tableSearch} onChange={(e) => { setTableSearch(e.target.value); setTablePage(1); }} placeholder="Tìm kiếm số bàn..." />
                  </div>
                  <select value={tableStatus} onChange={(e) => { setTableStatus(e.target.value); setTablePage(1); }}>
                    <option value="all">Tất cả bàn</option>
                    <option value="true">Đang hoạt động</option>
                    <option value="false">Đã khóa</option>
                  </select>
                </div>

                <div className="fh-data-grid">
                  {pagedTables.map((table) => <TableQrCard key={table._id} table={table} shop={shop} onRegenerate={regenerateQr} onToggle={toggleTable} />)}
                  {!pagedTables.length && <div className="fh-empty" style={{gridColumn:'1/-1'}}><ScanLine size={40}/><h3>Chưa có bàn phù hợp</h3><p>Thêm bàn mới hoặc thay đổi bộ lọc.</p></div>}
                </div>
                <div style={{marginTop:'24px'}}><Pagination pagination={tablePagination} onPageChange={setTablePage} /></div>
              </>
            )}

            {tab === 'tables' && !(shop.businessType === 'restaurant' && shop.serviceModes?.includes('dine_in')) && (
              <div className="fh-empty">
                <ScanLine size={48}/>
                <h3>Shop không dùng QR tại bàn</h3>
                <p>Chức năng thêm bàn chỉ dành cho nhà hàng đã bật hình thức phục vụ “Ăn tại bàn”.</p>
                <button className="fh-btn-gold" onClick={() => setTab('settings')} style={{marginTop:'16px'}}>Mở cấu hình phục vụ</button>
              </div>
            )}

            {/* TAB: PRODUCTS */}
            {tab === 'products' && (
              <>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap: 'wrap', gap: '12px'}}>
                  <div>
                    <h2 style={{fontSize:'20px', fontWeight:700, margin:'0 0 4px 0', color:'#0f172a'}}>Quản lý Sản phẩm / Menu</h2>
                    <p style={{color:'#64748b', margin:0, fontSize:'14px'}}>Đang có {productPagination.total} sản phẩm trong hệ thống.</p>
                  </div>
                  <button className="fh-btn-gold" onClick={() => { setEditingProductId(null); setProductForm(emptyProduct); setTab('product-form'); }}><Plus size={18}/> Thêm sản phẩm</button>
                </div>

                <div className="fh-filter-panel">
                  <div className="fh-search-box">
                    <Search size={16} />
                    <input value={productFilters.search} onChange={(e) => updateProductFilter('search',e.target.value)} placeholder="Tìm tên sản phẩm..." />
                  </div>
                  <select value={productFilters.category} onChange={(e) => updateProductFilter('category',e.target.value)}>
                    <option value="">Mọi danh mục</option>
                    {productCategories.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select value={productFilters.isActive} onChange={(e) => updateProductFilter('isActive',e.target.value)}>
                    <option value="">Trạng thái bán</option>
                    <option value="true">Đang bán</option>
                    <option value="false">Đang ẩn</option>
                  </select>
                  <select value={productFilters.stock} onChange={(e) => updateProductFilter('stock',e.target.value)}>
                    <option value="">Tồn kho</option>
                    <option value="available">Còn hàng</option>
                    <option value="out">Hết hàng</option>
                  </select>
                </div>

                <div className="fh-data-grid">
                  {productLoading && <p style={{textAlign:'center', color:'#64748b', gridColumn:'1/-1'}}>Đang tải...</p>}
                  {!productLoading && products.map((product) => (
                    <article key={product._id} className="fh-card" style={{display:'flex', flexDirection:'column', opacity: product.isActive ? 1 : 0.6}}>
                      <div style={{height:'200px', backgroundColor:'#f1f5f9', backgroundImage:`url(${product.images?.[0] || ''})`, backgroundSize:'cover', backgroundPosition:'center'}}></div>
                      <div style={{padding:'20px', flex:1, display:'flex', flexDirection:'column'}}>
                        <span style={{fontSize:'12px', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px'}}>{product.category || 'Chưa phân loại'}</span>
                        <h3 style={{margin:'0 0 8px 0', fontSize:'16px', color:'#0f172a'}}>{product.name}</h3>
                        <b style={{fontSize:'16px', color:'#d97706', marginBottom:'16px', display:'block'}}>{money(product.salePrice > 0 ? product.salePrice : product.price)}</b>
                        <div style={{marginTop:'auto', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                          <span style={{fontSize:'13px', color:'#64748b'}}>Tồn: {product.stock}</span>
                          <div style={{display:'flex', gap:'8px'}}>
                            <button className="fh-btn-outline" style={{padding:'6px 12px'}} onClick={() => toggleProduct(product)}>{product.isActive ? 'Ẩn' : 'Hiện'}</button>
                            <button className="fh-btn-outline" style={{padding:'6px 12px'}} onClick={() => editProduct(product)}>Sửa</button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <div style={{marginTop:'24px'}}><Pagination pagination={productPagination} onPageChange={setProductPage} /></div>
              </>
            )}

            {/* TAB: PRODUCT FORM */}
            {tab === 'product-form' && (
              <form onSubmit={submitProduct} className="fh-card" style={{padding:'32px', maxWidth:'800px', margin:'0 auto', width:'100%', boxSizing: 'border-box'}}>
                 <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'32px', borderBottom:'1px solid #e2e8f0', paddingBottom:'16px', flexWrap:'wrap', gap:'12px'}}>
                  <div>
                    <h2 style={{fontSize:'20px', fontWeight:700, margin:'0 0 4px 0', color:'#0f172a'}}>{editingProductId ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2>
                  </div>
                  <button type="button" className="fh-btn-outline" onClick={() => setTab('products')}>Hủy & Quay lại</button>
                </div>

                <div className="fh-grid-2">
                  <div className="fh-input-group"><label>Tên sản phẩm/món *</label><input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name:e.target.value })} /></div>
                  <div className="fh-input-group"><label>Danh mục</label><input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category:e.target.value })} /></div>
                </div>
                
                <div className="fh-grid-3">
                  <div className="fh-input-group"><label>Giá bán (VNĐ) *</label><input required type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price:e.target.value })} /></div>
                  <div className="fh-input-group"><label>Giá khuyến mãi</label><input type="number" value={productForm.salePrice} onChange={(e) => setProductForm({ ...productForm, salePrice:e.target.value })} /></div>
                  <div className="fh-input-group"><label>Tồn kho (số lượng)</label><input type="number" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock:e.target.value })} /></div>
                </div>

                <div className="fh-input-group">
                  <label>Link ảnh (Mỗi link một dòng)</label>
                  <textarea rows="3" value={productForm.images} onChange={(e) => setProductForm({ ...productForm, images:e.target.value })} placeholder="https://..." />
                </div>
                
                <div className="fh-input-group">
                  <label>Mô tả chi tiết</label>
                  <textarea rows="4" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description:e.target.value })} />
                </div>

                <label style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', marginBottom:'32px', fontSize:'15px', color:'#0f172a', fontWeight:500}}>
                  <input type="checkbox" style={{width:'18px', height:'18px', accentColor:'#f59e0b'}} checked={productForm.isActive !== false} onChange={(e) => setProductForm({ ...productForm, isActive:e.target.checked })} /> 
                  Hiển thị bán ngay trên cửa hàng
                </label>

                <button className="fh-btn-gold" style={{width:'100%', justifyContent:'center', padding:'14px', fontSize:'16px'}}>Lưu sản phẩm</button>
              </form>
            )}

            {/* TAB: LOYALTY (ƯU ĐÃI) */}
            {tab === 'loyalty' && (
              <div style={{background:'#fff', borderRadius:'16px', border:'1px solid #e2e8f0', padding:'24px'}}>
                 <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px'}}>
                  <div>
                    <h2 style={{fontSize:'20px', fontWeight:700, margin:'0 0 4px 0', color:'#0f172a'}}>Chương trình Ưu đãi & Tích xu</h2>
                    <p style={{color:'#64748b', margin:0, fontSize:'14px'}}>Thiết lập tỷ lệ quy đổi và điều kiện tham gia khách hàng thân thiết.</p>
                  </div>
                </div>
                <LoyaltyManager shop={shop} onShopUpdate={(updated) => { setShop(updated); setShopForm(updated); }} onMessage={(message, isError) => { if (isError) setError(message); else setToast(message); }} />
              </div>
            )}

            {/* TAB: MESSAGES */}
            {tab === 'messages' && (
              <div className="fh-chat-page">
                <div className="fh-chat-page-header">
                  <div>
                    <h2 style={{fontSize:'20px', fontWeight:700, margin:'0 0 4px 0', color:'#0f172a'}}>Chăm sóc khách hàng</h2>
                    <p style={{color:'#64748b', margin:0, fontSize:'14px'}}>Phản hồi trực tiếp các thắc mắc từ người mua.</p>
                  </div>
                  {unreadTotals.customer_shop > 0 && <span className="fh-badge pending">{unreadTotals.customer_shop} tin chưa đọc</span>}
                </div>
                <div className="fh-chat-wrapper">
                  <ConversationWorkspace conversations={customerThreads} viewerRole="seller" activeId={activeCustomerId} onSelect={markCustomerRead} onReply={replyCustomer} replyValue={customerReply} onReplyChange={setCustomerReply} search={customerSearch} onSearchChange={(value) => { setCustomerSearch(value); setCustomerPage(1); }} unreadOnly={customerUnreadOnly} onUnreadOnlyChange={(value) => { setCustomerUnreadOnly(value); setCustomerPage(1); }} pagination={customerPagination} onPageChange={setCustomerPage} titleFor={(thread) => thread.customerName || 'Khách hàng'} subtitleFor={(thread) => thread.customerPhone || 'Khách trên website'} unreadField="unreadForSeller" loading={customerChatLoading} />
                </div>
              </div>
            )}

            {/* TAB: ADMIN CHAT */}
            {tab === 'admin-chat' && (
              <div className="fh-chat-page">
                <div className="fh-chat-page-header">
                  <div>
                    <h2 style={{fontSize:'20px', fontWeight:700, margin:'0 0 4px 0', color:'#0f172a'}}>Trao đổi Admin nền tảng</h2>
                    <p style={{color:'#64748b', margin:0, fontSize:'14px'}}>Kênh hỗ trợ duyệt shop, kiểm tra thanh toán và khiếu nại.</p>
                  </div>
                  {unreadTotals.shop_admin > 0 && <span className="fh-badge pending">{unreadTotals.shop_admin} tin chưa đọc</span>}
                </div>
                <div className="fh-chat-wrapper">
                  <ConversationWorkspace conversations={adminThreads} viewerRole="seller" activeId={activeAdminId} onSelect={markAdminRead} onReply={sendAdmin} replyValue={adminMessage} onReplyChange={setAdminMessage} search="" onSearchChange={() => {}} unreadOnly={false} onUnreadOnlyChange={() => {}} pagination={null} onPageChange={() => {}} titleFor={() => 'Admin tổng FoodHub'} subtitleFor={() => 'Hỗ trợ nền tảng · Realtime'} unreadField="unreadForSeller" emptyTitle="Bắt đầu trao đổi" emptyText="Nhập nội dung ở khung bên phải để tạo trò chuyện." allowEmptyReply />
                </div>
              </div>
            )}

            {/* TAB: SETTINGS */}
            {tab === 'settings' && (
              <form onSubmit={saveShop}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px', flexWrap:'wrap', gap:'16px'}}>
                  <div>
                    <h2 style={{fontSize:'24px', fontWeight:800, margin:'0 0 4px 0', color:'#0f172a'}}>Cấu hình Cửa hàng</h2>
                    <p style={{color:'#64748b', margin:0, fontSize:'15px'}}>Điều chỉnh thông tin thương hiệu, thanh toán và tên miền riêng.</p>
                  </div>
                  <button className="fh-btn-gold" style={{padding:'12px 24px'}}>Lưu cấu hình</button>
                </div>

                <div className="fh-form-section">
                  <h3>1. Thông tin cơ bản</h3>
                  <div className="fh-grid-2">
                    <div className="fh-input-group"><label>Tên cửa hàng</label><input value={shopForm.name || ''} onChange={(e) => setShopForm({ ...shopForm, name:e.target.value })} /></div>
                    <div className="fh-input-group"><label>Đường dẫn hệ thống (Slug)</label><input value={shopForm.slug || ''} onChange={(e) => setShopForm({ ...shopForm, slug:e.target.value })} /></div>
                    <div className="fh-input-group"><label>Hotline CSKH</label><input value={shopForm.phone || ''} onChange={(e) => setShopForm({ ...shopForm, phone:e.target.value })} /></div>
                    <div className="fh-input-group"><label>Địa chỉ cửa hàng</label><input value={shopForm.address || ''} onChange={(e) => setShopForm({ ...shopForm, address:e.target.value })} /></div>
                  </div>
                  <div className="fh-input-group"><label>Mô tả ngắn gọn</label><textarea rows="3" value={shopForm.description || ''} onChange={(e) => setShopForm({ ...shopForm, description:e.target.value })} /></div>
                </div>

                <div className="fh-form-section">
                  <h3>2. Phương thức Phục vụ & Thanh toán</h3>
                  <div className="fh-input-group">
                    <label>Hình thức phục vụ</label>
                    <div className="fh-chips">
                      {(shopForm.businessType === 'restaurant' ? [['dine_in','Ăn tại bàn'],['delivery','Giao tận nơi'],['pickup','Mang về']] : [['shipping','Giao hàng'],['pickup','Nhận tại shop']]).map(([value,label]) => (
                        <button type="button" key={value} className={`fh-chip ${shopForm.serviceModes?.includes(value) ? 'active' : ''}`} onClick={() => toggleArray('serviceModes',value)}>{label}</button>
                      ))}
                    </div>
                  </div>
                  
                  {shopForm.serviceModes?.includes('dine_in') && (
                    <div className="fh-input-group" style={{maxWidth:'300px'}}>
                      <label>Tổng số bàn phục vụ</label>
                      <input type="number" min="1" max="500" value={shopForm.numberOfTables || 1} onChange={(e) => setShopForm({ ...shopForm, numberOfTables:e.target.value })} />
                    </div>
                  )}

                  <div className="fh-input-group" style={{marginTop:'32px', borderTop:'1px dashed #e2e8f0', paddingTop:'24px'}}>
                    <label>Phương thức thanh toán hỗ trợ</label>
                    <div className="fh-chips">
                      {[['cash','Tiền mặt'],['bank_transfer','Chuyển khoản'],['vnpay','VNPAY']].map(([value,label]) => (
                        <button type="button" key={value} className={`fh-chip ${shopForm.paymentMethods?.includes(value) ? 'active' : ''}`} onClick={() => toggleArray('paymentMethods',value)}>{label}</button>
                      ))}
                    </div>
                  </div>

                  <div className="fh-grid-3">
                    <div className="fh-input-group"><label>Tên Chủ tài khoản</label><input value={shopForm.bankAccountName || ''} onChange={(e) => setShopForm({ ...shopForm, bankAccountName:e.target.value })} /></div>
                    <div className="fh-input-group"><label>Số tài khoản</label><input value={shopForm.bankAccountNumber || ''} onChange={(e) => setShopForm({ ...shopForm, bankAccountNumber:e.target.value })} /></div>
                    <div className="fh-input-group"><label>Ngân hàng thụ hưởng</label><input value={shopForm.bankName || ''} onChange={(e) => setShopForm({ ...shopForm, bankName:e.target.value })} /></div>
                  </div>
                </div>

                <div className="fh-form-section">
                  <h3>3. Thông tin Xuất Hóa Đơn & Thuế</h3>
                  <p>Thông tin này được đưa lên mẫu in. Hãy nhập đúng hồ sơ đăng ký thuế của đơn vị.</p>
                  <div className="fh-grid-2">
                    <div className="fh-input-group"><label>Tên pháp lý/người bán</label><input value={shopForm.legalName || ''} onChange={(e) => setShopForm({ ...shopForm, legalName:e.target.value })} placeholder={shop?.name} /></div>
                    <div className="fh-input-group"><label>Mã số thuế</label><input value={shopForm.taxCode || ''} onChange={(e) => setShopForm({ ...shopForm, taxCode:e.target.value })} placeholder="Mã số thuế của đơn vị" /></div>
                    <div className="fh-input-group"><label>Địa chỉ trên hóa đơn</label><input value={shopForm.invoiceAddress || ''} onChange={(e) => setShopForm({ ...shopForm, invoiceAddress:e.target.value })} /></div>
                    <div className="fh-input-group"><label>Email hóa đơn</label><input type="email" value={shopForm.invoiceEmail || ''} onChange={(e) => setShopForm({ ...shopForm, invoiceEmail:e.target.value })} /></div>
                    <div className="fh-input-group"><label>Điện thoại hóa đơn</label><input value={shopForm.invoicePhone || ''} onChange={(e) => setShopForm({ ...shopForm, invoicePhone:e.target.value })} /></div>
                    <div className="fh-input-group">
                      <label>Thuế suất VAT mặc định</label>
                      <select value={shopForm.defaultVatRate || '0'} onChange={(e) => setShopForm({ ...shopForm, defaultVatRate:e.target.value })}>
                        <option value="KCT">Không chịu thuế</option>
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="8">8%</option>
                        <option value="10">10%</option>
                      </select>
                    </div>
                    <div className="fh-input-group"><label>Nhà cung cấp HĐĐT (Ví dụ: MISA, VNPT)</label><input value={shopForm.invoiceProviderName || ''} onChange={(e) => setShopForm({ ...shopForm, invoiceProviderName:e.target.value })} placeholder="MISA, VNPT, Viettel..." /></div>
                    <div className="fh-input-group"><label>Trang tra cứu HĐĐT mặc định</label><input value={shopForm.invoiceLookupUrl || ''} onChange={(e) => setShopForm({ ...shopForm, invoiceLookupUrl:e.target.value })} placeholder="https://..." /></div>
                  </div>
                </div>

                <div className="fh-form-section">
                  <h3>4. Giao diện Cửa hàng (Storefront)</h3>
                  <div className="fh-grid-2">
                    <div className="fh-input-group"><label>Link Logo (URL)</label><input value={shopForm.logoUrl || ''} onChange={(e) => setShopForm({ ...shopForm, logoUrl:e.target.value })} /></div>
                    <div className="fh-input-group"><label>Link Banner ngang (URL)</label><input value={shopForm.bannerUrl || ''} onChange={(e) => setShopForm({ ...shopForm, bannerUrl:e.target.value })} /></div>
                  </div>
                  <div className="fh-grid-3">
                    {[1,2,3].map((number) => (
                      <div className="fh-input-group" key={number}><label>Ảnh Slider {number}</label><input value={shopForm[`backgroundImage${number}`] || ''} onChange={(e) => setShopForm({ ...shopForm, [`backgroundImage${number}`]:e.target.value })} /></div>
                    ))}
                  </div>
                </div>

                <div className="fh-form-section">
                  <h3>5. Tên miền riêng (Custom Domain)</h3>
                  <div className="fh-alert neutral" style={{background:'#f8fafc', border:'1px solid #e2e8f0'}}>
                    <div style={{flex:1}}>
                      <b style={{display:'block', marginBottom:'4px', color:'#0f172a'}}>Trạng thái: {shopForm.customDomain ? `Đã cấu hình (${shopForm.customDomain})` : 'Đang sử dụng domain của hệ thống'}</b>
                      <p style={{margin:0, color:'#64748b'}}>Để chạy tên miền riêng, bạn cần trỏ bản ghi CNAME về máy chủ FoodHub trước khi lưu cấu hình này.</p>
                    </div>
                  </div>
                  <div className="fh-input-group" style={{maxWidth:'500px'}}>
                    <label>Nhập Tên miền (Ví dụ: cuahang.com hoặc shop.cuahang.com)</label>
                    <input value={shopForm.customDomain || ''} onChange={(e) => setShopForm({ ...shopForm, customDomain:e.target.value })} placeholder="shop.tenmien.com" />
                  </div>
                </div>

                <div className="fh-form-section">
                  <h3>6. Tích hợp nâng cao</h3>
                  <div className="fh-grid-2">
                    <div className="fh-input-group">
                      <label>Phí giao hàng mặc định (VNĐ)</label>
                      <input type="number" value={shopForm.deliveryFee || 0} onChange={(e) => setShopForm({ ...shopForm, deliveryFee:e.target.value })} />
                    </div>
                    <div className="fh-input-group">
                      <label>Telegram Chat ID (Để nhận thông báo)</label>
                      <input value={shopForm.telegramChatId || ''} onChange={(e) => setShopForm({ ...shopForm, telegramChatId:e.target.value })} />
                    </div>
                  </div>
                </div>

              </form>
            )}

          </div>
        </div>
      </main>

      {/* MODAL IN HÓA ĐƠN */}
      {invoiceOrder && (
        <InvoicePrintModal order={invoiceOrder} shop={shop} onClose={() => setInvoiceOrder(null)} onSave={saveInvoiceData} />
      )}
    </section>
  );
};

export default SellerDashboard;