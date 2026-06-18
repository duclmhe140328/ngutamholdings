import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { 
  Search, X, ArrowRight, Star, Clock, 
  Truck, Utensils, ShoppingBag, CheckCircle2, ChevronRight, Store 
} from 'lucide-react';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const slides = [
  { kicker: 'Restaurant operating system', title: 'Vận hành nhà hàng tinh gọn. Trải nghiệm khác biệt.', text: 'Từ QR gọi món tại bàn, POS, thanh toán đến giao hàng và chăm sóc khách — tất cả trong một nền tảng realtime.', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=85&w=2000&auto=format&fit=crop' },
  { kicker: 'Luxury commerce', title: 'Storefront đẹp, nhanh và đúng tinh thần thương hiệu.', text: 'Phù hợp cho bakery, quà tặng, thời trang, đặc sản và mọi mô hình thương mại cần hình ảnh chuyên nghiệp.', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=85&w=2000&auto=format&fit=crop' },
  { kicker: 'Realtime service', title: 'Đơn mới và tin nhắn xuất hiện tức thì, không cần tải lại.', text: 'Âm báo dashboard, thông báo trình duyệt, Telegram và màn hình POS được cập nhật theo thời gian thực.', image: 'https://images.unsplash.com/photo-1516211697506-8360dbcfe9a4?q=85&w=2000&auto=format&fit=crop' }
];

const fallback = [
  { _id: '1', name: 'La Maison Dining', slug: 'la-maison', businessType: 'restaurant', cuisine: 'French · Contemporary', rating: 4.9, deliveryTime: '25–35 phút', deliveryFee: 0, bannerUrl: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?q=80&w=1200&auto=format&fit=crop', logoUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=400&auto=format&fit=crop', productCount: 26, minPrice: 89000 },
  { _id: '2', name: 'Atelier Pâtisserie', slug: 'atelier', businessType: 'retail', cuisine: 'Bakery · Gift Box', rating: 4.8, deliveryTime: '30–45 phút', deliveryFee: 15000, bannerUrl: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?q=80&w=1200&auto=format&fit=crop', logoUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=400&auto=format&fit=crop', productCount: 42, minPrice: 59000 },
  { _id: '3', name: 'Velvet Tea House', slug: 'velvet', businessType: 'restaurant', cuisine: 'Tea · Brunch', rating: 4.7, deliveryTime: '20–30 phút', deliveryFee: 10000, bannerUrl: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=1200&auto=format&fit=crop', logoUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?q=80&w=400&auto=format&fit=crop', productCount: 34, minPrice: 39000 }
];

const quickTags = ['Tất cả', 'Nhà hàng', 'Bakery', 'Cafe', 'Quà tặng', 'Thời trang'];

const Home = () => {
  const [slide, setSlide] = useState(0);
  const [shops, setShops] = useState([]);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('Tất cả');

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, []);
  
  useEffect(() => { 
    api.get('/shops/public/list')
       .then((res) => setShops(res.data.shops || []))
       .catch(() => setShops([])); 
  }, []);

  const usingFallback = shops.length === 0;
  const list = usingFallback ? fallback : shops;
  
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return list.filter((shop) => {
      const searchable = `${shop.name} ${shop.cuisine || ''} ${shop.address || ''} ${shop.businessType || ''}`.toLowerCase();
      return (!normalizedQuery || searchable.includes(normalizedQuery))
        && (tag === 'Tất cả' || (tag === 'Nhà hàng' && shop.businessType === 'restaurant') || searchable.includes(tag.toLowerCase()));
    });
  }, [list, query, tag]);

  const active = slides[slide];
  const goToResults = () => document.getElementById('merchants')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="home-wrapper">
      {/* KHỐI CSS NỘI BỘ MỚI */}
      <style>{`
        :root {
          --primary-dark: #0f172a;
          --primary-gold: #f59e0b;
          --primary-gold-hover: #d97706;
          --bg-light: #f8fafc;
          --text-main: #334155;
          --text-light: #64748b;
          --border-color: #e2e8f0;
        }

        .home-wrapper {
          font-family: system-ui, -apple-system, sans-serif;
          background-color: var(--bg-light);
          min-height: 100vh;
          overflow-x: hidden;
        }

        .fh-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }

        /* --- HERO SECTION --- */
        .hero-section {
          position: relative;
          display: flex;
          align-items: center;
          color: #fff;
          padding: 64px 0 80px; /* Thu gọn padding để slider bớt to */
        }
        
        .hero-bg-layer {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
        }
        
        .hero-bg-image {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0;
          transition: opacity 1.5s ease-in-out, transform 8s ease-out;
          transform: scale(1.05);
        }
        
        .hero-bg-image.active { opacity: 1; transform: scale(1); }

        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.75) 40%, rgba(15, 23, 42, 0.3) 100%);
          z-index: 1;
        }

        .hero-content {
          position: relative;
          z-index: 2;
          width: 100%;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr; /* Cân chỉnh lại tỷ lệ 2 cột */
          gap: 48px;
          align-items: center;
        }

        .hero-copy .kicker {
          display: inline-block;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--primary-gold);
          margin-bottom: 12px;
        }

        .hero-copy h1 {
          font-size: 44px;
          font-weight: 800;
          line-height: 1.2;
          margin: 0 0 20px 0;
          color: #fff;
        }

        .hero-copy p {
          font-size: 17px;
          line-height: 1.6;
          color: #cbd5e1;
          margin: 0 0 32px 0;
          max-width: 95%;
        }

        .hero-actions { display: flex; gap: 16px; margin-bottom: 40px; }

        .btn-gold {
          background: var(--primary-gold);
          color: #fff;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-gold:hover { background: var(--primary-gold-hover); transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.3); }
        
        .btn-glass {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn-glass:hover { background: rgba(255,255,255,0.2); }

        .hero-proof {
          display: flex;
          gap: 24px;
          border-top: 1px solid rgba(255,255,255,0.1);
          padding-top: 20px;
        }
        .proof-item { display: flex; flex-direction: column; gap: 2px; }
        .proof-item b { font-size: 14px; display: flex; align-items: center; gap: 6px; font-weight: 600; }
        .proof-item b svg { color: var(--primary-gold); }
        .proof-item small { color: #94a3b8; font-size: 12px; }

        /* Discovery Card (Form tìm kiếm gọn hơn) */
        .discovery-card {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        .discovery-head h2 { font-size: 22px; font-weight: 700; margin: 0 0 6px 0; line-height: 1.3;}
        .discovery-head p { color: #cbd5e1; font-size: 14px; margin: 0 0 20px 0; }
        
        .search-field { position: relative; margin-bottom: 20px; }
        .search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .search-field input {
          width: 100%;
          padding: 14px 44px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(15, 23, 42, 0.4);
          color: #fff;
          font-size: 15px;
          outline: none;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        .search-field input::placeholder { color: #94a3b8; }
        .search-field input:focus { border-color: var(--primary-gold); background: rgba(15, 23, 42, 0.6); box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2); }
        .clear-btn { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; display: flex;}
        
        /* Bộ lọc tag lướt ngang trên mobile */
        .filter-tags { 
          display: flex; 
          flex-wrap: wrap; 
          gap: 8px; 
          margin-bottom: 24px; 
        }
        .filter-tags button {
          background: rgba(255,255,255,0.1);
          border: 1px solid transparent;
          color: #e2e8f0;
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .filter-tags button:hover { background: rgba(255,255,255,0.2); }
        .filter-tags button.active { background: var(--primary-gold); color: #fff; font-weight: 600; }

        .btn-search {
          width: 100%;
          background: #fff;
          color: var(--primary-dark);
          border: none;
          padding: 14px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }
        .btn-search:hover { background: var(--primary-gold); color: #fff; }

        .hero-dots {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          z-index: 2;
        }
        .hero-dots button {
          width: 32px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.2);
          border: none;
          cursor: pointer;
          transition: all 0.3s;
        }
        .hero-dots button.active { background: var(--primary-gold); width: 48px; }

        /* --- FEATURES SECTION --- */
        .features-section { padding: 64px 0; background: #fff; }
        .features-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        .feature-card span { font-size: 40px; font-weight: 800; color: #f1f5f9; display: block; margin-bottom: 12px; line-height: 1;}
        .feature-card h3 { font-size: 17px; font-weight: 700; color: var(--primary-dark); margin: 0 0 8px 0; }
        .feature-card p { font-size: 14px; color: var(--text-light); line-height: 1.6; margin: 0; }

        /* --- MERCHANTS SECTION --- */
        .merchants-section { padding: 64px 0; }
        .section-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; flex-wrap: wrap; gap: 20px; }
        .section-header .eyebrow { color: var(--primary-gold); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;}
        .section-header h2 { font-size: 28px; font-weight: 800; color: var(--primary-dark); margin: 0 0 12px 0; }
        .section-header p { color: var(--text-light); font-size: 15px; max-width: 600px; margin: 0; }
        .btn-outline { border: 2px solid var(--border-color); color: var(--text-main); font-weight: 600; padding: 10px 20px; font-size: 14px; border-radius: 999px; text-decoration: none; transition: all 0.2s; background: #fff; cursor: pointer;}
        .btn-outline:hover { border-color: var(--primary-dark); color: var(--primary-dark); }

        .merchants-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
        .merchant-card { background: #fff; border-radius: 16px; overflow: hidden; text-decoration: none; color: inherit; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: all 0.3s; border: 1px solid var(--border-color); display: flex; flex-direction: column; }
        .merchant-card:hover { transform: translateY(-6px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border-color: #cbd5e1; }
        .merchant-cover { position: relative; height: 160px; }
        .merchant-cover img { width: 100%; height: 100%; object-fit: cover; }
        .merchant-badge { position: absolute; top: 12px; right: 12px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); color: #fff; padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; display: flex; align-items: center; gap: 4px; }
        .merchant-body { padding: 16px; position: relative; flex: 1; display: flex; flex-direction: column; }
        .merchant-logo { position: absolute; top: -32px; left: 16px; width: 56px; height: 56px; border-radius: 12px; border: 3px solid #fff; background: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); object-fit: cover; }
        .merchant-info { margin-top: 24px; }
        .merchant-info h3 { font-size: 17px; font-weight: 700; color: var(--primary-dark); margin: 0 0 4px 0; }
        .merchant-info p { color: var(--text-light); font-size: 13px; margin: 0 0 16px 0; }
        .merchant-stats { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
        .stat-item { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--text-main); }
        .stat-item svg { color: var(--primary-gold); }
        .merchant-footer { margin-top: auto; padding-top: 12px; border-top: 1px dashed var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-light); }
        .merchant-footer span { font-weight: 600; color: var(--primary-dark); }
        .empty-state { text-align: center; padding: 48px 20px; background: #fff; border-radius: 16px; border: 1px dashed #cbd5e1; }
        .empty-icon { display: inline-flex; padding: 16px; background: #f8fafc; border-radius: 50%; color: #94a3b8; margin-bottom: 16px; }
        .empty-state h3 { font-size: 18px; color: var(--primary-dark); margin: 0 0 8px 0; }
        .empty-state p { color: var(--text-light); margin: 0 0 20px 0; font-size: 14px;}

        /* --- SHOWCASE SECTION --- */
        .showcase-section { padding: 40px 0 100px; }
        .showcase-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; background: #fff; border-radius: 32px; padding: 40px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
        .showcase-img { border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15); height: 460px; }
        .showcase-img img { width: 100%; height: 100%; object-fit: cover; }
        .showcase-copy .eyebrow { color: var(--primary-gold); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 12px;}
        .showcase-copy h2 { font-size: 32px; font-weight: 800; color: var(--primary-dark); margin: 0 0 16px 0; line-height: 1.2; }
        .showcase-copy > p { color: var(--text-light); font-size: 16px; margin: 0 0 32px 0; line-height: 1.6; }
        .model-tabs { display: flex; flex-direction: column; gap: 20px; margin-bottom: 32px; }
        .model-tab { display: flex; gap: 16px; align-items: flex-start; }
        .tab-icon { width: 44px; height: 44px; background: #f8fafc; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary-dark); flex-shrink: 0; border: 1px solid var(--border-color); }
        .model-tab h4 { font-size: 16px; font-weight: 700; color: var(--primary-dark); margin: 0 0 4px 0; }
        .model-tab p { font-size: 14px; color: var(--text-light); margin: 0; line-height: 1.5;}

        /* =========================================
           🚀 RESPONSIVE CHO MOBILE (CỰC ĐẸP)
           ========================================= */
        @media (max-width: 1024px) {
          .hero-content, .showcase-grid { grid-template-columns: 1fr; gap: 32px; }
          .hero-overlay { background: linear-gradient(180deg, rgba(15,23,42,0.7) 0%, rgba(15,23,42,0.95) 100%); }
          .hero-copy { text-align: center; }
          .hero-copy p { max-width: 100%; margin-left: auto; margin-right: auto; }
          .hero-actions { justify-content: center; }
          .hero-proof { justify-content: center; flex-wrap: wrap; }
          .features-grid { grid-template-columns: repeat(2, 1fr); }
          .showcase-grid { padding: 32px; gap: 40px; }
          .showcase-img { height: 360px; order: 2; }
          .showcase-copy { order: 1; text-align: center; }
          .model-tab { text-align: left; }
        }
        
        @media (max-width: 640px) {
          /* Thu nhỏ Hero lại cho vừa vặn màn hình */
          .hero-section { padding: 32px 0 56px; }
          .hero-copy h1 { font-size: 32px; }
          .hero-copy p { font-size: 15px; margin-bottom: 24px; }
          
          /* Kéo dài 2 nút bấm cho dễ bấm trên mobile */
          .hero-actions { flex-direction: column; width: 100%; gap: 12px; margin-bottom: 32px; }
          .btn-gold, .btn-glass { width: 100%; }

          /* Tối ưu lại thẻ tìm kiếm: Cuộn ngang thẻ tags */
          .discovery-card { padding: 20px; border-radius: 20px; }
          .discovery-head h2 { font-size: 18px; }
          .filter-tags { 
            flex-wrap: nowrap; 
            overflow-x: auto; 
            padding-bottom: 8px; /* Chừa không gian cho thanh cuộn ẩn */
            scrollbar-width: none; /* Ẩn scrollbar Firefox */
          }
          .filter-tags::-webkit-scrollbar { display: none; } /* Ẩn scrollbar Chrome/Safari */
          .filter-tags button { flex-shrink: 0; } /* Không ép móp nút khi trượt */

          /* Features & Merchant list */
          .features-grid { grid-template-columns: 1fr; gap: 20px;}
          .feature-card { display: flex; gap: 16px; align-items: flex-start; }
          .feature-card span { font-size: 32px; margin: 0; line-height: 1.2;}
          
          .section-header { flex-direction: column; align-items: flex-start; gap: 16px; }
          .btn-outline { width: 100%; text-align: center; }
          .merchants-grid { grid-template-columns: 1fr; }
          
          /* Thu nhỏ ảnh Showcase phía dưới để đỡ cồng kềnh */
          .showcase-grid { padding: 24px 20px; border-radius: 24px; }
          .showcase-copy h2 { font-size: 26px; }
          .showcase-img { height: 260px; border-radius: 16px; }
        }
      `}</style>

      {/* --- HERO SECTION --- */}
      <section className="hero-section">
        <div className="hero-bg-layer">
          {slides.map((item, index) => (
            <div 
              key={item.title} 
              className={`hero-bg-image ${slide === index ? 'active' : ''}`} 
              style={{ backgroundImage: `url(${item.image})` }} 
            />
          ))}
          <div className="hero-overlay" />
        </div>

        <div className="fh-container hero-content">
          <div className="hero-copy">
            <span className="kicker">{active.kicker}</span>
            <h1>{active.title}</h1>
            <p>{active.text}</p>
            <div className="hero-actions">
              <Link className="btn-gold" to="/register">Mở cửa hàng <ArrowRight size={18}/></Link>
              <a className="btn-glass" href="#merchants">Khám phá</a>
            </div>
            <div className="hero-proof">
              <div className="proof-item"><b><CheckCircle2 size={16}/> Realtime</b><small>Đơn & chat tức thì</small></div>
              <div className="proof-item"><b><CheckCircle2 size={16}/> QR tại bàn</b><small>Đúng bàn, đúng món</small></div>
              <div className="proof-item"><b><CheckCircle2 size={16}/> PWA</b><small>Cài như ứng dụng</small></div>
            </div>
          </div>

          <div className="discovery-card" role="search">
            <div className="discovery-head">
              <h2>Bạn muốn tìm gì hôm nay?</h2>
              <p>{filtered.length} địa điểm phù hợp đang sẵn sàng.</p>
            </div>
            
            <div className="search-field">
              <Search className="search-icon" size={20} />
              <input 
                value={query} 
                onChange={(event) => setQuery(event.target.value)} 
                onKeyDown={(event) => event.key === 'Enter' && goToResults()} 
                placeholder="Nhập tên nhà hàng, món ăn..." 
              />
              {query && (
                <button type="button" className="clear-btn" onClick={() => setQuery('')} aria-label="Xóa">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="filter-tags">
              {quickTags.map((item) => (
                <button 
                  type="button" 
                  key={item} 
                  className={tag === item ? 'active' : ''} 
                  onClick={() => setTag(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <button type="button" className="btn-search" onClick={goToResults}>
              Tìm kiếm ngay
            </button>
          </div>
        </div>

        <div className="hero-dots">
          {slides.map((item, index) => (
            <button 
              key={item.title} 
              className={index === slide ? 'active' : ''} 
              onClick={() => setSlide(index)} 
              aria-label={`Chuyển đến banner ${index + 1}`} 
            />
          ))}
        </div>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section className="features-section" id="features">
        <div className="fh-container features-grid">
          {[
            ['01','QR gọi món tại bàn','Khách quét đúng bàn, chọn món và gửi order tức thì xuống bếp.'],
            ['02','POS thanh toán','Theo dõi bàn, quản lý món và xác nhận thanh toán ngay tại quầy.'],
            ['03','Storefront luxury','Bố cục cao cấp, banner động và tối ưu trên mọi kích thước màn hình.'],
            ['04','Thông báo realtime','Badge số lượng chưa đọc, âm báo và thông báo đẩy của hệ thống.']
          ].map(([number,title,text]) => (
            <article key={number} className="feature-card">
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* --- MERCHANTS SECTION --- */}
      <section className="merchants-section bg-light" id="merchants">
        <div className="fh-container">
          <div className="section-header">
            <div>
              <span className="eyebrow">Curated merchants</span>
              <h2>Những không gian đang được yêu thích</h2>
              <p>Trải nghiệm mua hàng liền mạch trên điện thoại, tablet và máy tính.</p>
            </div>
            <Link className="btn-outline" to="/register">Trở thành đối tác</Link>
          </div>

          {filtered.length ? (
            <div className="merchants-grid">
              {filtered.map((shop) => {
                const target = usingFallback ? '/register' : (shop.customDomain ? `https://${shop.customDomain}` : `/shop/${shop.slug}`);
                const external = !usingFallback && Boolean(shop.customDomain);
                const isRestaurant = shop.businessType === 'restaurant';

                return (
                  <a className="merchant-card" href={target} key={shop._id} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
                    <div className="merchant-cover">
                      <img src={shop.bannerUrl || fallback[0].bannerUrl} alt={shop.name} loading="lazy" />
                      <div className="merchant-badge">
                        {isRestaurant ? <Utensils size={12}/> : <ShoppingBag size={12}/>}
                        {isRestaurant ? 'RESTAURANT' : 'BOUTIQUE'}
                      </div>
                    </div>
                    
                    <div className="merchant-body">
                      <img className="merchant-logo" src={shop.logoUrl || 'https://placehold.co/100x100/1b1712/f0d7a4?text=FH'} alt={`${shop.name} logo`} />
                      
                      <div className="merchant-info">
                        <h3>{shop.name}</h3>
                        <p>{shop.cuisine || 'Ẩm thực & mua sắm'}</p>
                        
                        <div className="merchant-stats">
                          <div className="stat-item">
                            <Star size={14} fill="currentColor" /> {shop.rating || 4.8}
                          </div>
                          <div className="stat-item" style={{color: '#64748b'}}>
                            <Clock size={14} /> {shop.deliveryTime || '25–40 phút'}
                          </div>
                          <div className="stat-item" style={{color: '#64748b'}}>
                            <Truck size={14} /> {Number(shop.deliveryFee || 0) ? money(shop.deliveryFee) : 'Freeship'}
                          </div>
                        </div>
                      </div>

                      <div className="merchant-footer">
                        <div>Có <span>{shop.productCount || 0}</span> sản phẩm</div>
                        <div>Giá từ <span>{money(shop.minPrice || 0)}</span></div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><Search size={32} /></div>
              <h3>Không tìm thấy cửa hàng nào</h3>
              <p>Thử sử dụng từ khóa khác hoặc xóa bộ lọc hiện tại.</p>
              <button className="btn-outline" style={{width: 'auto'}} onClick={() => { setQuery(''); setTag('Tất cả'); }}>Đặt lại bộ lọc</button>
            </div>
          )}
        </div>
      </section>

      {/* --- SHOWCASE SECTION --- */}
      <section className="showcase-section">
        <div className="fh-container">
          <div className="showcase-grid">
            <div className="showcase-img">
              <img src="https://images.unsplash.com/photo-1552566626-52f8b828add9?q=85&w=1400&auto=format&fit=crop" alt="Không gian nhà hàng sang trọng" loading="lazy" />
            </div>
            
            <div className="showcase-copy">
              <span className="eyebrow">One platform, two models</span>
              <h2>Được thiết kế cho cả dịch vụ tại bàn và thương mại giao hàng.</h2>
              <p>Bạn chỉ cần chọn đúng mô hình kinh doanh ngay khi đăng ký. Hệ thống sẽ tự động tạo luồng quản trị, phương thức thanh toán và trải nghiệm đặt hàng phù hợp nhất.</p>
              
              <div className="model-tabs">
                <article className="model-tab">
                  <div className="tab-icon"><Utensils size={20}/></div>
                  <div>
                    <h4>Nhà hàng & Quán cafe</h4>
                    <p>Hỗ trợ QR gọi món tại bàn, màn hình POS cho thu ngân, bán mang về và giao hàng tận nơi.</p>
                  </div>
                </article>
                <article className="model-tab">
                  <div className="tab-icon"><Store size={20}/></div>
                  <div>
                    <h4>Cửa hàng thương mại</h4>
                    <p>Tạo Storefront sang trọng, quản lý kho sản phẩm, vận chuyển và thông báo đơn hàng tự động.</p>
                  </div>
                </article>
              </div>
              
              <Link className="btn-gold" to="/register" style={{width: '100%'}}>Bắt đầu dùng thử miễn phí <ChevronRight size={18}/></Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;