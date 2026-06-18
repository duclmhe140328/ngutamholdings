import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios.js';

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const getCartKey = (slug, token) => `cart_${slug}_${token || 'public'}`;

const ProductDetail = ({ forcedSlug = '', customDomainMode = false }) => {
  const params = useParams();
  const slug = forcedSlug || params.slug;
  const id = params.id;
  const tableToken = params.tableToken;
  const [product, setProduct] = useState(null);
  const [table, setTable] = useState(null);
  const [activeImage, setActiveImage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const storePath = tableToken
    ? (customDomainMode ? `/table/${tableToken}` : `/shop/${slug}/table/${tableToken}`)
    : (customDomainMode ? '/' : `/shop/${slug}`);

  useEffect(() => {
    Promise.all([
      api.get(`/products/${id}`),
      tableToken ? api.get(`/tables/public/${slug}/${tableToken}`) : Promise.resolve({ data: { table: null } })
    ]).then(([productRes, tableRes]) => {
      setProduct(productRes.data.product);
      setActiveImage(productRes.data.product.images?.[0] || 'https://placehold.co/800x600?text=No+Image');
      setTable(tableRes.data.table || null);
    }).catch((err) => setError(err.message));
  }, [id, slug, tableToken]);

  const finalPrice = useMemo(() => {
    if (!product) return 0;
    return product.salePrice > 0 ? product.salePrice : product.price;
  }, [product]);

  const addToCart = () => {
    try {
      const saved = localStorage.getItem(getCartKey(slug, tableToken));
      const cart = saved ? JSON.parse(saved) : [];
      const existed = cart.find((item) => item.productId === product._id);
      const nextCart = existed
        ? cart.map((item) => item.productId === product._id ? { ...item, quantity: item.quantity + Number(quantity) } : item)
        : [...cart, { productId: product._id, name: product.name, price: finalPrice, image: product.images?.[0] || '', quantity: Number(quantity) }];

      localStorage.setItem(getCartKey(slug, tableToken), JSON.stringify(nextCart));
      setMessage('Đã thêm sản phẩm vào giỏ hàng');
      
      // Tự động ẩn thông báo sau 3 giây
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Không thể cập nhật giỏ hàng trên trình duyệt này');
    }
  };

  if (error) return <div className="container page-message"><div className="alert error">{error}</div></div>;
  if (!product) return <div className="app-boot"><span>FH</span><p>Đang tải sản phẩm...</p></div>;

  const infoPills = [
    product.category || 'Signature',
    product.stock > 0 ? 'Sẵn sàng phục vụ' : 'Tạm hết hàng',
    product.salePrice > 0 ? 'Có ưu đãi hôm nay' : 'Giá niêm yết rõ ràng'
  ];

  return (
    <>
      <style>{`
        :root {
          --primary-gold: #D4AF37;
          --primary-gold-hover: #C5A028;
          --text-main: #111827;
          --text-muted: #6B7280;
          --bg-main: transparent;
          --bg-card: #FFFFFF;
          --border-color: #E5E7EB;
          --success: #10B981;
          --danger: #EF4444;
          --border-radius-lg: 16px;
          --border-radius-md: 8px;
          --transition: all 0.2s ease;
        }

        .product-detail-stage-v2 {
          background-color: var(--bg-main);
          min-height: 100vh;
          padding: 2rem 0 4rem;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: var(--text-main);
        }

        .container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }

        /* Nav */
        .product-detail-nav-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .back-link {
          color: var(--text-muted);
          text-decoration: none;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          transition: var(--transition);
        }
        .back-link:hover { color: var(--text-main); transform: translateX(-4px); }

        .product-table-context {
          background: #FEF3C7;
          color: #92400E;
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        /* Alert */
        .alert {
          padding: 1rem;
          border-radius: var(--border-radius-md);
          margin-bottom: 1.5rem;
          font-weight: 500;
          text-align: center;
          animation: slideDown 0.3s ease;
        }
        @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .alert.success { background-color: #D1FAE5; color: #065F46; border: 1px solid #A7F3D0; }
        .alert.error { background-color: #FEE2E2; color: #991B1B; }

        /* Grid Layout */
        .product-detail-grid-v2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          align-items: start;
        }

        /* Left Image Panel */
        .product-gallery-card-v2 {
          position: sticky;
          top: 2rem;
          background: var(--bg-card);
          padding: 1rem;
          border-radius: var(--border-radius-lg);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
        }

        .product-gallery-main-wrap {
          position: relative;
          border-radius: var(--border-radius-md);
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .product-main-img {
          width: 100%;
          aspect-ratio: 1/1; /* Chuyển thành ảnh vuông cho đẹp giống food app */
          object-fit: cover;
          display: block;
          transition: transform 0.5s ease;
        }
        .product-gallery-main-wrap:hover .product-main-img { transform: scale(1.03); }

        .product-badge-sale {
          position: absolute;
          top: 1rem;
          left: 1rem;
          background: var(--danger);
          color: white;
          padding: 0.35rem 1rem;
          border-radius: 9999px;
          font-weight: bold;
          font-size: 0.85rem;
          box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);
          z-index: 2;
        }

        .product-thumbs {
          display: flex;
          gap: 0.75rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }
        .product-thumbs::-webkit-scrollbar { height: 4px; }
        .product-thumbs::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

        .product-thumbs button {
          flex: 0 0 70px;
          height: 70px;
          border: 2px solid transparent;
          border-radius: var(--border-radius-md);
          overflow: hidden;
          cursor: pointer;
          padding: 0;
          background: none;
          transition: var(--transition);
          opacity: 0.5;
        }
        .product-thumbs button.active, .product-thumbs button:hover { opacity: 1; border-color: var(--primary-gold); }
        .product-thumbs img { width: 100%; height: 100%; object-fit: cover; }

        /* Right Info Panel */
        .product-info-panel-v2 {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          background: var(--bg-card);
          padding: 2.5rem;
          border-radius: var(--border-radius-lg);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
        }

        .product-meta-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .category {
          color: var(--primary-gold);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-size: 0.85rem;
          background: #FFFBEB;
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
        }

        .stock-pill {
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .in-stock { background: #ECFDF5; color: var(--success); }
        .out-stock { background: #FEF2F2; color: var(--danger); }

        .product-info-panel-v2 h1 {
          font-size: 2.2rem;
          line-height: 1.3;
          margin: 0;
          font-weight: 800;
          color: var(--text-main);
        }

        .product-short-intro {
          color: var(--text-muted);
          font-size: 1.05rem;
          line-height: 1.6;
          margin: 0;
        }

        /* Giá tiền */
        .product-price-row-v2 {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-color);
        }
        .product-price-row-v2 b { font-size: 2.2rem; color: var(--danger); font-weight: 800; }
        .product-price-row-v2 del { font-size: 1.2rem; color: var(--text-muted); text-decoration: line-through; }
        .saving-chip {
          background: #FEF2F2;
          color: var(--danger);
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: bold;
          margin-left: auto;
        }

        /* Pill list */
        .product-pill-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }
        .product-pill-list span {
          background: #F3F4F6;
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          font-size: 0.85rem;
          color: #4B5563;
          font-weight: 500;
        }

        /* Trust Grid */
        .product-trust-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          background: #F9FAFB;
          padding: 1.2rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
        }
        .product-trust-grid article b { display: block; font-size: 0.95rem; margin-bottom: 0.3rem; color: var(--text-main); }
        .product-trust-grid article small { color: var(--text-muted); font-size: 0.85rem; line-height: 1.4; display: block; }

        /* =========================================
           FIX KHU VỰC THÊM VÀO GIỎ HÀNG TẠI ĐÂY
           ========================================= */
        .product-order-box {
          margin-top: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .product-order-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        /* Input số lượng */
        .quantity-picker {
          display: flex;
          align-items: center;
          background: #FFF;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
          height: 54px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .quantity-picker button {
          background: transparent;
          border: none;
          width: 44px;
          height: 100%;
          font-size: 1.5rem;
          font-weight: 400;
          color: var(--text-main);
          cursor: pointer;
          transition: var(--transition);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .quantity-picker button:hover { background: #F3F4F6; }

        .quantity-picker input {
          width: 50px;
          height: 100%;
          text-align: center;
          border: none;
          border-left: 1px solid var(--border-color);
          border-right: 1px solid var(--border-color);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-main);
          outline: none;
          background: transparent;
          -moz-appearance: textfield;
        }
        .quantity-picker input::-webkit-outer-spin-button,
        .quantity-picker input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

        /* Nút thêm vào giỏ */
        .btn-gold {
          flex: 1; /* Nút sẽ tự động kéo dài lấp đầy khoảng trống */
          background-color: var(--primary-gold);
          color: #FFF;
          border: none;
          height: 54px;
          border-radius: var(--border-radius-md);
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition);
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
          width: 100%; /* Đảm bảo an toàn không bị co */
          white-space: nowrap;
        }
        .btn-gold:hover:not(:disabled) { 
          background-color: var(--primary-gold-hover); 
          transform: translateY(-2px); 
          box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4); 
        }
        .btn-gold:disabled { background-color: #D1D5DB; cursor: not-allowed; box-shadow: none; color: #9CA3AF; }

        /* Ghi chú gợi ý */
        .product-note-box {
          background: #FFFBEB;
          border: 1px dashed var(--primary-gold);
          padding: 1.2rem;
          border-radius: 12px;
          margin-top: 0.5rem;
        }
        .product-note-box b { color: #92400E; display: block; margin-bottom: 0.4rem; font-size: 0.95rem; }
        .product-note-box p { color: #B45309; margin: 0; font-size: 0.9rem; line-height: 1.5; }

        /* Responsive */
        @media (max-width: 991px) {
          .product-detail-grid-v2 { grid-template-columns: 1fr; gap: 1.5rem; }
          .product-gallery-card-v2 { position: static; box-shadow: none; padding: 0; background: transparent; }
          .product-info-panel-v2 { padding: 1.5rem; }
          .product-price-row-v2 { flex-wrap: wrap; }
          .saving-chip { margin-left: 0; width: 100%; text-align: center; margin-top: 0.5rem; }
          .product-trust-grid { grid-template-columns: 1fr; }
          
          /* Ở mobile, gộp nút và số lượng nằm dọc nếu màn quá bé */
          .product-order-controls { flex-direction: column; align-items: stretch; }
          .quantity-picker { justify-content: space-between; width: 100%; }
          .quantity-picker input { flex: 1; }
        }
      `}</style>

      <section className="product-detail-stage product-detail-stage-v2">
        <div className="container product-detail-page">
          <div className="product-detail-nav-row">
            <Link to={storePath} className="back-link">← {table ? `Quay lại menu ${table.name}` : 'Quay lại cửa hàng'}</Link>
            {table && <span className="product-table-context"><i /> Đang đặt món tại bàn: <b>{table.name}</b></span>}
          </div>

          {message && <div className="alert success">{message}</div>}

          <div className="product-detail-grid product-detail-grid-v2">
            
            {/* CỘT TRÁI - HÌNH ẢNH */}
            <div className="product-gallery-card product-gallery-card-v2">
              <div className="product-gallery-main-wrap">
                <img className="product-main-img" src={activeImage} alt={product.name} />
                {product.salePrice > 0 && <span className="product-badge-sale">Ưu đãi</span>}
              </div>
              <div className="product-thumbs">
                {(product.images || []).map((image) => (
                  <button key={image} className={image === activeImage ? 'active' : ''} onClick={() => setActiveImage(image)}>
                    <img src={image} alt={product.name} />
                  </button>
                ))}
              </div>
            </div>

            {/* CỘT PHẢI - THÔNG TIN */}
            <div className="product-info-panel-v2">
              
              <div className="product-meta-top">
                <span className="category">{product.category || 'Sản phẩm nổi bật'}</span>
                <span className={`stock-pill ${product.stock > 0 ? 'in-stock' : 'out-stock'}`}>
                  {product.stock > 0 ? 'Còn hàng' : 'Hết hàng'}
                </span>
              </div>

              <h1>{product.name}</h1>
              <p className="product-short-intro">{product.description || 'Hương vị tuyệt hảo, được tuyển chọn và chuẩn bị kỹ lưỡng để mang đến trải nghiệm trọn vẹn nhất.'}</p>

              <div className="product-price-row-v2">
                <b>{formatMoney(finalPrice)}</b>
                {product.salePrice > 0 && <del>{formatMoney(product.price)}</del>}
                {product.salePrice > 0 && <span className="saving-chip">Tiết kiệm {formatMoney(product.price - product.salePrice)}</span>}
              </div>

              <div className="product-pill-list">
                {infoPills.map((item) => <span key={item}>{item}</span>)}
              </div>

              <div className="product-trust-grid">
                <article><b>Chất lượng tuyển chọn</b><small>Nguyên liệu tươi ngon, chế biến trong ngày.</small></article>
                <article><b>Đặt nhanh trên thiết bị</b><small>Thêm vào giỏ và thanh toán trong 3 bước.</small></article>
              </div>

              {/* KHU VỰC CHỌN MUA (Đã làm lại layout ngang sang trọng) */}
              <div className="product-order-box">
                <div className="product-order-controls">
                  
                  {/* Bộ đếm số lượng */}
                  <div className="quantity-picker">
                    <button onClick={() => setQuantity((value) => Math.max(1, Number(value) - 1))}>−</button>
                    <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))} />
                    <button onClick={() => setQuantity((value) => Number(value) + 1)}>+</button>
                  </div>
                  
                  {/* Nút thêm */}
                  <button className="btn-gold" disabled={product.stock <= 0} onClick={addToCart}>
                    Thêm vào giỏ · {formatMoney(finalPrice * quantity)}
                  </button>
                  
                </div>
              </div>

              <div className="product-note-box">
                <b>Gợi ý sử dụng</b>
                <p>{product.note || 'Sau khi chọn xong món này, bạn có thể xem tiếp thực đơn hoặc bấm vào biểu tượng giỏ hàng để hoàn tất đặt món ngay nhé.'}</p>
              </div>
              
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ProductDetail;