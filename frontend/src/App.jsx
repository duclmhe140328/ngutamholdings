import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import api from './api/axios.js';
import NavBar from './components/NavBar.jsx';
import Footer from './components/Footer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import PwaStatus from './pages/PwaStatus.jsx';
import Register from './pages/Register.jsx';
import CreateShop from './pages/CreateShop.jsx';
import SellerDashboard from './pages/SellerDashboard.jsx';
import ShopPage from './pages/ShopPage.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Checkout from './pages/Checkout.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import NotFound from './pages/NotFound.jsx';
import PaymentResult from './pages/PaymentResult.jsx';
import PwaInstallPrompt from './components/PwaInstallPrompt.jsx';

const App = () => {
  const { pathname } = useLocation();
  const [domainShop, setDomainShop] = useState(null);
  const [domainChecked, setDomainChecked] = useState(false);
  const [apiOffline, setApiOffline] = useState(false);

  // FH_PWA_DOMAIN_RETRY_V33: không kết luận sai domain chỉ vì backend đang cold-start.
  useEffect(() => {
    let alive = true;
    let retryTimer = null;

    const checkDomain = async (attempt = 0) => {
      try {
        const timeouts = [7000, 11000, 15000];
        const res = await api.get('/shops/domain/current', {
          timeout: timeouts[Math.min(attempt, timeouts.length - 1)],
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
        });
        if (!alive) return;
        setDomainShop(res.data.shop || null);
        setApiOffline(false);
        setDomainChecked(true);
      } catch {
        if (!alive) return;
        if (attempt < 2 && navigator.onLine) {
          retryTimer = window.setTimeout(() => checkDomain(attempt + 1), [1200, 2600, 5000][attempt]);
          return;
        }
        setDomainShop(null);
        setApiOffline(true);
        setDomainChecked(true);
      }
    };

    checkDomain();
    const onOnline = () => checkDomain(0);
    window.addEventListener('online', onOnline);

    return () => {
      alive = false;
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const customStorePath = Boolean(domainShop) && (
    pathname === '/' || pathname === '/checkout' || pathname.startsWith('/table/') || pathname.startsWith('/product/')
  );
  const immersive = customStorePath || pathname.startsWith('/shop/') || ['/dashboard', '/admin', '/create-shop'].includes(pathname);

  if (!domainChecked) return <div className="app-boot"><img src="/logo.png" alt="" /><p>Đang chuẩn bị trải nghiệm...</p></div>;

  return (
    <>
      {!immersive && <NavBar />}
      {apiOffline && !immersive && (
        <div className="api-offline-banner" role="status">
          <b>Trang giao diện đang chạy.</b> Backend hoặc MongoDB chưa kết nối nên dữ liệu thật chưa tải được.
        </div>
      )}
      <main>
        <Routes>
          {domainShop ? (
            <>
              <Route path="/" element={<ShopPage forcedSlug={domainShop.slug} customDomainMode />} />
              <Route path="/table/:tableToken" element={<ShopPage forcedSlug={domainShop.slug} customDomainMode />} />
              <Route path="/checkout" element={<Checkout forcedSlug={domainShop.slug} customDomainMode />} />
              <Route path="/table/:tableToken/checkout" element={<Checkout forcedSlug={domainShop.slug} customDomainMode />} />
              <Route path="/product/:id" element={<ProductDetail forcedSlug={domainShop.slug} customDomainMode />} />
              <Route path="/table/:tableToken/product/:id" element={<ProductDetail forcedSlug={domainShop.slug} customDomainMode />} />
            </>
          ) : <Route path="/" element={<Home />} />}

          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/pwa-status" element={<PwaStatus />} />
          <Route path="/register" element={<Register />} />
          <Route path="/create-shop" element={<ProtectedRoute><CreateShop /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/shop/:slug" element={<ShopPage />} />
          <Route path="/shop/:slug/table/:tableToken" element={<ShopPage />} />
          <Route path="/shop/:slug/product/:id" element={<ProductDetail />} />
          <Route path="/shop/:slug/table/:tableToken/product/:id" element={<ProductDetail />} />
          <Route path="/shop/:slug/checkout" element={<Checkout />} />
          <Route path="/shop/:slug/table/:tableToken/checkout" element={<Checkout />} />
          <Route path="/payment-result" element={<PaymentResult />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!immersive && <Footer />}
      <PwaInstallPrompt />
    </>
  );
};

export default App;
