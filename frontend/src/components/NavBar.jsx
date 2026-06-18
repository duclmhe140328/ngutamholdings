import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  Menu, X, Phone, Store, LogOut, 
  UserCircle, Sparkles, ChefHat, ShoppingBag 
} from 'lucide-react';

const NavBar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Đóng menu khi chuyển trang
  useEffect(() => setOpen(false), [location.pathname]);
  
  // Khóa cuộn trang khi mở menu mobile
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [open]);

  const signOut = () => {
    logout();
    navigate('/');
  };

  const categories = ['Fine Dining', 'Cafe & Bakery', 'Đồ ăn nhanh', 'Quà tặng', 'Thời trang', 'Gia dụng', 'Đặc sản'];

  return (
    <>
      {/* KHỐI CSS NỘI BỘ */}
      <style>{`
        :root {
          --primary-dark: #0f172a;
          --primary-gold: #f59e0b;
          --primary-gold-hover: #d97706;
          --text-main: #334155;
          --text-light: #64748b;
          --border-color: #f1f5f9;
          --bg-glass: rgba(255, 255, 255, 0.85);
        }

        /* ĐÃ ĐỔI THÀNH FIXED ĐỂ DÍNH CHẶT TRÊN ĐẦU */
        .fh-header {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 999;
          width: 100%;
          background: var(--bg-glass);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-color);
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
          font-family: system-ui, -apple-system, sans-serif;
        }

        /* Spacer để bù đắp khoảng trống do fixed header để lại */
        .header-spacer {
          height: 146px; /* Chiều cao xấp xỉ của NavBar */
          width: 100%;
        }

        .fh-container { max-width: 1200px; margin: 0 auto; padding: 0 16px; }

        /* Announcement Bar */
        .fh-top-bar { background-color: var(--primary-dark); color: rgba(255, 255, 255, 0.9); font-size: 12px; padding: 8px 0; }
        .fh-top-bar-inner { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
        .fh-top-bar .highlight { display: flex; align-items: center; gap: 6px; }
        .fh-top-bar .highlight svg { color: var(--primary-gold); }
        .fh-top-bar .contact-info { display: flex; align-items: center; gap: 16px; font-weight: 500; }
        .fh-top-bar a { display: flex; align-items: center; gap: 4px; color: inherit; text-decoration: none; transition: color 0.2s; }
        .fh-top-bar a:hover { color: var(--primary-gold); }
        .fh-top-bar .divider { border-left: 1px solid #334155; padding-left: 16px; display: none; }

        /* Main Nav Bar */
        .fh-main-nav { display: flex; justify-content: space-between; align-items: center; height: 70px; }
        .fh-brand { display: flex; align-items: center; gap: 12px; text-decoration: none; cursor: pointer; }
        .fh-brand-icon { width: 40px; height: 40px; background: var(--primary-dark); color: var(--primary-gold); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; border-radius: 8px; transition: all 0.3s; }
        .fh-brand:hover .fh-brand-icon { background: var(--primary-gold); color: var(--primary-dark); }
        .fh-brand-text { display: flex; flex-direction: column; }
        .fh-brand-name { font-size: 18px; font-weight: 700; color: var(--primary-dark); line-height: 1.2; }
        .fh-brand-slogan { font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px; }

        /* Desktop Menu */
        .fh-desktop-menu { display: none; align-items: center; gap: 32px; list-style: none; margin: 0; padding: 0; }
        .fh-desktop-menu li a { text-decoration: none; color: var(--text-main); font-weight: 500; font-size: 15px; transition: color 0.2s; display: flex; align-items: center; gap: 6px; }
        .fh-desktop-menu li a:hover, .fh-desktop-menu li a.active { color: var(--primary-gold-hover); }
        .fh-desktop-menu .admin-link { color: #dc2626; }
        .fh-desktop-menu .seller-link { color: #4f46e5; }

        /* Desktop Actions */
        .fh-actions { display: none; align-items: center; gap: 16px; }
        .fh-btn-login { text-decoration: none; color: var(--text-main); font-weight: 600; font-size: 14px; transition: color 0.2s; }
        .fh-btn-login:hover { color: var(--primary-gold-hover); }
        .fh-btn-gold { background: var(--primary-gold); color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 999px; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.2); border: none; cursor: pointer; }
        .fh-btn-gold:hover { background: var(--primary-gold-hover); transform: translateY(-1px); }
        .fh-user-badge { display: flex; align-items: center; gap: 8px; background: #f8fafc; padding: 6px 12px; border-radius: 999px; font-size: 14px; font-weight: 500; color: var(--text-main); }
        .fh-btn-logout { background: none; border: none; color: var(--text-light); cursor: pointer; padding: 8px; border-radius: 50%; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
        .fh-btn-logout:hover { color: #dc2626; background: #fef2f2; }

        /* Category Ribbon */
        .fh-ribbon-wrapper { border-top: 1px solid var(--border-color); background: rgba(255,255,255,0.5); }
        .fh-ribbon { display: flex; gap: 24px; padding: 12px 0; margin: 0; list-style: none; overflow-x: auto; white-space: nowrap; scrollbar-width: none; }
        .fh-ribbon::-webkit-scrollbar { display: none; }
        .fh-ribbon li { font-size: 14px; font-weight: 500; color: var(--text-light); cursor: pointer; transition: color 0.2s; display: flex; align-items: center; gap: 6px; }
        .fh-ribbon li:hover { color: var(--primary-gold-hover); }

        /* Mobile Menu Toggle & Drawer */
        .fh-mobile-toggle { display: block; background: none; border: none; color: var(--text-main); cursor: pointer; padding: 4px; }
        .fh-mobile-drawer { position: fixed; top: 0; left: -100%; width: 80%; max-width: 320px; height: 100vh; background: #fff; z-index: 1000; transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 20px 0 25px -5px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
        .fh-mobile-drawer.open { left: 0; }
        .fh-drawer-header { padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; font-weight: 700; color: var(--primary-dark); background: #f8fafc; }
        .fh-drawer-content { padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 24px; }
        .fh-drawer-nav { display: flex; flex-direction: column; gap: 16px; list-style: none; padding: 0; margin: 0; }
        .fh-drawer-nav a { text-decoration: none; color: var(--text-main); font-weight: 500; font-size: 16px; display: block; transition: color 0.2s; }
        .fh-drawer-nav a:hover, .fh-drawer-nav a.active { color: var(--primary-gold-hover); }
        .fh-drawer-divider { height: 1px; background: var(--border-color); width: 100%; border: none; }
        .fh-drawer-actions { display: flex; flex-direction: column; gap: 12px; }
        .fh-drawer-btn { display: flex; align-items: center; justify-content: center; width: 100%; padding: 12px; border-radius: 8px; font-weight: 600; text-decoration: none; border: 1px solid transparent; cursor: pointer; font-size: 15px;}
        .fh-drawer-btn.outline { border-color: #cbd5e1; color: var(--text-main); background: #fff; }
        .fh-drawer-btn.logout { background: #fef2f2; color: #dc2626; border-color: #fee2e2; gap: 8px; }
        .fh-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 999; opacity: 0; visibility: hidden; transition: all 0.3s; }
        .fh-backdrop.open { opacity: 1; visibility: visible; }

        @media (min-width: 1024px) {
          .fh-mobile-toggle { display: none; }
          .fh-desktop-menu { display: flex; }
          .fh-actions { display: flex; }
          .fh-top-bar .divider { display: block; }
          .fh-mobile-drawer { display: none !important; }
          .fh-backdrop { display: none !important; }
        }
        @media (max-width: 640px) {
          .header-spacer { height: 162px; }
        }
      `}</style>

      {/* GIAO DIỆN NAVBAR */}
      <header className="fh-header">
        <div className="fh-top-bar">
          <div className="fh-container fh-top-bar-inner">
            <div className="highlight">
              <Sparkles size={14} /> Nền tảng vận hành nhà hàng & thương mại điện tử cao cấp
            </div>
            <div className="contact-info">
              <a href="tel:0900000000"><Phone size={12} /> Hotline: 0900 000 000</a>
              <span className="divider">Hỗ trợ 08:00–22:00</span>
            </div>
          </div>
        </div>

        <div className="fh-container">
          <div className="fh-main-nav">
            <Link to="/" className="fh-brand" aria-label="Trang chủ">
                <img src="/icons/icon-192.png" alt="Ngự Tâm Holdings Logo" style={{width: '40px', height: '40px'}} />
              <div className="fh-brand-text">
                <span className="fh-brand-name">Ngự Tâm Holdings</span>
                <span className="fh-brand-slogan">Restaurant & Commerce</span>
              </div>
            </Link>

            <ul className="fh-desktop-menu">
              <li><NavLink to="/" className={({isActive}) => isActive ? "active" : ""}>Khám phá</NavLink></li>
              <li><a href="/#merchants">Nhà hàng & Cửa hàng</a></li>
              <li><a href="/#features">Giải pháp</a></li>
              {user?.role === 'seller' && <li><NavLink to="/dashboard" className="seller-link"><Store size={16}/> Quản trị Shop</NavLink></li>}
              {user?.role === 'admin' && <li><NavLink to="/admin" className="admin-link">Admin Tổng</NavLink></li>}
            </ul>

            <div className="fh-actions">
              {!user ? (
                <>
                  <Link to="/login" className="fh-btn-login">Đăng nhập</Link>
                  <Link to="/register" className="fh-btn-gold">Mở cửa hàng</Link>
                </>
              ) : (
                <>
                  <div className="fh-user-badge">
                    <UserCircle size={18} color="#64748b" /> {user.name}
                  </div>
                  <button onClick={signOut} className="fh-btn-logout" title="Đăng xuất">
                    <LogOut size={20} />
                  </button>
                </>
              )}
            </div>

            <button className="fh-mobile-toggle" onClick={() => setOpen(true)}>
              <Menu size={28} />
            </button>
          </div>
        </div>

        <div className="fh-ribbon-wrapper">
          <div className="fh-container">
            <ul className="fh-ribbon">
              {categories.map((item, index) => (
                <li key={index}>
                  {index === 0 && <ChefHat size={14} />}
                  {index === 1 && <ShoppingBag size={14} />}
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      {/* THÊM SPACER VÀO ĐÂY ĐỂ ĐẨY NỘI DUNG BÊN DƯỚI XUỐNG */}
      <div className="header-spacer"></div>

      {/* MOBILE MENU DRAWER */}
      <div className={`fh-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className={`fh-mobile-drawer ${open ? 'open' : ''}`}>
        <div className="fh-drawer-header">
          <span><Menu size={18} style={{marginRight: 8, verticalAlign: 'middle'}}/> Menu</span>
          <button className="fh-mobile-toggle" onClick={() => setOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <div className="fh-drawer-content">
          <ul className="fh-drawer-nav">
            <li><NavLink to="/" onClick={() => setOpen(false)}>Khám phá</NavLink></li>
            <li><a href="/#merchants" onClick={() => setOpen(false)}>Nhà hàng & cửa hàng</a></li>
            <li><a href="/#features" onClick={() => setOpen(false)}>Giải pháp</a></li>
            {user?.role === 'seller' && <li><NavLink to="/dashboard" className="seller-link" onClick={() => setOpen(false)}>Quản trị shop</NavLink></li>}
            {user?.role === 'admin' && <li><NavLink to="/admin" className="admin-link" onClick={() => setOpen(false)}>Admin tổng</NavLink></li>}
          </ul>

          <hr className="fh-drawer-divider" />

          <div className="fh-drawer-actions">
            {!user ? (
              <>
                <Link to="/login" className="fh-drawer-btn outline" onClick={() => setOpen(false)}>Đăng nhập</Link>
                <Link to="/register" className="fh-btn-gold fh-drawer-btn" style={{border: 'none', color: '#fff'}} onClick={() => setOpen(false)}>Mở cửa hàng</Link>
              </>
            ) : (
              <>
                <div className="fh-user-badge" style={{justifyContent: 'center', padding: '12px', marginBottom: '8px'}}>
                  <UserCircle size={22} color="#94a3b8" /> <span>Xin chào, {user.name}</span>
                </div>
                <button onClick={signOut} className="fh-drawer-btn logout">
                  <LogOut size={18} /> Đăng xuất
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default NavBar;