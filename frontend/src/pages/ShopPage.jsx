import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios.js';
import ShopChatWidget from '../components/ShopChatWidget.jsx';
import LoyaltyWidget from '../components/LoyaltyWidget.jsx';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const fallbackBgs = [
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=85&w=1900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?q=85&w=1900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=85&w=1900&auto=format&fit=crop'
];
const cartKey = (slug, token) => `cart_${slug}_${token || 'public'}`;

const ShopPage = ({ forcedSlug = '', customDomainMode = false }) => {
  const params = useParams();
  const slug = forcedSlug || params.slug;
  const tableToken = params.tableToken;
  const [shop, setShop] = useState(null);
  const [table, setTable] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [bgIndex, setBgIndex] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [addedName, setAddedName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    Promise.all([
      api.get(`/shops/${slug}`),
      api.get(`/products/shop/${slug}`),
      tableToken ? api.get(`/tables/public/${slug}/${tableToken}`) : Promise.resolve({ data: { table: null } })
    ]).then(([shopRes, productRes, tableRes]) => {
      setShop(shopRes.data.shop);
      setProducts(productRes.data.products || []);
      setTable(tableRes.data.table || null);
    }).catch((err) => setError(err.message));
  }, [slug, tableToken]);

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem(cartKey(slug, tableToken)) || '[]')); } catch { setCart([]); }
  }, [slug, tableToken]);

  useEffect(() => {
    if (!addedName) return undefined;
    const timer = window.setTimeout(() => setAddedName(''), 2200);
    return () => window.clearTimeout(timer);
  }, [addedName]);

  const backgrounds = useMemo(() => {
    const candidates = [
      shop?.backgroundImage1,
      shop?.backgroundImage2,
      shop?.backgroundImage3,
      shop?.bannerUrl,
      ...fallbackBgs
    ];

    // Chuẩn hóa và loại URL trùng nhau trước khi render.
    // Nhờ đó React không còn gặp nhiều phần tử có cùng key.
    return [...new Set(
      candidates
        .filter((image) => typeof image === 'string')
        .map((image) => image.trim())
        .filter(Boolean)
    )].slice(0, 3);
  }, [
    shop?.backgroundImage1,
    shop?.backgroundImage2,
    shop?.backgroundImage3,
    shop?.bannerUrl
  ]);

  useEffect(() => {
    if (backgrounds.length <= 1) {
      setBgIndex(0);
      return undefined;
    }

    // Đảm bảo index luôn hợp lệ nếu danh sách ảnh thay đổi.
    setBgIndex((current) => current % backgrounds.length);

    const timer = window.setInterval(() => {
      setBgIndex((current) => (current + 1) % backgrounds.length);
    }, 6200);

    return () => window.clearInterval(timer);
  }, [backgrounds]);

  const categories = useMemo(() => ['all', ...new Set(products.map((item) => item.category).filter(Boolean))], [products]);
  const filtered = useMemo(() => products.filter((item) => {
    const query = search.trim().toLowerCase();
    return (category === 'all' || item.category === category)
      && (!query || `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(query));
  }), [products, search, category]);

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const basePath = customDomainMode ? '' : `/shop/${slug}`;
  const checkoutPath = tableToken ? `${basePath}/table/${tableToken}/checkout` : `${basePath}/checkout`;
  const productPath = (id) => {
    if (customDomainMode) return tableToken ? `/table/${tableToken}/product/${id}` : `/product/${id}`;
    return tableToken ? `/shop/${slug}/table/${tableToken}/product/${id}` : `/shop/${slug}/product/${id}`;
  };

  const saveCart = (next) => {
    setCart(next);
    localStorage.setItem(cartKey(slug, tableToken), JSON.stringify(next));
  };

  const addToCart = (product) => {
    const price = Number(product.salePrice > 0 ? product.salePrice : product.price);
    const found = cart.find((item) => item.productId === product._id);
    const next = found
      ? cart.map((item) => item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...cart, { productId: product._id, name: product.name, image: product.images?.[0] || '', price, quantity: 1 }];
    saveCart(next);
    setAddedName(product.name);
  };

  const changeQty = (id, quantity) => {
    const next = cart
      .map((item) => item.productId === id ? { ...item, quantity: Math.max(0, Number(quantity)) } : item)
      .filter((item) => item.quantity > 0);
    saveCart(next);
  };

  if (error) return <div className="food-store-error"><div><img src="/icons/icon-192.png" width={80} height={80}/><h1>Không thể mở cửa hàng</h1><p>{error}</p><Link className="food-primary-button" to="/">Quay lại trang chủ</Link></div></div>;
  if (!shop) return <div className="app-boot"><img src="/icons/icon-192.png"  width={80} height={80}/><p>Đang chuẩn bị cửa hàng...</p></div>;

  return (
    <div className="food-store-page" style={{ '--food-brand': shop.themeColor || '#ee4d2d' }}>
      {addedName && <div className="food-added-toast">✓ Đã thêm <b>{addedName}</b> vào giỏ hàng</div>}

      <header className="food-store-header">
        <div className="container food-store-header-inner">
          <Link className="food-store-logo" to={basePath || '/'}>
            <img src={shop.logoUrl || 'https://placehold.co/120x120/ee4d2d/ffffff?text=FH'} alt={shop.name} />
            <span><b>{shop.name}</b><small>{shop.businessType === 'restaurant' ? 'Nhà hàng & giao món' : 'Cửa hàng trực tuyến'}</small></span>
          </Link>
          <div className="food-header-search">
            <span>⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={shop.businessType === 'restaurant' ? 'Tìm món ăn, đồ uống, combo...' : 'Tìm sản phẩm trong cửa hàng...'} />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">×</button>}
          </div>
          <div className="food-header-actions">
            {shop.phone && <a href={`tel:${shop.phone}`} className="food-contact-button"><span>☎</span><b>Liên hệ</b></a>}
            <button type="button" className="food-cart-button" onClick={() => setCartOpen(true)}><span>🛒</span><b>Giỏ hàng</b><em>{count}</em></button>
          </div>
        </div>
      </header>

      <section className="food-store-hero">
        <div className="food-store-slides">
          {backgrounds.map((image, index) => (
            <div
              key={`hero-slide-${index}-${image}`}
              className={index === bgIndex ? 'active' : ''}
              style={{ backgroundImage: `url(${image})` }}
              aria-hidden={index !== bgIndex}
            />
          ))}
          <span />
        </div>
        <div className="container food-store-hero-content">
          <div className="food-store-identity">
            <img src={shop.logoUrl || 'https://placehold.co/160x160/ee4d2d/ffffff?text=FH'} alt={shop.name} />
            <div>
              {table && <span className="food-table-badge">Đang gọi món tại <b>{table.name}</b></span>}
              <small>{shop.cuisine || (shop.businessType === 'restaurant' ? 'Ẩm thực tuyển chọn' : 'Sản phẩm tuyển chọn')}</small>
              <h1>{shop.name}</h1>
              <p>{shop.description || 'Đặt món và mua sắm nhanh chóng với thông tin rõ ràng, xác nhận realtime và trải nghiệm tối ưu trên mọi thiết bị.'}</p>
              <div className="food-store-meta">
                <span><b>★ {shop.rating || 4.8}</b><small>Đánh giá</small></span>
                <span><b>{shop.deliveryTime || '25–40 phút'}</b><small>Chuẩn bị</small></span>
                <span><b>{Number(shop.deliveryFee || 0) ? money(shop.deliveryFee) : 'Miễn phí'}</b><small>Phí giao</small></span>
                <span><b>{products.length}</b><small>Lựa chọn</small></span>
              </div>
            </div>
          </div>
          <div className="food-hero-promo">
            <span>ƯU ĐÃI HÔM NAY</span>
            <h2>Đặt nhanh, xác nhận ngay</h2>
            <p>{table ? `Mọi món sẽ tự gắn đúng ${table.name}.` : 'Chọn món, thêm vào giỏ và hoàn tất đơn chỉ trong vài bước.'}</p>
            <button type="button" onClick={() => document.getElementById('food-menu')?.scrollIntoView({ behavior: 'smooth' })}>Xem menu ↓</button>
          </div>
        </div>
        {backgrounds.length > 1 && (
          <div className="food-slide-dots">
            {backgrounds.map((image, index) => (
              <button
                type="button"
                key={`hero-dot-${index}-${image}`}
                className={index === bgIndex ? 'active' : ''}
                onClick={() => setBgIndex(index)}
                aria-label={`Chuyển đến ảnh nền ${index + 1}`}
                aria-current={index === bgIndex ? 'true' : undefined}
              />
            ))}
          </div>
        )}
      </section>

      

      <main className="container food-store-main" id="food-menu">
        <aside className="food-store-sidebar">
          <div className="food-sidebar-card">
            <span className="food-sidebar-label">DANH MỤC</span>
            <h2>Khám phá menu</h2>
            <div className="food-sidebar-categories">
              {categories.map((item) => (
                <button key={item} type="button" className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>
                  <span>{item === 'all' ? 'Tất cả sản phẩm' : item}</span><em>{item === 'all' ? products.length : products.filter((product) => product.category === item).length}</em>
                </button>
              ))}
            </div>
          </div>
          <div className="food-order-note">
            <span>{table ? 'QR TẠI BÀN' : 'ĐẶT HÀNG ONLINE'}</span>
            <b>{table ? `Đơn của ${table.name}` : 'Thông tin giao nhận'}</b>
            <p>{table ? 'Các món trong giỏ sẽ được gửi trực tiếp về POS và gắn đúng số bàn.' : shop.address || 'Cửa hàng sẽ xác nhận đơn ngay sau khi bạn hoàn tất.'}</p>
            {shop.minOrder > 0 && <small>Đơn tối thiểu {money(shop.minOrder)}</small>}
          </div>
        </aside>

        <section className="food-products-section">
          <div className="food-products-heading">
            <div><span>MÓN & SẢN PHẨM</span><h2>{category === 'all' ? 'Đang phục vụ hôm nay' : category}</h2><p>{search ? `Kết quả cho “${search}”` : 'Chọn món yêu thích và thêm ngay vào giỏ hàng.'}</p></div>
            <strong>{filtered.length} lựa chọn</strong>
          </div>

          <div className="food-product-grid">
            {filtered.map((product, productIndex) => {
              const price = product.salePrice > 0 ? product.salePrice : product.price;
              return (
                <article className="food-product-card" key={`${product._id || 'product'}-${productIndex}`}>
                  <Link className="food-product-image" to={productPath(product._id)}>
                    <img loading="lazy" decoding="async" src={product.images?.[0] || 'https://placehold.co/700x560/f7f3ed/ee4d2d?text=FoodHub'} alt={product.name} />
                    {product.salePrice > 0 && <span>Giảm giá</span>}
                    <em>♡</em>
                  </Link>
                  <div className="food-product-content">
                    <small>{product.category || 'Nổi bật'}</small>
                    <Link to={productPath(product._id)}><h3>{product.name}</h3></Link>
                    <p>{product.description || 'Món ngon được chuẩn bị kỹ lưỡng và phục vụ nhanh chóng.'}</p>
                    <div className="food-product-rating"><span>★ 4.8</span><em>Đã bán {Math.max(10, Number(product.stock || 0) + 18)}</em></div>
                    <div className="food-product-footer">
                      <div><b>{money(price)}</b>{product.salePrice > 0 && <del>{money(product.price)}</del>}</div>
                      <button type="button" onClick={() => addToCart(product)}><span>+</span> Thêm</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {!filtered.length && <div className="food-empty-state"><span>⌕</span><h3>Chưa tìm thấy sản phẩm phù hợp</h3><p>Hãy thử từ khóa khác hoặc chọn lại danh mục.</p><button type="button" onClick={() => { setSearch(''); setCategory('all'); }}>Xem toàn bộ menu</button></div>}
        </section>
      </main>

      <aside className={`food-cart-drawer ${cartOpen ? 'open' : ''}`} aria-hidden={!cartOpen}>
        <header><div><small>ĐƠN CỦA BẠN</small><h2>{table ? `Gọi món · ${table.name}` : 'Giỏ hàng'}</h2></div><button type="button" onClick={() => setCartOpen(false)} aria-label="Đóng giỏ hàng">×</button></header>
        <div className="food-cart-items">
          {cart.map((item, itemIndex) => (
            <article className="food-cart-line" key={`${item.productId || 'cart-item'}-${itemIndex}`}>
              <img loading="lazy" decoding="async" src={item.image || 'https://placehold.co/100'} alt={item.name || 'Sản phẩm trong giỏ'} />
              <div><b>{item.name}</b><span>{money(item.price)}</span><div><button type="button" onClick={() => changeQty(item.productId, item.quantity - 1)}>−</button><em>{item.quantity}</em><button type="button" onClick={() => changeQty(item.productId, item.quantity + 1)}>+</button></div></div>
              <strong>{money(item.price * item.quantity)}</strong>
            </article>
          ))}
          {!cart.length && <div className="food-empty-cart"><span>🛒</span><b>Giỏ hàng đang trống</b><p>Chọn món hoặc sản phẩm để bắt đầu đơn hàng.</p></div>}
        </div>
        <footer><div><span>Tạm tính</span><b>{money(total)}</b></div><Link className={!cart.length ? 'disabled' : ''} to={cart.length ? checkoutPath : '#'}>Tiếp tục đặt hàng</Link></footer>
      </aside>
      {cartOpen && <button type="button" className="food-cart-overlay" onClick={() => setCartOpen(false)} aria-label="Đóng giỏ hàng" />}

      <button type="button" className="food-floating-cart" onClick={() => setCartOpen(true)}><span>🛒</span><em>{count}</em><div><small>Tạm tính</small><b>{money(total)}</b></div></button>
      <LoyaltyWidget slug={slug} shop={shop} />
      <ShopChatWidget shop={shop} slug={slug} />
    </div>
  );
};

export default ShopPage;
