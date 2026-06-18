import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios.js';
import MapPicker from '../components/MapPicker.jsx';
import PhoneOtpPanel, { loyaltyStorage } from '../components/PhoneOtpPanel.jsx';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const cartKey = (slug, token) => `cart_${slug}_${token || 'public'}`;
const labels = { dine_in: 'Ăn tại bàn', delivery: 'Giao tận nơi', pickup: 'Nhận tại cửa hàng', shipping: 'Gửi hàng', cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', vnpay: 'VNPAY' };
const emptyQuote = { subtotal: 0, deliveryFee: 0, deliveryDistanceKm: 0, couponDiscount: 0, coinsUsed: 0, coinDiscount: 0, totalAmount: 0 };

const Checkout = ({ forcedSlug = '', customDomainMode = false }) => {
  const params = useParams();
  const slug = forcedSlug || params.slug;
  const tableToken = params.tableToken;
  const [shop, setShop] = useState(null);
  const [table, setTable] = useState(null);
  const [vnpayConfigured, setVnpayConfigured] = useState(false);
  const [cart, setCart] = useState([]);
  const [identity, setIdentity] = useState(() => loyaltyStorage.get());
  const [wallet, setWallet] = useState(null);
  const [form, setForm] = useState({ customerName: '', phone: '', address: '', note: '', orderType: tableToken ? 'dine_in' : '', paymentMethod: '', couponCode: '', coinsToUse: 0, customerLatitude: '', customerLongitude: '' });
  const [quote, setQuote] = useState(emptyQuote);
  const [couponMessage, setCouponMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);

  const storePath = tableToken
    ? (customDomainMode ? `/table/${tableToken}` : `/shop/${slug}/table/${tableToken}`)
    : (customDomainMode ? '/' : `/shop/${slug}`);

  const loadWallet = async (currentIdentity, currentSlug = slug) => {
    if (!currentIdentity) { setWallet(null); return; }
    try {
      const res = await api.get(`/loyalty/${currentSlug}/wallet`, { headers: { 'x-loyalty-token': currentIdentity.token }, params: { phone: currentIdentity.phone } });
      setWallet(res.data);
    } catch { setWallet(null); }
  };

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem(cartKey(slug, tableToken)) || '[]')); } catch { setCart([]); }
    Promise.all([
      api.get(`/shops/${slug}`),
      tableToken ? api.get(`/tables/public/${slug}/${tableToken}`) : Promise.resolve({ data: { table: null } })
    ]).then(([shopRes, tableRes]) => {
      const currentShop = shopRes.data.shop;
      setShop(currentShop);
      setVnpayConfigured(Boolean(shopRes.data.vnpayConfigured));
      const currentTable = tableRes.data.table || null;
      setTable(currentTable);
      setForm((current) => ({
        ...current,
        customerName: current.customerName || (currentTable ? `Khách ${currentTable.name}` : ''),
        phone: current.phone || identity?.phone || '',
        orderType: tableToken ? 'dine_in' : currentShop.serviceModes?.[0] || 'shipping',
        paymentMethod: currentShop.paymentMethods?.[0] || 'cash'
      }));
      if (identity) loadWallet(identity, currentSlugSafe(currentShop.slug));
    }).catch((err) => setError(err.message));
  }, [slug, tableToken]);

  const currentSlugSafe = (value) => value || slug;
  const needsAddress = ['delivery', 'shipping'].includes(form.orderType);
  const phoneVerified = Boolean(identity?.token && identity?.phone === form.phone);
  const maxCoins = Math.min(Number(wallet?.account?.coinBalance || 0), Math.floor((Number(quote.subtotal || 0) + Number(quote.deliveryFee || 0) - Number(quote.couponDiscount || 0)) * Number(shop?.maxCoinUsePercent || 0) / 100));

  const quotePayload = (overrides = {}) => ({
    shopSlug: slug,
    orderType: form.orderType,
    phone: form.phone,
    items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    couponCode: form.couponCode,
    coinsToUse: form.coinsToUse,
    customerLatitude: form.customerLatitude,
    customerLongitude: form.customerLongitude,
    loyaltyToken: identity?.token,
    ...overrides
  });

  const refreshQuote = async (overrides = {}, showCouponResult = false) => {
    if (!shop || !cart.length || !form.orderType) return emptyQuote;
    setQuoting(true);
    try {
      const res = await api.post('/orders/quote', quotePayload(overrides), { headers: identity?.token ? { 'x-loyalty-token': identity.token } : {} });
      setQuote(res.data);
      if (showCouponResult) setCouponMessage(res.data.coupon ? `Đã áp dụng ${res.data.coupon.code}: giảm ${money(res.data.couponDiscount)}` : 'Không có mã giảm giá');
      return res.data;
    } catch (err) {
      if (showCouponResult) setCouponMessage(err.message);
      if (!showCouponResult && !String(err.message).includes('OTP')) setError(err.message);
      return emptyQuote;
    } finally { setQuoting(false); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => refreshQuote(), 350);
    return () => window.clearTimeout(timer);
  }, [shop?._id, form.orderType, form.customerLatitude, form.customerLongitude, form.coinsToUse, cart.length]);

  const onVerified = (value) => {
    setIdentity(value);
    setForm((current) => ({ ...current, phone: value.phone }));
    loadWallet(value);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (needsAddress && (!form.customerLatitude || !form.customerLongitude)) {
      setError('Vui lòng chọn vị trí nhận hàng trên bản đồ để tính phí ship');
      return;
    }
    setLoading(true);
    try {
      await refreshQuote({}, false);
      const res = await api.post('/orders', {
        shopSlug: slug,
        tableToken,
        customerName: form.customerName,
        phone: form.phone,
        address: form.address,
        note: form.note,
        orderType: form.orderType,
        paymentMethod: form.paymentMethod,
        couponCode: form.couponCode,
        coinsToUse: form.coinsToUse,
        customerLatitude: form.customerLatitude,
        customerLongitude: form.customerLongitude,
        loyaltyToken: identity?.token,
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity }))
      }, { headers: identity?.token ? { 'x-loyalty-token': identity.token } : {} });
      localStorage.removeItem(cartKey(slug, tableToken));
      setCart([]);
      if (res.data.paymentUrl) { window.location.assign(res.data.paymentUrl); return; }
      setSuccess(res.data.order);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  if (success) return (
    <section className="checkout-stage success-stage">
      <style>{`
        .success-stage { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fafafa; padding: 20px; font-family: system-ui, -apple-system, sans-serif; }
        .success-receipt { background: white; padding: 40px; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); text-align: center; max-width: 480px; width: 100%; border: 1px solid #eaeaea; }
        .success-icon { width: 64px; height: 64px; background: #10b981; color: white; border-radius: 50%; display: grid; place-items: center; margin: 0 auto 24px; font-size: 28px; font-weight: bold; }
        .success-receipt h1 { font-size: 24px; color: #1e293b; margin: 0 0 8px; font-weight: 700; }
        .success-receipt h2 { font-size: 32px; color: #000; margin: 16px 0; font-weight: 800; }
        .success-receipt p { color: #64748b; margin: 0; font-size: 15px; }
        .receipt-meta { display: flex; justify-content: center; gap: 8px; margin: 24px 0; flex-wrap: wrap; }
        .receipt-meta span { background: #f1f5f9; color: #475569; padding: 6px 12px; border-radius: 30px; font-size: 13px; font-weight: 500; }
        .earned-coin-preview { background: #fef3c7; color: #92400e; padding: 12px 16px; border-radius: 12px; font-size: 13px; margin-bottom: 24px; border: 1px dashed #fcd34d; text-align: left; line-height: 1.5; }
        .btn-gold { display: block; background: #000; color: #fff; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; transition: 0.2s; font-size: 15px; }
        .btn-gold:hover { background: #222; transform: translateY(-1px); }
      `}</style>
      <div className="success-receipt">
        <span className="success-icon">✓</span>
        <span style={{ fontSize: '12px', textTransform: 'uppercase', tracking: '0.1em', color: '#94a3b8', fontWeight: 600 }}>Order confirmed</span>
        <h1>{table ? `Đã gửi món tới ${table.name}` : 'Đặt hàng thành công'}</h1>
        <p>Mã đơn <b>#{success.orderCode}</b></p>
        <h2>{money(success.totalAmount)}</h2>
        <div className="receipt-meta">
          <span>{labels[success.orderType]}</span>
          <span>{labels[success.paymentMethod]}</span>
          <span>{success.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</span>
        </div>
        {success.loyaltyPhone && (
          <div className="earned-coin-preview">
            Sau khi đơn được xác nhận thanh toán, bạn sẽ nhận khoảng <b>{Math.floor((success.subtotal - success.couponDiscount - success.coinDiscount) * Number(shop?.cashbackPercent || 0) / 100).toLocaleString('vi-VN')} xu</b>.
          </div>
        )}
        <Link className="btn-gold" to={storePath}>Quay lại cửa hàng</Link>
      </div>
    </section>
  );

  if (!shop) return <div className="app-boot" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px', color: '#64748b' }}><span>FH</span><p>Đang tải thanh toán...</p></div>;

  return (
    <section className="checkout-stage checkout-v4 loyalty-checkout">
      <style>{`
        /* TỔNG THỂ & THƯƠNG HIỆU BAR */
        .checkout-stage { background: #f8fafc; min-height: 100vh; font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding-bottom: 60px; }
        .checkout-brand-bar { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 12px 0; sticky: top; z-index: 100; }
        .checkout-brand-bar .container { display: flex; align-items: center; justify-content: space-between; max-width: 1200px; margin: 0 auto; padding: 0 16px; }
        .checkout-brand-bar a { display: flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; }
        
        /* ĐÃ THU NHỎ LOGO XUỐNG CÂN ĐỐI */
        .checkout-brand-bar img { width: 42px; height: 42px; border-radius: 10px; object-fit: cover; border: 1px solid #e2e8f0; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .checkout-brand-bar span small { display: block; font-size: 11px; color: #64748b; font-weight: 400; }
        .checkout-brand-bar span b { font-size: 15px; color: #0f172a; font-weight: 700; }
        .checkout-brand-bar > span { font-size: 12px; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 20px; font-weight: 500; }

        /* BỐ CỤC SHELL CHÍNH */
        .checkout-shell { display: grid; grid-template-columns: 1fr 380px; gap: 32px; max-width: 1200px; margin: 32px auto 0; padding: 0 16px; align-items: start; }
        .checkout-main { background: transparent; }
        .back-link { display: inline-block; text-decoration: none; color: #64748b; font-size: 14px; margin-bottom: 16px; font-weight: 500; transition: 0.2s; }
        .back-link:hover { color: #000; }
        .checkout-title { margin-bottom: 24px; }
        .checkout-title h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin: 4px 0 6px 0; letter-spacing: -0.02em; }
        .checkout-title p { color: #64748b; margin: 0; font-size: 14px; }
        .eyebrow { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #b45309; letter-spacing: 0.05em; }

        /* CÁC KHỐI THÔNG TIN BLOCK */
        .checkout-block { background: #fff; border-radius: 20px; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); margin-bottom: 20px; }
        .checkout-block-title { display: flex; gap: 14px; margin-bottom: 20px; align-items: flex-start; }
        .checkout-block-title > span { width: 28px; height: 28px; background: #0f172a; color: #fff; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 700; flex-shrink: 0; margin-top: 2px; }
        .checkout-block-title h2 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
        .checkout-block-title p { color: #64748b; margin: 0; font-size: 13px; }

        /* CÁC THÀNH PHẦN GRID NHẬP LIỆU */
        .form-grid { display: grid; gap: 16px; margin-bottom: 16px; }
        .form-grid.two { grid-template-columns: 1fr 1fr; }
        label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; }
        input, textarea, select { width: 100%; border: 1px solid #cbd5e1; padding: 12px 14px; border-radius: 12px; font-size: 14px; background: #fff; transition: 0.2s; box-sizing: border-box; font-family: inherit; }
        input:focus, textarea:focus { border-color: #0f172a; outline: none; box-shadow: 0 0 0 3px rgba(15,23,42,0.06); }
        textarea { resize: none; height: 80px; }

        /* CHIPS LỰA CHỌN (SERVICE MODE) */
        .option-chip-grid { display: flex; gap: 10px; flex-wrap: wrap; }
        .option-chip-grid button { background: #fff; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 30px; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; color: #475569; }
        .option-chip-grid button.active { background: #0f172a; border-color: #0f172a; color: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .table-confirm-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 16px; margin-bottom: 20px; color: #166534; }
        .table-confirm-box b { font-size: 16px; display: block; margin: 2px 0; }

        /* HÀNG ÁP MÃ VÀ XU VÍ CỦA KHÁCH CHAT */
        .coupon-apply-row { display: flex; gap: 8px; }
        .coupon-apply-row input { text-transform: uppercase; font-weight: 600; }
        .coupon-apply-row button { background: #0f172a; color: white; border: none; padding: 0 20px; border-radius: 12px; font-weight: 600; cursor: pointer; font-size: 14px; transition: 0.2s; }
        .coupon-apply-row button:hover { background: #222; }
        .coupon-message { display: block; margin-top: 6px; font-size: 12px; color: #059669; font-weight: 500; }
        
        .coin-use-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 16px; margin-top: 16px; }
        .coin-use-card b { display: block; font-size: 14px; color: #0f172a; }
        .coin-use-card span { font-size: 12px; color: #64748b; }
        .coin-use-card input { width: 100px; padding: 8px 10px; text-align: center; font-weight: 700; }
        .coin-use-card button { background: #fff; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap; }
        .coin-use-card button:hover { background: #f1f5f9; border-color: #94a3b8; }
        .verified-phone-line { display: flex; justify-content: space-between; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 16px; border-radius: 12px; font-size: 13px; color: #15803d; font-weight: 600; margin-top: 12px; }

        /* DANH SÁCH PAYMENT METHOD */
        .checkout-payment-list { display: grid; gap: 10px; }
        .checkout-payment-list button { display: flex; align-items: center; text-align: left; background: #fff; border: 1px solid #cbd5e1; padding: 14px 16px; border-radius: 16px; cursor: pointer; transition: 0.2s; position: relative; gap: 14px; width: 100%; box-sizing: border-box; }
        .checkout-payment-list button > span { font-size: 22px; width: 36px; height: 36px; background: #f1f5f9; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; }
        .checkout-payment-list button b { display: block; font-size: 14px; color: #0f172a; margin-bottom: 2px; }
        .checkout-payment-list button small { font-size: 12px; color: #64748b; font-weight: 400; }
        .checkout-payment-list button i { position: absolute; right: 20px; font-style: normal; font-weight: bold; color: #0f172a; font-size: 18px; display: none; }
        .checkout-payment-list button.selected { border-color: #0f172a; background: rgba(15,23,42,0.01); box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .checkout-payment-list button.selected i { display: block; }
        
        .bank-transfer-card { background: #f8fafc; border: 1px dashed #cbd5e1; padding: 16px; border-radius: 16px; margin-top: 12px; }
        .bank-transfer-card span { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
        .bank-transfer-card h3 { margin: 4px 0 2px; font-size: 16px; color: #0f172a; font-weight: 700; }
        .bank-transfer-card b { font-size: 18px; color: #b45309; font-weight: 800; display: block; margin: 4px 0; }
        .bank-transfer-card p { margin: 0; font-size: 13px; color: #475569; text-transform: uppercase; font-weight: 500; }

        /* NÚT SUBMIT GỬI ĐƠN */
        .checkout-submit { background: #000; color: #fff; width: 100%; border: none; padding: 16px; border-radius: 16px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 12px; transition: 0.2s; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
        .checkout-submit:hover:not(:disabled) { background: #222; transform: translateY(-1px); }
        .checkout-submit:disabled { background: #cbd5e1; color: #94a3b8; cursor: not-allowed; box-shadow: none; }

        /* SIDEBAR TÓM TẮT ĐƠN HÀNG */
        .checkout-summary { background: #fff; border-radius: 24px; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.03); position: sticky; top: 100px; }
        .checkout-summary h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 4px 0 16px 0; }
        .checkout-summary-items { max-height: 240px; overflow-y: auto; margin-bottom: 20px; padding-right: 4px; }
        .summary-line { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; }
        .summary-line:last-child { margin-bottom: 0; border: none; padding-bottom: 0; }
        .summary-line img { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; background: #f8fafc; border: 1px solid #e2e8f0; flex-shrink: 0; }
        .summary-line > div { flex: 1; min-width: 0; }
        .summary-line b { display: block; font-size: 14px; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .summary-line span { font-size: 12px; color: #64748b; display: block; margin-top: 2px; }
        .summary-line strong { font-size: 14px; color: #0f172a; font-weight: 600; }

        .summary-totals { border-top: 2px solid #f1f5f9; padding-top: 16px; }
        .summary-totals p { display: flex; justify-content: space-between; font-size: 14px; margin: 0 0 10px 0; color: #475569; }
        .summary-totals p.discount { color: #059669; font-weight: 500; }
        .summary-totals p.grand { font-size: 18px; font-weight: 800; color: #0f172a; border-top: 1px solid #f1f5f9; padding-top: 14px; margin-top: 4px; margin-bottom: 0; }
        
        .cashback-preview { background: #fef3c7; color: #92400e; padding: 12px; border-radius: 12px; font-size: 12px; margin-top: 16px; font-weight: 500; border: 1px dashed #fcd34d; }
        .summary-note { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 16px; line-height: 1.4; }

        .alert { background: #fef2f2; border: 1px solid #fee2e2; color: #991b1b; padding: 14px 16px; border-radius: 12px; font-size: 14px; font-weight: 500; margin-bottom: 20px; }

        /* RESPONSIVE TRÊN MOBILE & TABLET SMALL */
        @media (max-width: 991px) {
          .checkout-shell { grid-template-columns: 1fr; gap: 24px; margin-top: 20px; }
          .checkout-summary { position: static; order: -1; } /* Đẩy phần tóm tắt đơn lên trên để khách dễ nhìn trên ĐT */
          .form-grid.two { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* BRAND BAR BANNER */}
      <div className="checkout-brand-bar">
        <div className="container">
          <Link to={storePath}>
            <img src={shop.logoUrl || 'https://placehold.co/80/17130f/efd7a6?text=FH'} alt="" />
            <span>
              <small>Đang thanh toán tại</small>
              <b>{shop.name}</b>
            </span>
          </Link>
        </div>
      </div>

      {/* CONTAINER CHÍNH */}
      <div className="container checkout-shell">
        <div className="checkout-main">
          <Link className="back-link" to={storePath}>← Quay lại cửa hàng</Link>
          <div className="checkout-title">
            <span className="eyebrow">Secure checkout</span>
            <h1>{table ? `Gọi món tại ${table.name}` : 'Hoàn tất đơn hàng'}</h1>
            <p>Áp dụng mã giảm giá, xu và phí giao theo vị trí thực tế.</p>
          </div>
          
          {error && <div className="alert error">{error}</div>}
          {!cart.length && <div className="alert error">Giỏ hàng đang trống. Hãy quay lại cửa hàng để chọn sản phẩm.</div>}
          
          <form onSubmit={submit}>
            {/* KHỐI 1: HÌNH THỨC NHẬN HÀNG */}
            {!table && (
              <div className="checkout-block">
                <div className="checkout-block-title">
                  <span>01</span>
                  <div>
                    <h2>Hình thức nhận hàng</h2>
                    <p>Chọn cách bạn muốn nhận đơn.</p>
                  </div>
                </div>
                <div className="option-chip-grid">
                  {shop.serviceModes.map((mode) => (
                    <button type="button" key={mode} className={form.orderType === mode ? 'active' : ''} onClick={() => setForm({ ...form, orderType: mode })}>{labels[mode]}</button>
                  ))}
                </div>
              </div>
            )}
            {table && <div className="table-confirm-box"><span>Đơn gọi món tại</span><b>{table.name}</b><small>Đơn sẽ xuất hiện ngay trên màn hình POS của quán.</small></div>}

            {/* KHỐI 2: THÔNG TIN KHÁCH HÀNG */}
            <div className="checkout-block">
              <div className="checkout-block-title">
                <span>{table ? '01' : '02'}</span>
                <div>
                  <h2>Thông tin khách hàng</h2>
                  <p>Số điện thoại đã xác thực dùng chung cho ví xu tại shop.</p>
                </div>
              </div>
              <div className="form-grid two">
                <div>
                  <label>Tên khách hàng</label>
                  <input required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Tên của bạn" />
                </div>
                <div>
                  <label>Số điện thoại</label>
                  <input required={needsAddress} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value, coinsToUse: 0 })} placeholder="09xxxxxxxx" />
                </div>
              </div>
              
              {!phoneVerified && <PhoneOtpPanel compact onVerified={onVerified} />}
              {phoneVerified && (
                <div className="verified-phone-line">
                  <span>✓ Đã xác thực {identity.phone}</span>
                  <b>{Number(wallet?.account?.coinBalance || 0).toLocaleString('vi-VN')} xu</b>
                </div>
              )}
              
              {needsAddress && (
                <>
                  <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                    <label>Địa chỉ nhận hàng</label>
                    <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Số nhà, đường, phường/xã..." />
                  </div>
                  <MapPicker latitude={form.customerLatitude} longitude={form.customerLongitude} onChange={(point) => setForm({ ...form, customerLatitude: point.latitude, customerLongitude: point.longitude })} title="Ghim vị trí nhận hàng" helper="Chạm đúng vị trí hoặc dùng GPS. Phí ship được tính theo khoảng cách ước tính từ cửa hàng." />
                </>
              )}
              
              <div style={{ marginTop: '14px' }}>
                <label>Ghi chú</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={table ? 'Ít cay, không hành...' : 'Thời gian giao, lưu ý đóng gói...'} />
              </div>
            </div>

            {/* KHỐI 3: ƯU ĐÃI & XU VÍ */}
            <div className="checkout-block loyalty-discount-block">
              <div className="checkout-block-title">
                <span>{table ? '02' : '03'}</span>
                <div>
                  <h2>Ưu đãi & xu</h2>
                  <p>1.000 xu tương đương 1.000đ.</p>
                </div>
              </div>
              <div className="coupon-apply-row">
                <input value={form.couponCode} onChange={(e) => setForm({ ...form, couponCode: e.target.value.toUpperCase() })} placeholder="Nhập mã giảm giá / voucher" />
                <button type="button" onClick={() => refreshQuote({}, true)}>Áp dụng</button>
              </div>
              {couponMessage && <small className="coupon-message">{couponMessage}</small>}
              
              {phoneVerified && (
                <div className="coin-use-card">
                  <div>
                    <b>Dùng xu trừ trực tiếp</b>
                    <span>Có {Number(wallet?.account?.coinBalance || 0).toLocaleString('vi-VN')} xu · tối đa {Number(shop.maxCoinUsePercent || 0)}% đơn</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="number" min="0" max={maxCoins} value={form.coinsToUse} onChange={(e) => setForm({ ...form, coinsToUse: Math.min(maxCoins, Math.max(0, Number(e.target.value || 0))) })} />
                    <button type="button" onClick={() => setForm({ ...form, coinsToUse: maxCoins })}>Dùng tối đa</button>
                  </div>
                </div>
              )}
            </div>

            {/* KHỐI 4: PHƯƠNG THỨC THANH TOÁN */}
            <div className="checkout-block">
              <div className="checkout-block-title">
                <span>{table ? '03' : '04'}</span>
                <div>
                  <h2>Phương thức thanh toán</h2>
                  <p>Chỉ hiển thị phương thức cửa hàng đang hỗ trợ.</p>
                </div>
              </div>
              <div className="checkout-payment-list">
                {shop.paymentMethods.map((method) => (
                  <button type="button" key={method} className={form.paymentMethod === method ? 'selected' : ''} onClick={() => setForm({ ...form, paymentMethod: method })}>
                    <span>{method === 'cash' ? '💵' : method === 'bank_transfer' ? '🏦' : '🔷'}</span>
                    <div>
                      <b>{labels[method]}</b>
                      <small>{method === 'cash' ? (table ? 'Thanh toán tại quầy/bàn' : 'Thanh toán khi nhận hàng') : method === 'bank_transfer' ? 'Chuyển vào tài khoản cửa hàng' : vnpayConfigured ? 'Thanh toán qua cổng VNPAY' : 'Hệ thống chưa cấu hình merchant'}</small>
                    </div>
                    <i>✓</i>
                  </button>
                ))}
              </div>
              {form.paymentMethod === 'bank_transfer' && (
                <div className="bank-transfer-card">
                  <span>Thông tin chuyển khoản</span>
                  <h3>{shop.bankName || 'Ngân hàng chưa cập nhật'}</h3>
                  <b>{shop.bankAccountNumber || '—'}</b>
                  <p>{shop.bankAccountName || '—'}</p>
                </div>
              )}
            </div>
            
            <button className="checkout-submit" disabled={loading || quoting || !cart.length || (form.paymentMethod === 'vnpay' && !vnpayConfigured)}>
              {loading ? 'Đang gửi đơn...' : quoting ? 'Đang tính tổng...' : table ? `Gửi order tới ${table.name}` : `Đặt hàng · ${money(quote.totalAmount)}`}
            </button>
          </form>
        </div>

        {/* SIDEBAR TÓM TẮT ĐƠN HÀNG (BÊN PHẢI HOẶC TRÊN CÙNG MOBILE) */}
        <aside className="checkout-summary">
          <span className="eyebrow">Order summary</span>
          <h2>Đơn của bạn</h2>
          <div className="checkout-summary-items">
            {cart.map((item) => (
              <div className="summary-line" key={item.productId}>
                <img src={item.image || 'https://placehold.co/100'} alt="" />
                <div>
                  <b>{item.name}</b>
                  <span>Số lượng: {item.quantity}</span>
                </div>
                <strong>{money(item.price * item.quantity)}</strong>
              </div>
            ))}
          </div>
          
          <div className="summary-totals">
            <p><span>Tạm tính</span><b>{money(quote.subtotal)}</b></p>
            {needsAddress && (
              <p><span>Phí ship {quote.deliveryDistanceKm ? `(${quote.deliveryDistanceKm} km)` : ''}</span><b>{quote.deliveryFee ? money(quote.deliveryFee) : '—'}</b></p>
            )}
            {quote.couponDiscount > 0 && <p className="discount"><span>Mã giảm giá</span><b>−{money(quote.couponDiscount)}</b></p>}
            {quote.coinDiscount > 0 && <p className="discount"><span>Xu đã dùng</span><b>−{money(quote.coinDiscount)}</b></p>}
            <p className="grand"><span>Tổng cộng</span><b>{money(quote.totalAmount)}</b></p>
          </div>
          
          {phoneVerified && (
            <div className="cashback-preview">
              Thanh toán xong nhận khoảng <b>{Math.floor(Math.max(0, quote.subtotal - quote.couponDiscount - quote.coinDiscount) * Number(shop.cashbackPercent || 0) / 100).toLocaleString('vi-VN')} xu</b>.
            </div>
          )}
          <div className="summary-note">🔒 Phí ship và ưu đãi được backend tính lại để tránh sửa giá từ trình duyệt.</div>
        </aside>
      </div>
    </section>
  );
};

export default Checkout;