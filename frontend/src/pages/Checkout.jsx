import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios.js';
import MapPicker from '../components/MapPicker.jsx';
import PhoneOtpPanel, { loyaltyStorage } from '../components/PhoneOtpPanel.jsx';
import { getGuestId, getDiningContext, openOrResumeDiningSession } from '../utils/guestSession.js';
import { ChevronLeft, CheckCircle2, Ticket, Wallet, MapPin, Receipt, CreditCard, Clock, ChevronRight, User } from 'lucide-react';
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const cartKey = (slug, token) => `cart_${slug}_${token || 'public'}`;
const labels = {
  dine_in: 'Ăn tại bàn', delivery: 'Giao tận nơi', pickup: 'Nhận tại cửa hàng', shipping: 'Gửi hàng qua đơn vị VC',
  cash: 'Tiền mặt', pay_later: 'Gửi món, thanh toán sau', bank_transfer: 'Chuyển khoản QR', vnpay: 'VNPAY'
};
const emptyQuote = { subtotal: 0, deliveryFee: 0, deliveryDistanceKm: 0, couponDiscount: 0, coinsUsed: 0, coinDiscount: 0, totalAmount: 0 };

const Checkout = ({ forcedSlug = '', customDomainMode = false }) => {
  const params = useParams();
  const slug = forcedSlug || params.slug;
  const tableToken = params.tableToken;
  const [shop, setShop] = useState(null);
  const [table, setTable] = useState(null);
  const [vnpayConfigured, setVnpayConfigured] = useState(false);
  const [sepayConfigured, setSepayConfigured] = useState(false);
  const [cart, setCart] = useState([]);
  const [identity, setIdentity] = useState(() => loyaltyStorage.get());
  const [wallet, setWallet] = useState(null);
  const [form, setForm] = useState({ customerName: '', phone: '', address: '', note: '', orderType: tableToken ? 'dine_in' : '', paymentMethod: tableToken ? 'pay_later' : '', couponCode: '', coinsToUse: 0, customerLatitude: '', customerLongitude: '' });
  const [quote, setQuote] = useState(emptyQuote);
  const [couponMessage, setCouponMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [bankPayment, setBankPayment] = useState(null);
  const [paymentCheck, setPaymentCheck] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [diningContext, setDiningContext] = useState(() => getDiningContext(slug, tableToken));

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
      const currentTable = tableRes.data.table || null;
      setShop(currentShop);
      setTable(currentTable);
      setVnpayConfigured(Boolean(shopRes.data.vnpayConfigured));
      setSepayConfigured(Boolean(shopRes.data.sepayConfigured));
      const defaultMethod = currentTable ? 'pay_later' : (currentShop.paymentMethods?.[0] || 'cash');
      setForm((current) => ({
        ...current,
        customerName: current.customerName || (currentTable ? `Khách ${currentTable.name}` : ''),
        phone: current.phone || identity?.phone || '',
        orderType: currentTable ? 'dine_in' : currentShop.serviceModes?.[0] || 'shipping',
        paymentMethod: currentTable ? (['cash', 'pay_later'].includes(current.paymentMethod) ? current.paymentMethod : 'pay_later') : (current.paymentMethod || defaultMethod)
      }));
      if (identity) loadWallet(identity, currentShop.slug || slug);
    }).catch((err) => setError(err.message));
  }, [slug, tableToken]);

  useEffect(() => {
    if (!tableToken) { setDiningContext(null); return; }
    openOrResumeDiningSession({ slug, tableToken, loyaltyIdentity: identity }).then(setDiningContext).catch((err) => setError(err.message));
  }, [slug, tableToken]);

  const availablePaymentMethods = useMemo(() => {
    if (form.orderType === 'dine_in') return ['cash', 'pay_later'];
    return (shop?.paymentMethods || ['cash']).filter((method) => ['cash', 'bank_transfer', 'vnpay'].includes(method));
  }, [shop?.paymentMethods, form.orderType]);

  useEffect(() => {
    if (!availablePaymentMethods.includes(form.paymentMethod)) {
      setForm((current) => ({ ...current, paymentMethod: availablePaymentMethods[0] || 'cash' }));
    }
  }, [availablePaymentMethods.join('|')]);

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
      else if (!String(err.message).includes('OTP')) setError(err.message);
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
    if (tableToken) openOrResumeDiningSession({ slug, tableToken, loyaltyIdentity: value }).then(setDiningContext).catch(() => null);
  };

  const checkBankPayment = async () => {
    if (!bankPayment?.orderCode) return;
    setCheckingPayment(true);
    try {
      const res = await api.get(`/payments/order-status/${bankPayment.orderCode}`);
      setPaymentCheck(res.data);
      if (res.data.paymentStatus === 'paid') {
        setSuccess({ ...bankPayment.order, paymentStatus: 'paid', paidAt: res.data.paidAt });
        setBankPayment(null);
      }
    } catch (err) { setError(err.message); } finally { setCheckingPayment(false); }
  };

  useEffect(() => {
    if (!bankPayment?.orderCode) return undefined;
    const timer = window.setInterval(checkBankPayment, 3000);
    return () => window.clearInterval(timer);
  }, [bankPayment?.orderCode]);

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
        guestId: getGuestId(),
        guestSessionToken: diningContext?.guestSessionToken || '',
        diningSessionId: diningContext?.diningSessionId || '',
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
      if (res.data.bankTransfer) {
        setBankPayment({ ...res.data.bankTransfer, order: res.data.order });
        setPaymentCheck({ paymentStatus: res.data.order.paymentStatus, receivedAmount: 0, remainingAmount: res.data.order.totalAmount });
        return;
      }
      setSuccess(res.data.order);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  if (bankPayment) return (
    <div className="fhc-wrapper" style={{ '--brand': shop?.themeColor || '#f59e0b' }}>
      <style>{fhcStyles}</style>
      <section className="fhc-qr-stage">
        <div className="fhc-qr-card">
          <small>Chuyển khoản QR</small>
          <h2>Quét mã để thanh toán</h2>
          <p>Hệ thống tự đối soát giao dịch và lên đơn ngay lập tức.</p>
          {error && <div className="fhc-alert-error">{error}</div>}
          <img src={bankPayment.qrUrl} alt="QR chuyển khoản" />
          <div className="fhc-qr-info">
            <p><span>Ngân hàng</span><b>{bankPayment.bankName}</b></p>
            <p><span>Số tài khoản</span><b>{bankPayment.accountNumber}</b></p>
            <p><span>Chủ tài khoản</span><b>{bankPayment.accountName}</b></p>
            <p><span>Số tiền</span><b>{money(bankPayment.amount)}</b></p>
            <p><span>Nội dung bắt buộc</span><b className="fhc-copyable">{bankPayment.reference}</b></p>
          </div>
          <div className={`fhc-qr-status ${paymentCheck?.paymentStatus || 'pending'}`}>
            <span>{paymentCheck?.paymentStatus === 'partial' ? 'Đã nhận một phần' : 'Đang chờ xác nhận giao dịch'}</span>
            {paymentCheck?.receivedAmount > 0 && <b>Đã nhận {money(paymentCheck.receivedAmount)} · Cần chuyển thêm {money(paymentCheck.remainingAmount)}</b>}
            {!bankPayment.sepayEnabled && <small>Giao dịch thủ công, vui lòng giữ bill nếu cần.</small>}
          </div>
          <button className="fhc-btn-primary" onClick={checkBankPayment} disabled={checkingPayment}>
            {checkingPayment ? 'Đang kiểm tra...' : 'Tôi đã chuyển · Tải lại trạng thái'}
          </button>
          <Link className="fhc-btn-outline" to={storePath}>Quay lại cửa hàng</Link>
        </div>
      </section>
    </div>
  );

  if (success) return (
    <div className="fhc-wrapper" style={{ '--brand': shop?.themeColor || '#f59e0b' }}>
      <style>{fhcStyles}</style>
      <section className="fhc-qr-stage">
        <div className="fhc-qr-card fhc-success-card">
          <div className="fhc-success-icon"><CheckCircle2 size={40} /></div>
          <small>Hoàn tất đặt hàng</small>
          <h2>{table ? `Đã chuyển lệnh tới bếp · Bàn ${table.name}` : success.paymentStatus === 'paid' ? 'Thanh toán & đặt đơn thành công' : 'Đặt đơn thành công'}</h2>
          <div className="fhc-success-code">Mã đơn <b>#{success.orderCode}</b> {success.orderType === 'dine_in' && <span>(Lượt {success.orderRound || 1})</span>}</div>
          <h1 className="fhc-success-total">{money(success.totalAmount)}</h1>
          
          <div className="fhc-success-meta">
            <span>✓ {labels[success.orderType]}</span>
            <span>✓ {labels[success.paymentMethod]}</span>
            <span className={success.paymentStatus === 'paid' ? 'paid' : ''}>{success.paymentStatus === 'paid' ? '✓ Đã thanh toán' : '✗ Chưa thanh toán'}</span>
          </div>

          {success.loyaltyPhone && (
            <div className="fhc-success-cashback">
              <Award size={16} /> Nhận khoảng <b>{Math.floor((success.subtotal - success.couponDiscount - success.coinDiscount) * Number(shop?.cashbackPercent || 0) / 100).toLocaleString('vi-VN')} xu</b> sau khi đơn giao thành công.
            </div>
          )}
          <Link className="fhc-btn-primary" to={storePath}>Tiếp tục mua sắm / Gọi thêm món</Link>
        </div>
      </section>
    </div>
  );

  if (!shop) return <div className="fhc-wrapper" style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f8fafc', color:'#64748b', fontWeight:500, fontFamily:'system-ui'}}>Đang tải trang thanh toán...</div>;

  return (
    <div className="fhc-wrapper" style={{ '--brand': shop.themeColor || '#f59e0b' }}>
      <style>{fhcStyles}</style>
      
      {/* HEADER LUXURY MỚI */}
      <header className="fhc-header">
        <div className="fhc-container fhc-header-inner">
          <Link to={storePath} className="fhc-header-logo">
            <img src={shop.logoUrl || 'https://placehold.co/80'} alt="Logo" />
            <div className="fhc-header-text">
              <small>Thanh toán bảo mật</small>
              <b>{shop.name}</b>
            </div>
          </Link>
          <div className="fhc-header-secure">
             <span>✓ 1 xu = 1 VNĐ</span>
             <span>✓ Realtime</span>
          </div>
        </div>
      </header>

      <main className="fhc-container fhc-layout">
        <div className="fhc-main-col">
          <div className="fhc-title-row">
            <Link className="fhc-back-btn" to={storePath}><ChevronLeft size={16} /> Quay lại</Link>
            <h1>{table ? `Xác nhận gọi món tại ${table.name}` : 'Thông tin đặt hàng'}</h1>
            <p>{table ? 'Bạn có thể thanh toán tại quầy hoặc gửi món và thanh toán sau.' : 'Vui lòng điền đầy đủ thông tin nhận hàng và ưu đãi.'}</p>
          </div>

          {error && <div className="fhc-alert-error">{error}</div>}
          {!cart.length && <div className="fhc-alert-error">Giỏ hàng đang trống. Vui lòng quay lại cửa hàng.</div>}

          <form id="checkout-form" onSubmit={submit}>
            
            {/* THẺ 1: HÌNH THỨC NHẬN HÀNG */}
            {!table && (
              <section className="fhc-card">
                <div className="fhc-card-title"><MapPin size={20} /> Phương thức nhận hàng</div>
                <div className="fhc-chip-grid">
                  {shop.serviceModes.map((mode) => (
                    <button type="button" key={mode} className={form.orderType === mode ? 'active' : ''} onClick={() => setForm({ ...form, orderType: mode })}>
                      {labels[mode]}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {table && (
              <section className="fhc-card fhc-table-alert">
                <span>Thông tin bàn</span>
                <b>Đơn gọi tại {table.name}</b>
                <small>Mọi món bạn chọn sẽ được ghi nhận trực tiếp vào hóa đơn của bàn này.</small>
              </section>
            )}

            {/* THẺ 2: THÔNG TIN KHÁCH HÀNG */}
            <section className="fhc-card">
              <div className="fhc-card-title"><User size={20} /> Thông tin liên hệ</div>
              <div className="fhc-form-row">
                <div className="fhc-input-group">
                  <label>Tên người nhận</label>
                  <input required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Ví dụ: Lê Minh Đức" />
                </div>
                <div className="fhc-input-group">
                  <label>Số điện thoại</label>
                  <input required={needsAddress} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value, coinsToUse: 0 })} placeholder="09xx..." />
                </div>
              </div>

              {!phoneVerified && <PhoneOtpPanel compact onVerified={onVerified} />}
              {phoneVerified && (
                <div className="fhc-verified-badge">
                  <span><CheckCircle2 size={16}/> SĐT đã được xác thực hệ thống.</span>
                  <b>{Number(wallet?.account?.coinBalance || 0).toLocaleString('vi-VN')} Xu khả dụng</b>
                </div>
              )}

              {needsAddress && (
                <>
                  <div className="fhc-input-group" style={{marginTop: '16px'}}>
                    <label>Địa chỉ nhận hàng (Bắt buộc)</label>
                    <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Số nhà, đường, phường, quận..." />
                  </div>
                  <div style={{marginTop: '16px', borderRadius: '12px', overflow: 'hidden'}}>
                    <MapPicker latitude={form.customerLatitude} longitude={form.customerLongitude} onChange={(point) => setForm({ ...form, customerLatitude: point.latitude, customerLongitude: point.longitude })} title="Ghim bản đồ để tính phí ship tự động" helper="Chạm đúng vị trí giao." />
                  </div>
                </>
              )}

              <div className="fhc-input-group" style={{marginTop: '16px'}}>
                <label>Ghi chú đơn hàng (Không bắt buộc)</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={table ? 'Ví dụ: ít cay, nhiều đá...' : 'Lưu ý giao hàng...'} />
              </div>
            </section>

            {/* THẺ 3: ƯU ĐÃI & XU */}
            <section className="fhc-card">
               <div className="fhc-card-title"><Ticket size={20} /> Mã giảm giá & Tích lũy</div>
               <div className="fhc-coupon-row">
                 <input value={form.couponCode} onChange={(e) => setForm({ ...form, couponCode: e.target.value.toUpperCase() })} placeholder="Nhập mã (Voucher)" />
                 <button type="button" onClick={() => refreshQuote({}, true)}>Áp dụng</button>
               </div>
               {couponMessage && <div className="fhc-coupon-msg">{couponMessage}</div>}

               {phoneVerified && (
                 <div className="fhc-coin-box">
                   <div className="fhc-coin-head">
                     <Wallet size={16} /> 
                     <div>
                        <b>Dùng xu (1 Xu = 1 VNĐ)</b>
                        <small>Tối đa {Number(shop.maxCoinUsePercent || 0)}% hóa đơn.</small>
                     </div>
                   </div>
                   <div className="fhc-coin-actions">
                     <input type="number" min="0" max={maxCoins} value={form.coinsToUse} onChange={(e) => setForm({ ...form, coinsToUse: Math.min(maxCoins, Math.max(0, Number(e.target.value || 0))) })} />
                     <button type="button" onClick={() => setForm({ ...form, coinsToUse: maxCoins })}>Dùng tối đa</button>
                   </div>
                 </div>
               )}
            </section>

            {/* THẺ 4: THANH TOÁN */}
            <section className="fhc-card">
              <div className="fhc-card-title"><CreditCard size={20} /> Thanh toán</div>
              <div className="fhc-payment-grid">
                {availablePaymentMethods.map((method) => (
                  <button type="button" key={method} className={form.paymentMethod === method ? 'active' : ''} onClick={() => setForm({ ...form, paymentMethod: method })}>
                    <div className="fhc-pm-icon">
                      {method === 'cash' ? '💵' : method === 'pay_later' ? '🧾' : method === 'bank_transfer' ? '▦' : '💳'}
                    </div>
                    <div className="fhc-pm-text">
                      <b>{labels[method]}</b>
                      <small>{method === 'pay_later' ? 'Gửi lệnh tới bếp, tính tiền cuối giờ.' : method === 'bank_transfer' ? (sepayConfigured ? 'Auto đối soát SePay' : 'Quét QR') : 'Bảo mật tuyệt đối'}</small>
                    </div>
                    <div className="fhc-radio-btn"></div>
                  </button>
                ))}
              </div>
            </section>

          </form>
        </div>

        {/* CỘT PHẢI: SUMMARY (DÍNH) */}
        <aside className="fhc-side-col">
          <div className="fhc-summary-card">
            <h2>Hóa đơn của bạn</h2>
            <div className="fhc-summary-items">
              {cart.map((item) => (
                <div className="fhc-summary-item" key={item.productId}>
                  <img src={item.image || 'https://placehold.co/100'} alt="" />
                  <div>
                    <b>{item.name}</b>
                    <small>Số lượng: {item.quantity}</small>
                    <span>{money(item.price * item.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="fhc-summary-calc">
              <p><span>Tạm tính món</span> <b>{money(quote.subtotal)}</b></p>
              {needsAddress && <p><span>Phí giao hàng {quote.deliveryDistanceKm ? `(${quote.deliveryDistanceKm} km)` : ''}</span> <b>{quote.deliveryFee ? money(quote.deliveryFee) : '—'}</b></p>}
              {quote.couponDiscount > 0 && <p className="discount"><span>Voucher</span> <b>−{money(quote.couponDiscount)}</b></p>}
              {quote.coinDiscount > 0 && <p className="discount"><span>Dùng xu</span> <b>−{money(quote.coinDiscount)}</b></p>}
            </div>

            <div className="fhc-summary-total">
              <span>Tổng thanh toán</span>
              <b>{money(quote.totalAmount)}</b>
            </div>

            <button form="checkout-form" type="submit" className="fhc-btn-primary full" disabled={loading || quoting || !cart.length || (form.paymentMethod === 'vnpay' && !vnpayConfigured)}>
              {loading ? 'Đang xử lý...' : quoting ? 'Tính toán giá...' : table ? `Gửi Order ${form.paymentMethod === 'pay_later' ? '(Thanh toán sau)' : ''}` : `Thanh toán ${money(quote.totalAmount)}`}
            </button>
            <p className="fhc-secure-note">🔒 Thông tin mã hóa chuẩn SSL 256-bit.</p>
          </div>
        </aside>
      </main>
    </div>
  );
};

/* --- CSS DÀNH RIÊNG CHO CHECKOUT LUXURY (ISOLATED) --- */
const fhcStyles = `
  .fhc-wrapper {
    font-family: system-ui, -apple-system, sans-serif;
    background: #f8fafc;
    min-height: 100vh;
    color: #0f172a;
  }
  .fhc-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 20px;
  }

  /* HEADER */
  .fhc-header {
    background: #fff;
    border-bottom: 1px solid #e2e8f0;
    position: sticky;
    top: 0; z-index: 100;
  }
  .fhc-header-inner {
    display: flex; justify-content: space-between; align-items: center;
    height: 70px;
  }
  .fhc-header-logo {
    display: flex; align-items: center; gap: 12px; text-decoration: none; color: inherit;
  }
  .fhc-header-logo img {
    width: 40px; height: 40px; border-radius: 10px; object-fit: cover; border: 1px solid #e2e8f0;
  }
  .fhc-header-text { display: flex; flex-direction: column; }
  .fhc-header-text small { font-size: 11px; color: var(--brand); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;}
  .fhc-header-text b { font-size: 16px; font-weight: 800; line-height: 1.2;}
  .fhc-header-secure { display: flex; gap: 16px; font-size: 13px; font-weight: 600; color: #64748b;}

  /* LAYOUT CHÍNH */
  .fhc-layout {
    display: flex; gap: 32px; padding-top: 32px; padding-bottom: 64px; align-items: flex-start;
  }
  .fhc-main-col { flex: 1; min-width: 0;}
  .fhc-side-col { width: 380px; flex-shrink: 0; position: sticky; top: 94px;}

  /* TITLE */
  .fhc-title-row { margin-bottom: 24px; }
  .fhc-back-btn { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 600; color: #64748b; text-decoration: none; margin-bottom: 12px; transition: color 0.2s;}
  .fhc-back-btn:hover { color: var(--brand); }
  .fhc-title-row h1 { font-size: 28px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.5px;}
  .fhc-title-row p { font-size: 14px; color: #64748b; margin: 0;}

  /* CARDS */
  .fhc-card {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px;
    margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);
  }
  .fhc-card-title {
    font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 10px; margin-bottom: 20px;
    padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; color: #0f172a;
  }
  .fhc-card-title svg { color: var(--brand); }

  /* FORMS & CHIPS */
  .fhc-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .fhc-input-group { display: flex; flex-direction: column; gap: 8px;}
  .fhc-input-group label { font-size: 13px; font-weight: 700; color: #334155; }
  .fhc-input-group input, .fhc-input-group textarea {
    padding: 14px 16px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14px; font-family: inherit;
    outline: none; transition: all 0.2s; background: #f8fafc;
  }
  .fhc-input-group input:focus, .fhc-input-group textarea:focus { border-color: var(--brand); background: #fff; box-shadow: 0 0 0 3px rgba(245,158,11,0.1); }
  .fhc-input-group textarea { resize: vertical; min-height: 80px; }

  .fhc-chip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .fhc-chip-grid button {
    background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 12px; font-size: 14px;
    font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.2s;
  }
  .fhc-chip-grid button:hover { background: #f1f5f9; border-color: #cbd5e1; }
  .fhc-chip-grid button.active { background: #fffbeb; border-color: var(--brand); color: var(--brand); }

  .fhc-table-alert { background: #fffbeb; border-color: #fde68a; display: flex; flex-direction: column; }
  .fhc-table-alert span { font-size: 12px; font-weight: 700; color: #d97706; text-transform: uppercase; letter-spacing: 0.5px;}
  .fhc-table-alert b { font-size: 20px; color: #b45309; margin: 4px 0; }
  .fhc-table-alert small { font-size: 13px; color: #92400e; line-height: 1.5; }

  /* COUPON & XU */
  .fhc-coupon-row { display: flex; gap: 12px; }
  .fhc-coupon-row input { flex: 1; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 12px; text-transform: uppercase; font-weight: 600; outline: none;}
  .fhc-coupon-row input:focus { border-color: var(--brand); }
  .fhc-coupon-row button { padding: 0 24px; background: #0f172a; color: #fff; font-weight: 600; border: none; border-radius: 12px; cursor: pointer; }
  .fhc-coupon-msg { font-size: 13px; color: #10b981; font-weight: 600; margin-top: 10px; display: inline-block; background: #dcfce7; padding: 6px 12px; border-radius: 8px;}

  .fhc-coin-box { margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 16px; border: 1px dashed #cbd5e1; }
  .fhc-coin-head { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
  .fhc-coin-head svg { color: var(--brand); margin-top: 2px;}
  .fhc-coin-head b { display: block; font-size: 14px; color: #0f172a; margin-bottom: 2px;}
  .fhc-coin-head small { font-size: 13px; color: #64748b;}
  .fhc-coin-actions { display: flex; gap: 12px;}
  .fhc-coin-actions input { width: 120px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; outline:none;}
  .fhc-coin-actions button { padding: 0 16px; background: transparent; border: 1px solid var(--brand); color: var(--brand); font-weight: 600; border-radius: 8px; cursor: pointer;}
  
  .fhc-verified-badge { background: #dcfce7; border: 1px solid #bbf7d0; padding: 12px 16px; border-radius: 12px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center;}
  .fhc-verified-badge span { font-size: 13px; font-weight: 700; color: #166534; display: flex; align-items: center; gap: 6px;}
  .fhc-verified-badge b { font-size: 14px; font-weight: 800; color: #15803d;}

  /* PHƯƠNG THỨC THANH TOÁN */
  .fhc-payment-grid { display: flex; flex-direction: column; gap: 12px;}
  .fhc-payment-grid button {
    display: flex; align-items: center; gap: 16px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 16px;
    background: #fff; cursor: pointer; text-align: left; transition: all 0.2s;
  }
  .fhc-payment-grid button:hover { border-color: #cbd5e1; background: #f8fafc;}
  .fhc-payment-grid button.active { border-color: var(--brand); background: #fffbeb; box-shadow: 0 4px 12px rgba(245,158,11,0.1);}
  .fhc-pm-icon { font-size: 24px; line-height: 1; flex-shrink: 0;}
  .fhc-pm-text { flex: 1; }
  .fhc-pm-text b { display: block; font-size: 15px; color: #0f172a; margin-bottom: 4px;}
  .fhc-pm-text small { font-size: 13px; color: #64748b;}
  .fhc-radio-btn { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #cbd5e1; flex-shrink: 0; display: flex; align-items: center; justify-content: center;}
  .fhc-payment-grid button.active .fhc-radio-btn { border-color: var(--brand); }
  .fhc-payment-grid button.active .fhc-radio-btn::after { content: ''; width: 10px; height: 10px; background: var(--brand); border-radius: 50%; }

  /* SUMMARY CARD */
  .fhc-summary-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
  .fhc-summary-card h2 { font-size: 20px; font-weight: 800; margin: 0 0 20px 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;}
  
  .fhc-summary-items { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; max-height: 300px; overflow-y: auto;}
  .fhc-summary-item { display: flex; gap: 12px; align-items: center; }
  .fhc-summary-item img { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; background: #f1f5f9; border: 1px solid #e2e8f0;}
  .fhc-summary-item div { display: flex; flex-direction: column; flex: 1; min-width: 0;}
  .fhc-summary-item b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;}
  .fhc-summary-item small { font-size: 12px; color: #64748b; margin-bottom: 4px;}
  .fhc-summary-item span { font-size: 14px; font-weight: 700; color: var(--brand); }

  .fhc-summary-calc { display: flex; flex-direction: column; gap: 12px; padding: 20px 0; border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; margin-bottom: 20px;}
  .fhc-summary-calc p { display: flex; justify-content: space-between; margin: 0; font-size: 14px; color: #475569;}
  .fhc-summary-calc p b { font-weight: 700; color: #0f172a; }
  .fhc-summary-calc p.discount { color: #10b981; }
  .fhc-summary-calc p.discount b { color: #10b981; }

  .fhc-summary-total { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;}
  .fhc-summary-total span { font-size: 15px; font-weight: 700; color: #64748b;}
  .fhc-summary-total b { font-size: 26px; font-weight: 800; color: var(--brand); line-height: 1;}

  .fhc-btn-primary { 
    background: var(--brand); color: #fff; border: none; padding: 16px; border-radius: 14px; 
    font-size: 16px; font-weight: 700; width: 100%; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(245,158,11,0.3);
    text-align: center; text-decoration: none; display: inline-block; box-sizing: border-box;
  }
  .fhc-btn-primary:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-2px); }
  .fhc-btn-primary:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; }

  .fhc-secure-note { text-align: center; font-size: 12px; color: #94a3b8; margin: 16px 0 0 0; }

  .fhc-alert-error { background: #fef2f2; color: #b91c1c; padding: 16px; border-radius: 12px; font-size: 14px; font-weight: 500; border: 1px solid #fecaca; margin-bottom: 24px;}

  /* QR THÀNH CÔNG/CHUYỂN KHOẢN */
  .fhc-qr-stage { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: #f8fafc;}
  .fhc-qr-card { background: #fff; width: 100%; max-width: 440px; border-radius: 24px; padding: 40px 32px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;}
  .fhc-qr-card > small { font-size: 12px; font-weight: 800; color: var(--brand); text-transform: uppercase; letter-spacing: 1px;}
  .fhc-qr-card > h2 { font-size: 24px; font-weight: 800; color: #0f172a; margin: 8px 0; }
  .fhc-qr-card > p { font-size: 14px; color: #64748b; margin: 0 0 24px 0;}
  .fhc-qr-card img { width: 100%; max-width: 280px; aspect-ratio: 1/1; object-fit: contain; margin: 0 auto 24px; border: 1px solid #e2e8f0; border-radius: 16px; padding: 8px;}
  .fhc-qr-info { background: #f8fafc; border-radius: 16px; padding: 20px; text-align: left; margin-bottom: 24px; display: flex; flex-direction: column; gap: 12px;}
  .fhc-qr-info p { display: flex; justify-content: space-between; margin: 0; font-size: 14px;}
  .fhc-qr-info p span { color: #64748b;}
  .fhc-qr-info p b { color: #0f172a; font-weight: 700; text-align: right;}
  .fhc-copyable { background: #e2e8f0; padding: 2px 8px; border-radius: 6px; font-family: monospace; letter-spacing: 1px; color: var(--brand) !important;}
  .fhc-qr-status { padding: 16px; border-radius: 12px; margin-bottom: 24px; font-size: 14px; font-weight: 600;}
  .fhc-qr-status.pending { background: #fffbeb; color: #b45309; }
  .fhc-qr-status.partial { background: #eff6ff; color: #1d4ed8; }
  .fhc-btn-outline { display: block; border: 1px solid #cbd5e1; padding: 16px; border-radius: 14px; font-size: 15px; font-weight: 700; color: #334155; text-decoration: none; margin-top: 16px; transition: all 0.2s;}
  .fhc-btn-outline:hover { background: #f1f5f9; }

  .fhc-success-card { max-width: 500px; }
  .fhc-success-icon { width: 80px; height: 80px; background: #dcfce7; color: #166534; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 0 0 10px rgba(22,101,52,0.1);}
  .fhc-success-code { display: inline-block; background: #f1f5f9; padding: 6px 16px; border-radius: 99px; font-size: 14px; margin-bottom: 24px; color: #475569;}
  .fhc-success-total { font-size: 40px; font-weight: 800; color: var(--brand); margin: 0 0 32px 0;}
  .fhc-success-meta { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; margin-bottom: 32px;}
  .fhc-success-meta span { background: #f8fafc; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #334155; border: 1px solid #e2e8f0;}
  .fhc-success-meta span.paid { background: #dcfce7; color: #166534; border-color: #bbf7d0;}
  .fhc-success-cashback { background: #fffbeb; border: 1px dashed #fcd34d; padding: 16px; border-radius: 16px; font-size: 14px; color: #b45309; margin-bottom: 32px; display: flex; align-items: center; justify-content: center; gap: 8px;}

  /* RESPONSIVE */
  @media (max-width: 1024px) {
    .fhc-layout { flex-direction: column; }
    .fhc-side-col { width: 100%; position: static; }
  }
  @media (max-width: 768px) {
    .fhc-header-inner { height: 60px; }
    .fhc-header-secure span:last-child { display: none; }
    .fhc-layout { padding-top: 24px; padding-bottom: 40px; gap: 20px;}
    .fhc-title-row h1 { font-size: 24px; }
    .fhc-form-row { grid-template-columns: 1fr; }
    .fhc-card { padding: 20px 16px; border-radius: 16px;}
    .fhc-chip-grid { grid-template-columns: 1fr; }
    .fhc-payment-grid button { padding: 14px; }
    .fhc-summary-card { padding: 20px 16px; border-radius: 16px;}
  }
`;

export default Checkout;