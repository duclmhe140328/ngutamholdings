import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed
} from 'lucide-react';
import api from '../api/axios.js';

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const getCartKey = (slug, token) => `cart_${slug}_${token || 'public'}`;
const fallbackImage = 'https://placehold.co/1100x850/f6f1e8/8a6a3f?text=FoodHub';

const ProductDetail = ({ forcedSlug = '', customDomainMode = false }) => {
  const params = useParams();
  const slug = forcedSlug || params.slug;
  const id = params.id;
  const tableToken = params.tableToken;
  const [product, setProduct] = useState(null);
  const [table, setTable] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const storePath = tableToken
    ? (customDomainMode ? `/table/${tableToken}` : `/shop/${slug}/table/${tableToken}`)
    : (customDomainMode ? '/' : `/shop/${slug}`);

  useEffect(() => {
    setError('');
    Promise.all([
      api.get(`/products/${id}`),
      tableToken ? api.get(`/tables/public/${slug}/${tableToken}`) : Promise.resolve({ data: { table: null } })
    ]).then(([productRes, tableRes]) => {
      setProduct(productRes.data.product);
      setTable(tableRes.data.table || null);
      setActiveIndex(0);
    }).catch((err) => setError(err.message));
  }, [id, slug, tableToken]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(''), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);

  const images = useMemo(() => {
    const values = Array.isArray(product?.images) ? product.images : [];
    const unique = [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
    return unique.length ? unique : [fallbackImage];
  }, [product]);

  const finalPrice = useMemo(() => {
    if (!product) return 0;
    return Number(product.salePrice > 0 ? product.salePrice : product.price);
  }, [product]);

  const saving = product?.salePrice > 0 ? Math.max(0, Number(product.price || 0) - Number(product.salePrice || 0)) : 0;
  const activeImage = images[Math.min(activeIndex, images.length - 1)] || fallbackImage;

  const changeImage = (direction) => {
    if (images.length < 2) return;
    setActiveIndex((current) => (current + direction + images.length) % images.length);
  };

  const addToCart = () => {
    if (!product || product.stock <= 0) return;
    try {
      const saved = localStorage.getItem(getCartKey(slug, tableToken));
      const cart = saved ? JSON.parse(saved) : [];
      const existed = cart.find((item) => item.productId === product._id);
      const safeQuantity = Math.max(1, Number(quantity || 1));
      const nextCart = existed
        ? cart.map((item) => item.productId === product._id ? { ...item, quantity: Number(item.quantity || 0) + safeQuantity } : item)
        : [...cart, {
          productId: product._id,
          name: product.name,
          price: finalPrice,
          image: images[0] || '',
          quantity: safeQuantity
        }];
      localStorage.setItem(getCartKey(slug, tableToken), JSON.stringify(nextCart));
      setMessage(`Đã thêm ${safeQuantity} sản phẩm vào giỏ`);
    } catch {
      setMessage('Không thể cập nhật giỏ hàng trên trình duyệt này');
    }
  };

  if (error) return <div className="pd37-state"><div><b>Không mở được sản phẩm</b><p>{error}</p><Link to={storePath}>Quay lại cửa hàng</Link></div></div>;
  if (!product) return <div className="app-boot"><span>FH</span><p>Đang tải sản phẩm...</p></div>;

  return (
    <main className="pd37-page" style={{ '--pd37-brand': product.shopId?.themeColor || '#ba873c' }}>
      <style>{styles}</style>
      {message && <div className="pd37-toast"><Check size={18} />{message}</div>}

      <div className="pd37-shell">
        <nav className="pd37-nav">
          <Link to={storePath}><ArrowLeft size={18} />{table ? `Menu ${table.name}` : 'Cửa hàng'}</Link>
          {table && <span><UtensilsCrossed size={16} />Đang gọi món tại <b>{table.name}</b></span>}
        </nav>

        <section className="pd37-card">
          <div className="pd37-gallery">
            <div className="pd37-main-image">
              <img src={activeImage} alt={product.name} />
              {product.salePrice > 0 && <span className="pd37-sale"><Sparkles size={14} />Ưu đãi</span>}
              {images.length > 1 && <>
                <button type="button" className="pd37-arrow left" onClick={() => changeImage(-1)} aria-label="Ảnh trước"><ChevronLeft /></button>
                <button type="button" className="pd37-arrow right" onClick={() => changeImage(1)} aria-label="Ảnh sau"><ChevronRight /></button>
              </>}
            </div>
            <div className="pd37-thumbs">
              {images.map((image, index) => (
                <button type="button" key={`${image}-${index}`} className={index === activeIndex ? 'active' : ''} onClick={() => setActiveIndex(index)}>
                  <img src={image} alt={`${product.name} ${index + 1}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="pd37-info">
            <div className="pd37-topline">
              <span>{product.category || 'Sản phẩm nổi bật'}</span>
              <em className={product.stock > 0 ? 'available' : 'soldout'}>{product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Tạm hết hàng'}</em>
            </div>

            <h1>{product.name}</h1>
            <p className="pd37-description">{product.description || 'Sản phẩm được tuyển chọn kỹ lưỡng, chuẩn bị cẩn thận và phục vụ nhanh chóng.'}</p>

            <div className="pd37-price">
              <b>{formatMoney(finalPrice)}</b>
              {product.salePrice > 0 && <><del>{formatMoney(product.price)}</del><span>Tiết kiệm {formatMoney(saving)}</span></>}
            </div>

            <div className="pd37-benefits">
              <article><Store size={18} /><div><b>Thông tin rõ ràng</b><small>Giá và tồn kho được cập nhật trực tiếp từ cửa hàng.</small></div></article>
              <article><ShoppingBag size={18} /><div><b>Đặt nhanh</b><small>Thêm vào giỏ, áp mã giảm giá và thanh toán trong vài bước.</small></div></article>
            </div>

            <div className="pd37-buy-box">
              <label>Số lượng</label>
              <div className="pd37-buy-row">
                <div className="pd37-qty">
                  <button type="button" onClick={() => setQuantity((value) => Math.max(1, Number(value) - 1))}><Minus size={18} /></button>
                  <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))} />
                  <button type="button" onClick={() => setQuantity((value) => Number(value) + 1)}><Plus size={18} /></button>
                </div>
                <button type="button" className="pd37-add" disabled={product.stock <= 0} onClick={addToCart}>
                  <ShoppingBag size={19} />
                  <span>Thêm vào giỏ</span>
                  <b>{formatMoney(finalPrice * Math.max(1, Number(quantity || 1)))}</b>
                </button>
              </div>
            </div>

            <div className="pd37-note">
              <b>Gợi ý</b>
              <p>{table ? `Món này sẽ được ghi đúng vào hóa đơn ${table.name}. Bạn vẫn có thể gọi thêm món ở những lượt sau.` : 'Sau khi thêm vào giỏ, bạn có thể tiếp tục xem sản phẩm khác hoặc chuyển sang thanh toán.'}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

const styles = `
  .pd37-page{min-height:100dvh;padding:26px 0 64px;background:radial-gradient(circle at 8% 0%,rgba(190,137,59,.1),transparent 28rem),#f5f3ef;color:#201a14;font-family:Inter,system-ui,-apple-system,sans-serif}
  .pd37-page *{box-sizing:border-box}.pd37-shell{width:min(1160px,calc(100% - 32px));margin:0 auto}.pd37-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.pd37-nav>a,.pd37-nav>span{display:inline-flex;align-items:center;gap:8px}.pd37-nav>a{color:#5f574f;text-decoration:none;font-size:14px;font-weight:800}.pd37-nav>a:hover{color:#a06d27}.pd37-nav>span{padding:9px 13px;border:1px solid #e3d5bf;border-radius:999px;background:#fff9ec;color:#76541f;font-size:12px}.pd37-card{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(360px,.92fr);overflow:hidden;border:1px solid #e7dfd4;border-radius:28px;background:#fff;box-shadow:0 24px 70px rgba(58,43,25,.1)}
  .pd37-gallery{min-width:0;padding:22px;background:linear-gradient(145deg,#f8f5f0,#ede7dd)}.pd37-main-image{position:relative;display:grid;place-items:center;min-height:520px;overflow:hidden;border:1px solid rgba(126,102,70,.12);border-radius:22px;background:rgba(255,255,255,.72)}.pd37-main-image>img{width:100%;height:100%;max-height:590px;display:block;object-fit:contain;object-position:center;padding:8px}.pd37-sale{position:absolute;left:16px;top:16px;display:inline-flex;align-items:center;gap:6px;padding:8px 11px;border-radius:999px;background:#b84035;color:#fff;font-size:11px;font-weight:900;box-shadow:0 8px 22px rgba(184,64,53,.25)}.pd37-arrow{position:absolute;top:50%;width:42px;height:42px;display:grid;place-items:center;border:1px solid rgba(39,31,23,.12);border-radius:50%;background:rgba(255,255,255,.92);color:#282017;cursor:pointer;transform:translateY(-50%);box-shadow:0 8px 22px rgba(0,0,0,.12)}.pd37-arrow.left{left:14px}.pd37-arrow.right{right:14px}.pd37-thumbs{display:flex;gap:10px;overflow-x:auto;padding:13px 2px 2px;scrollbar-width:thin}.pd37-thumbs button{flex:0 0 76px;height:68px;padding:4px;overflow:hidden;border:2px solid transparent;border-radius:12px;background:#fff;cursor:pointer;opacity:.66}.pd37-thumbs button.active{border-color:#b48642;opacity:1;box-shadow:0 7px 18px rgba(145,98,34,.18)}.pd37-thumbs img{width:100%;height:100%;display:block;object-fit:contain;border-radius:8px;background:#f4f1ec}
  .pd37-info{min-width:0;display:flex;flex-direction:column;padding:34px}.pd37-topline{display:flex;align-items:center;justify-content:space-between;gap:12px}.pd37-topline>span{padding:7px 10px;border-radius:999px;background:#f7ecda;color:#8a5d20;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.pd37-topline>em{font-style:normal;font-size:11px;font-weight:800}.pd37-topline>em.available{color:#257455}.pd37-topline>em.soldout{color:#b13e36}.pd37-info h1{margin:20px 0 10px;font-family:'Playfair Display',Georgia,serif;font-size:clamp(31px,4vw,48px);line-height:1.08}.pd37-description{margin:0;color:#746b62;font-size:15px;line-height:1.7}.pd37-price{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:22px 0;padding:18px 0;border-top:1px solid #eee7df;border-bottom:1px solid #eee7df}.pd37-price>b{color:#b34135;font-size:31px}.pd37-price del{color:#a39b93;font-size:15px}.pd37-price span{margin-left:auto;padding:7px 9px;border-radius:8px;background:#fff0ed;color:#a43c33;font-size:10px;font-weight:900}.pd37-benefits{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pd37-benefits article{display:flex;gap:10px;padding:13px;border:1px solid #ece4da;border-radius:14px;background:#fbfaf8}.pd37-benefits svg{flex:0 0 auto;color:#a97935}.pd37-benefits b,.pd37-benefits small{display:block}.pd37-benefits b{font-size:12px}.pd37-benefits small{margin-top:4px;color:#81786f;font-size:10px;line-height:1.45}.pd37-buy-box{margin-top:22px}.pd37-buy-box>label{display:block;margin-bottom:8px;color:#6d6258;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.pd37-buy-row{display:grid;grid-template-columns:140px minmax(0,1fr);gap:11px}.pd37-qty{display:grid;grid-template-columns:42px 1fr 42px;overflow:hidden;border:1px solid #ded5ca;border-radius:13px;background:#fff}.pd37-qty button{border:0;background:#f7f4ef;cursor:pointer}.pd37-qty input{width:100%;min-width:0;border:0;text-align:center;font-size:16px;font-weight:900;outline:0}.pd37-add{min-height:56px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;padding:0 17px;border:0;border-radius:13px;background:linear-gradient(135deg,#bd8a40,#966528);color:#fff;cursor:pointer;box-shadow:0 13px 26px rgba(151,101,39,.25)}.pd37-add span{font-weight:900;text-align:left}.pd37-add b{font-size:13px}.pd37-add:disabled{background:#cac4bc;cursor:not-allowed;box-shadow:none}.pd37-note{margin-top:14px;padding:14px 16px;border:1px dashed #d8bd91;border-radius:14px;background:#fffaf1}.pd37-note b{color:#80591f;font-size:12px}.pd37-note p{margin:5px 0 0;color:#7b6b56;font-size:11px;line-height:1.55}.pd37-toast{position:fixed;top:20px;left:50%;z-index:1000;display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:999px;background:#1e513e;color:#fff;font-size:13px;font-weight:900;transform:translateX(-50%);box-shadow:0 16px 35px rgba(0,0,0,.22)}.pd37-state{min-height:100dvh;display:grid;place-items:center;padding:24px;background:#f5f3ef}.pd37-state>div{max-width:480px;padding:28px;border-radius:20px;background:#fff;text-align:center}.pd37-state b{font-size:22px}.pd37-state a{display:inline-flex;margin-top:10px;color:#946524;font-weight:900}
  @media(max-width:900px){.pd37-page{padding-top:16px}.pd37-card{grid-template-columns:1fr}.pd37-gallery{padding:14px}.pd37-main-image{min-height:420px}.pd37-info{padding:24px}.pd37-nav>span{display:none}}
  @media(max-width:560px){.pd37-shell{width:min(100% - 18px,1160px)}.pd37-card{border-radius:20px}.pd37-gallery{padding:9px}.pd37-main-image{min-height:330px;border-radius:16px}.pd37-main-image>img{max-height:410px;padding:4px}.pd37-thumbs button{flex-basis:62px;height:58px}.pd37-info{padding:20px 16px 22px}.pd37-info h1{font-size:30px}.pd37-price>b{font-size:26px}.pd37-price span{width:100%;margin-left:0;text-align:center}.pd37-benefits{grid-template-columns:1fr}.pd37-buy-row{grid-template-columns:1fr}.pd37-qty{min-height:48px}.pd37-add{min-height:54px}.pd37-nav{margin:0 4px 12px}.pd37-toast{top:calc(12px + env(safe-area-inset-top,0px));width:calc(100% - 24px);justify-content:center}}
`;

export default ProductDetail;
