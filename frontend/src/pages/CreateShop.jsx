import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import MapPicker from '../components/MapPicker.jsx';

const initialType = sessionStorage.getItem('pending_business_type') || 'restaurant';

const CreateShop = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    businessType: initialType,
    serviceModes: initialType === 'restaurant' ? ['dine_in', 'delivery'] : ['shipping'],
    paymentMethods: ['cash', 'bank_transfer'],
    name: '', slug: '', cuisine: '', description: '', phone: '', zalo: '', address: '',
    bankAccountName: '', bankAccountNumber: '', bankName: '', sepayEnabled: false, sepayWebhookApiKey: '', numberOfTables: 10,
    deliveryTime: '25-40 phút', deliveryFee: 0, shippingBaseFee: 0, shippingFeePerKm: 5000, shippingMinFee: 15000, shippingMaxDistanceKm: 20, shippingDistanceFactor: 1.2, storeLatitude: '', storeLongitude: '', storeMapLabel: '', minOrder: 0,
    loyaltyEnabled: true, cashbackPercent: 2, maxCoinUsePercent: 50, dailySpinEnabled: true, spinRewards: [10,20,50,100,200,500,1000,0],
    logoUrl: '', bannerUrl: '', backgroundImage1: '', backgroundImage2: '', backgroundImage3: '',
    themeColor: '#b98745', telegramChatId: '', zaloWebhookUrl: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const hasDineIn = form.businessType === 'restaurant' && form.serviceModes.includes('dine_in');
  const needsBank = form.paymentMethods.includes('bank_transfer');
  const needsShippingLocation = form.serviceModes.some((mode) => ['delivery', 'shipping'].includes(mode));
  const maxStep = hasDineIn ? 4 : 3;

  const toggleList = (field, value) => {
    const current = form[field];
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    setForm({ ...form, [field]: next });
  };

  const setBusinessType = (businessType) => {
    setForm({
      ...form,
      businessType,
      serviceModes: businessType === 'restaurant' ? ['dine_in', 'delivery'] : ['shipping'],
      numberOfTables: businessType === 'restaurant' ? Math.max(1, Number(form.numberOfTables || 10)) : 0
    });
  };

  const canContinue = useMemo(() => {
    if (step === 1) return form.name.trim() && form.slug.trim() && form.serviceModes.length > 0;
    if (step === 2) {
      if (!form.paymentMethods.length) return false;
      if (needsBank) return form.bankAccountName.trim() && form.bankAccountNumber.trim() && form.bankName.trim();
      return true;
    }
    if (step === 3) return form.phone.trim() && form.address.trim() && (!needsShippingLocation || (form.storeLatitude !== '' && form.storeLongitude !== ''));
    if (step === 4) return Number(form.numberOfTables) > 0;
    return true;
  }, [form, needsBank, step]);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post('/shops', form);
      sessionStorage.removeItem('pending_business_type');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="setup-page">
      <div className="container setup-shell">
        <aside className="setup-side">
          <span className="eyebrow">Merchant studio</span>
          <h1>Thiết lập cửa hàng</h1>
          <p>Mỗi bước chỉ hiển thị đúng thông tin cần thiết cho mô hình của bạn.</p>
          <div className="setup-progress">
            {[1, 2, 3, ...(hasDineIn ? [4] : [])].map((number) => (
              <button key={number} className={step === number ? 'active' : step > number ? 'done' : ''} onClick={() => number < step && setStep(number)}>
                <span>{step > number ? '✓' : number}</span>
                <div>
                  <b>{number === 1 ? 'Mô hình' : number === 2 ? 'Thanh toán' : number === 3 ? 'Thương hiệu' : 'Bàn & QR'}</b>
                  <small>{number === 1 ? 'Loại hình phục vụ' : number === 2 ? 'Ngân hàng nhận tiền' : number === 3 ? 'Hình ảnh và liên hệ' : 'Tạo mã từng bàn'}</small>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="setup-card">
          {error && <div className="alert error">{error}</div>}

          {step === 1 && (
            <div className="setup-step">
              <span className="step-kicker">Bước 1</span><h2>Chọn mô hình kinh doanh</h2>
              <div className="business-choice-grid wide">
                <button type="button" className={form.businessType === 'restaurant' ? 'selected' : ''} onClick={() => setBusinessType('restaurant')}>
                  <span>🍽</span><b>Nhà hàng / quán ăn</b><small>Gọi món tại bàn, mang về, giao tận nơi</small>
                </button>
                <button type="button" className={form.businessType === 'retail' ? 'selected' : ''} onClick={() => setBusinessType('retail')}>
                  <span>🛍</span><b>Cửa hàng thương mại</b><small>Bán sản phẩm, nhận tại shop, gửi hàng</small>
                </button>
              </div>
              <div className="form-grid two">
                <div><label>Tên cửa hàng</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Maison Dining" /></div>
                <div><label>Đường dẫn shop</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="maison-dining" /></div>
                <div><label>Nhóm ngành / phong cách</label><input value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} placeholder="Fine dining · Âu Á · Bakery" /></div>
                <div><label>Thời gian chuẩn bị/giao</label><input value={form.deliveryTime} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} /></div>
              </div>
              <label>Hình thức phục vụ</label>
              <div className="option-chip-grid">
                {(form.businessType === 'restaurant'
                  ? [['dine_in', '🍽 Ăn tại bàn'], ['delivery', '🛵 Giao tận nơi'], ['pickup', '🥡 Khách tự đến lấy']]
                  : [['shipping', '📦 Gửi hàng'], ['pickup', '🏬 Nhận tại cửa hàng']]
                ).map(([value, label]) => (
                  <button type="button" key={value} className={form.serviceModes.includes(value) ? 'active' : ''} onClick={() => toggleList('serviceModes', value)}>{label}</button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="setup-step">
              <span className="step-kicker">Bước 2</span><h2>Nhận tiền & phương thức thanh toán</h2>
              <p className="muted">Chỉ các phương thức được bật mới xuất hiện khi khách thanh toán.</p>
              <div className="payment-choice-grid">
                {[['cash', '💵', 'Tiền mặt', 'Thanh toán tại bàn hoặc khi nhận hàng'], ['bank_transfer', '▦', 'Chuyển khoản QR', 'Tự sinh VietQR theo đơn hàng, có thể xác nhận bằng SePay'], ['vnpay', '🔷', 'VNPAY', 'Cần merchant VNPAY của hệ thống']].map(([value, icon, title, desc]) => (
                  <button type="button" key={value} className={form.paymentMethods.includes(value) ? 'selected' : ''} onClick={() => toggleList('paymentMethods', value)}>
                    <span>{icon}</span><div><b>{title}</b><small>{desc}</small></div><i>{form.paymentMethods.includes(value) ? '✓' : '+'}</i>
                  </button>
                ))}
              </div>
              {needsBank && (
                <div className="bank-info-box">
                  <h3>Thông tin tài khoản nhận tiền</h3>
                  <div className="form-grid two">
                    <div><label>Tên chủ tài khoản</label><input value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value.toUpperCase() })} placeholder="NGUYEN VAN A" /></div>
                    <div><label>Số tài khoản</label><input value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} placeholder="0123456789" /></div>
                  </div>
                  <label>Ngân hàng</label><input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="MBBank / VCB / Techcombank..." />
                  <label className="check-line"><input type="checkbox" checked={form.sepayEnabled} onChange={(e) => setForm({ ...form, sepayEnabled: e.target.checked })} /> Bật tự động xác nhận chuyển khoản bằng SePay</label>
                  {form.sepayEnabled && <div><label>API Key webhook SePay</label><input type="password" value={form.sepayWebhookApiKey} onChange={(e) => setForm({ ...form, sepayWebhookApiKey: e.target.value })} placeholder="API key dùng ở bước bảo mật webhook" /><small>Sau khi tạo shop, cấu hình SePay gọi tới <code>/api/payments/sepay-webhook</code>.</small></div>}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="setup-step">
              <span className="step-kicker">Bước 3</span><h2>Thương hiệu & liên hệ</h2>
              <div className="form-grid two">
                <div><label>Hotline</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xxxxxxxx" /></div>
                <div><label>Zalo</label><input value={form.zalo} onChange={(e) => setForm({ ...form, zalo: e.target.value })} placeholder="09xxxxxxxx" /></div>
              </div>
              <label>Địa chỉ</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Địa chỉ nhà hàng/cửa hàng" />
              <label>Mô tả</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Câu chuyện thương hiệu, điểm nổi bật..." />
              <div className="form-grid two">
                <div><label>Logo URL</label><input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." /></div>
                <div><label>Banner URL</label><input value={form.bannerUrl} onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })} placeholder="https://..." /></div>
              </div>
              <label>Ba ảnh nền chạy như video</label>
              <div className="form-grid three">
                {[1,2,3].map((number) => <input key={number} value={form[`backgroundImage${number}`]} onChange={(e) => setForm({ ...form, [`backgroundImage${number}`]: e.target.value })} placeholder={`Link ảnh nền ${number}`} />)}
              </div>
              {needsShippingLocation && <div className="shipping-onboarding-block">
                <h3>Vị trí cửa hàng & phí ship theo km</h3>
                <p className="muted">Ghim đúng vị trí quán/shop. Khi khách chọn vị trí nhận hàng, hệ thống sẽ tính khoảng cách ước tính và nhân với giá mỗi km.</p>
                <MapPicker latitude={form.storeLatitude} longitude={form.storeLongitude} onChange={(point) => setForm({ ...form, storeLatitude: point.latitude, storeLongitude: point.longitude, storeMapLabel: form.storeMapLabel || form.address })} title="Chọn vị trí cửa hàng" helper="Có thể dùng GPS hoặc chạm trực tiếp trên bản đồ." />
                <div className="form-grid three">
                  <div><label>Phí mở đơn</label><input type="number" value={form.shippingBaseFee} onChange={(e) => setForm({ ...form, shippingBaseFee: e.target.value })} /></div>
                  <div><label>Giá ship / km</label><input type="number" value={form.shippingFeePerKm} onChange={(e) => setForm({ ...form, shippingFeePerKm: e.target.value })} /></div>
                  <div><label>Phí ship tối thiểu</label><input type="number" value={form.shippingMinFee} onChange={(e) => setForm({ ...form, shippingMinFee: e.target.value })} /></div>
                  <div><label>Khoảng cách tối đa (km)</label><input type="number" value={form.shippingMaxDistanceKm} onChange={(e) => setForm({ ...form, shippingMaxDistanceKm: e.target.value })} /></div>
                  <div><label>Hệ số ước tính đường đi</label><input type="number" min="1" max="3" step="0.05" value={form.shippingDistanceFactor} onChange={(e) => setForm({ ...form, shippingDistanceFactor: e.target.value })} /></div>
                  <div><label>Đơn tối thiểu</label><input type="number" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} /></div>
                </div>
              </div>}
              {!needsShippingLocation && <div className="form-grid two"><div><label>Đơn tối thiểu</label><input type="number" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} /></div><div><label>Màu thương hiệu</label><input type="color" value={form.themeColor} onChange={(e) => setForm({ ...form, themeColor: e.target.value })} /></div></div>}
              <div className="form-grid three">
                <div><label>% hoàn xu sau thanh toán</label><input type="number" min="0" max="100" value={form.cashbackPercent} onChange={(e) => setForm({ ...form, cashbackPercent: e.target.value })} /></div>
                <div><label>Tối đa % đơn được dùng xu</label><input type="number" min="0" max="100" value={form.maxCoinUsePercent} onChange={(e) => setForm({ ...form, maxCoinUsePercent: e.target.value })} /></div>
                <div><label>Màu thương hiệu</label><input type="color" value={form.themeColor} onChange={(e) => setForm({ ...form, themeColor: e.target.value })} /></div>
              </div>
              <div className="form-grid two">
                <div><label>Telegram Chat ID nhận đơn</label><input value={form.telegramChatId} onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })} placeholder="123456789 hoặc -100..." /></div>
                <div><label>Zalo webhook (không bắt buộc)</label><input value={form.zaloWebhookUrl} onChange={(e) => setForm({ ...form, zaloWebhookUrl: e.target.value })} placeholder="https://..." /></div>
              </div>
            </div>
          )}

          {step === 4 && hasDineIn && (
            <div className="setup-step table-setup-step">
              <span className="step-kicker">Bước 4</span><h2>Số bàn & QR gọi món</h2>
              <p className="muted">Hệ thống sẽ tạo một mã QR riêng cho từng bàn. Khi khách quét, đơn tự gắn đúng số bàn.</p>
              <div className="table-count-box">
                <button type="button" onClick={() => setForm({ ...form, numberOfTables: Math.max(1, Number(form.numberOfTables) - 1) })}>−</button>
                <div><b>{form.numberOfTables}</b><span>bàn</span></div>
                <button type="button" onClick={() => setForm({ ...form, numberOfTables: Math.min(500, Number(form.numberOfTables) + 1) })}>+</button>
              </div>
              <div className="table-preview-grid">
                {Array.from({ length: Math.min(Number(form.numberOfTables || 0), 12) }, (_, index) => <span key={index}>Bàn {index + 1}<small>QR riêng</small></span>)}
                {Number(form.numberOfTables) > 12 && <span>+{Number(form.numberOfTables) - 12}<small>bàn khác</small></span>}
              </div>
            </div>
          )}

          <div className="setup-actions">
            {step > 1 && <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>← Quay lại</button>}
            <div />
            {step < maxStep ? (
              <button type="button" className="btn-gold" disabled={!canContinue} onClick={() => setStep(step + 1)}>Tiếp tục →</button>
            ) : (
              <button type="button" className="btn-gold" disabled={!canContinue || loading} onClick={handleSubmit}>{loading ? 'Đang khởi tạo...' : 'Hoàn tất & tạo cửa hàng'}</button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CreateShop;
