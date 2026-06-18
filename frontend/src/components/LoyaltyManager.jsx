import { useEffect, useState } from 'react';
import api from '../api/axios.js';
import Pagination from './Pagination.jsx';
import MapPicker from './MapPicker.jsx';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const emptyCoupon = { code: '', title: '', description: '', discountType: 'fixed', discountValue: '', maxDiscount: '', minOrder: '', usageLimit: '', perPhoneLimit: 1, startsAt: '', endsAt: '', exchangeable: false, coinCost: '', isActive: true };
const emptyPagination = { page: 1, totalPages: 1, total: 0, limit: 10, hasNext: false, hasPrev: false };
const DEFAULT_SPIN_REWARDS = [10, 20, 50, 100, 200, 500, 1000, 0];
const parseSpinReward = (value) => {
  if (typeof value === 'string') {
    const text = value.trim().replace(/\s+/g, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, ''));
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
};
const normalizeSpinRewards = (values) => {
  const source = Array.isArray(values) ? values : [];
  return Array.from({ length: 8 }, (_, index) => parseSpinReward(source[index]));
};

const LoyaltyManager = ({ shop, onShopUpdate, onMessage }) => {
  const [config, setConfig] = useState({});
  const [coupons, setCoupons] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [couponForm, setCouponForm] = useState(emptyCoupon);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfig({
      loyaltyEnabled: shop.loyaltyEnabled !== false,
      cashbackPercent: shop.cashbackPercent ?? 1,
      maxCoinUsePercent: shop.maxCoinUsePercent ?? 50,
      dailySpinEnabled: shop.dailySpinEnabled !== false,
      spinRewards: normalizeSpinRewards(shop.spinRewards),
      shippingBaseFee: shop.shippingBaseFee || 0,
      shippingFeePerKm: shop.shippingFeePerKm || 0,
      shippingMinFee: shop.shippingMinFee || 0,
      shippingMaxDistanceKm: shop.shippingMaxDistanceKm || 30,
      shippingDistanceFactor: shop.shippingDistanceFactor || 1.2,
      storeLatitude: shop.storeLatitude ?? '',
      storeLongitude: shop.storeLongitude ?? '',
      storeMapLabel: shop.storeMapLabel || shop.address || ''
    });
  }, [shop?._id]);

  const load = async (nextPage = page, nextSearch = search) => {
    try {
      const res = await api.get('/loyalty/seller/overview', { params: { page: nextPage, limit: 10, search: nextSearch || undefined } });
      setCoupons(res.data.coupons || []);
      setWallets(res.data.wallets || []);
      setTransactions(res.data.transactions || []);
      setPagination(res.data.pagination || emptyPagination);
    } catch (error) { onMessage?.(error.message, true); }
  };
  useEffect(() => { const timer = setTimeout(() => load(page, search), 250); return () => clearTimeout(timer); }, [page, search]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const payload = { ...config, spinRewards: normalizeSpinRewards(config.spinRewards) };
      const res = await api.put(`/shops/${shop._id}`, payload);
      onShopUpdate?.(res.data.shop);
      onMessage?.('Đã lưu cấu hình loyalty và phí ship');
    } catch (error) { onMessage?.(error.message, true); } finally { setSaving(false); }
  };

  const createCoupon = async (event) => {
    event.preventDefault();
    try {
      await api.post('/loyalty/seller/coupons', couponForm);
      setCouponForm(emptyCoupon);
      await load(1, search);
      onMessage?.('Đã tạo mã giảm giá');
    } catch (error) { onMessage?.(error.message, true); }
  };
  const toggleCoupon = async (coupon) => {
    try { await api.put(`/loyalty/seller/coupons/${coupon._id}`, { isActive: !coupon.isActive }); await load(page, search); } catch (error) { onMessage?.(error.message, true); }
  };

  return (
    <section className="loyalty-admin-page">
      <div className="section-topline"><div><span className="eyebrow">Loyalty & delivery</span><h2>Mã giảm giá, xu và phí ship</h2><p>1 xu = 1đ. Điểm, vòng quay và voucher được tách riêng theo từng shop.</p></div><button type="button" className="btn-gold" onClick={saveConfig} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</button></div>

      <div className="loyalty-config-grid">
        <section className="form-section"><h3>Cấu hình tích xu</h3><label className="check-line"><input type="checkbox" checked={config.loyaltyEnabled || false} onChange={(e) => setConfig({ ...config, loyaltyEnabled: e.target.checked })} /> Bật ví xu cho khách hàng</label><label className="check-line"><input type="checkbox" checked={config.dailySpinEnabled || false} onChange={(e) => setConfig({ ...config, dailySpinEnabled: e.target.checked })} /> Bật vòng quay mỗi ngày</label><div className="form-grid two"><div><label>% hoàn xu khi đơn đã thanh toán</label><input type="number" min="0" max="100" value={config.cashbackPercent} onChange={(e) => setConfig({ ...config, cashbackPercent: e.target.value })} /></div><div><label>Tối đa % giá trị đơn được dùng xu</label><input type="number" min="0" max="100" value={config.maxCoinUsePercent} onChange={(e) => setConfig({ ...config, maxCoinUsePercent: e.target.value })} /></div></div><label>Thiết lập đúng 8 ô của vòng quay</label><div className="spin-slot-editor">{normalizeSpinRewards(config.spinRewards).map((value, index) => <div key={index}><span>Ô {index + 1}</span><input type="number" min="0" step="1" value={value} onChange={(e) => { const next = normalizeSpinRewards(config.spinRewards); next[index] = Math.max(0, Number(e.target.value || 0)); setConfig({ ...config, spinRewards: next }); }} /><small>{Number(value).toLocaleString('vi-VN')} xu</small></div>)}</div><div className="loyalty-rate-note">Vòng quay có đúng 8 ô. Giá trị ô nào hiển thị ở ô đó và backend sẽ cộng đúng giá trị của chính ô trúng. Nhập 0 nếu muốn ô “May mắn”.</div><div className="loyalty-rate-note">Ví dụ hoàn 5%: đơn hợp lệ 200.000đ sẽ nhận 10.000 xu, tương đương 10.000đ.</div></section>

        <section className="form-section"><h3>Phí giao theo km</h3><div className="form-grid two"><div><label>Phí mở đơn</label><input type="number" value={config.shippingBaseFee} onChange={(e) => setConfig({ ...config, shippingBaseFee: e.target.value })} /></div><div><label>Giá mỗi km</label><input type="number" value={config.shippingFeePerKm} onChange={(e) => setConfig({ ...config, shippingFeePerKm: e.target.value })} /></div><div><label>Phí tối thiểu</label><input type="number" value={config.shippingMinFee} onChange={(e) => setConfig({ ...config, shippingMinFee: e.target.value })} /></div><div><label>Khoảng cách giao tối đa (km)</label><input type="number" value={config.shippingMaxDistanceKm} onChange={(e) => setConfig({ ...config, shippingMaxDistanceKm: e.target.value })} /></div><div><label>Hệ số ước tính đường đi</label><input type="number" min="1" max="3" step="0.05" value={config.shippingDistanceFactor} onChange={(e) => setConfig({ ...config, shippingDistanceFactor: e.target.value })} /></div><div><label>Tên vị trí cửa hàng</label><input value={config.storeMapLabel || ''} onChange={(e) => setConfig({ ...config, storeMapLabel: e.target.value })} /></div></div><MapPicker latitude={config.storeLatitude} longitude={config.storeLongitude} onChange={(point) => setConfig({ ...config, storeLatitude: point.latitude, storeLongitude: point.longitude })} title="Ghim vị trí cửa hàng" helper="Khách chọn vị trí nhận hàng, hệ thống tính khoảng cách ước tính và nhân với giá/km." /></section>
      </div>

      <section className="form-section coupon-builder"><div className="section-topline"><div><span className="eyebrow">Coupons</span><h2>Tạo mã giảm giá / voucher đổi xu</h2></div></div><form onSubmit={createCoupon}><div className="form-grid three"><div><label>Mã</label><input required value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} placeholder="WELCOME50" /></div><div><label>Tên ưu đãi</label><input required value={couponForm.title} onChange={(e) => setCouponForm({ ...couponForm, title: e.target.value })} /></div><div><label>Loại giảm</label><select value={couponForm.discountType} onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value })}><option value="fixed">Giảm tiền cố định</option><option value="percentage">Giảm theo %</option></select></div><div><label>Giá trị giảm</label><input required type="number" value={couponForm.discountValue} onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })} /></div><div><label>Giảm tối đa</label><input type="number" value={couponForm.maxDiscount} onChange={(e) => setCouponForm({ ...couponForm, maxDiscount: e.target.value })} /></div><div><label>Đơn tối thiểu</label><input type="number" value={couponForm.minOrder} onChange={(e) => setCouponForm({ ...couponForm, minOrder: e.target.value })} /></div><div><label>Tổng lượt dùng</label><input type="number" value={couponForm.usageLimit} onChange={(e) => setCouponForm({ ...couponForm, usageLimit: e.target.value })} /></div><div><label>Lượt / số điện thoại</label><input type="number" min="1" value={couponForm.perPhoneLimit} onChange={(e) => setCouponForm({ ...couponForm, perPhoneLimit: e.target.value })} /></div><div><label>Xu cần để đổi</label><input type="number" value={couponForm.coinCost} onChange={(e) => setCouponForm({ ...couponForm, coinCost: e.target.value, exchangeable: Number(e.target.value) > 0 })} /></div><div><label>Bắt đầu</label><input type="datetime-local" value={couponForm.startsAt} onChange={(e) => setCouponForm({ ...couponForm, startsAt: e.target.value })} /></div><div><label>Kết thúc</label><input type="datetime-local" value={couponForm.endsAt} onChange={(e) => setCouponForm({ ...couponForm, endsAt: e.target.value })} /></div><div className="coupon-create-action"><button className="btn-gold">Tạo mã</button></div></div><label>Mô tả</label><textarea value={couponForm.description} onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} /></form><div className="coupon-admin-grid">{coupons.map((coupon) => <article key={coupon._id} className={!coupon.isActive ? 'inactive' : ''}><div><span>{coupon.exchangeable ? `${Number(coupon.coinCost).toLocaleString('vi-VN')} xu` : 'Mã công khai'}</span><h3>{coupon.code}</h3><b>{coupon.title}</b><p>{coupon.discountType === 'percentage' ? `Giảm ${coupon.discountValue}%` : `Giảm ${money(coupon.discountValue)}`} · Đơn từ {money(coupon.minOrder)}</p><small>Đã dùng {coupon.usedCount}/{coupon.usageLimit || '∞'}</small></div><button type="button" onClick={() => toggleCoupon(coupon)}>{coupon.isActive ? 'Tạm tắt' : 'Bật lại'}</button></article>)}</div></section>

      <section className="form-section"><div className="section-topline"><div><span className="eyebrow">Customer wallets</span><h2>Ví xu khách hàng</h2><p>{pagination.total} số điện thoại đã tham gia.</p></div><div className="filter-search"><span>⌕</span><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm số điện thoại..." /></div></div><div className="wallet-admin-table"><div className="wallet-admin-head"><span>Số điện thoại</span><span>Số dư</span><span>Đã nhận</span><span>Đã dùng</span><span>Lần quay cuối</span></div>{wallets.map((wallet) => <article key={wallet._id}><b>{wallet.phone}</b><strong>{Number(wallet.coinBalance).toLocaleString('vi-VN')} xu</strong><span>{Number(wallet.totalEarned).toLocaleString('vi-VN')}</span><span>{Number(wallet.totalSpent).toLocaleString('vi-VN')}</span><span>{wallet.lastSpinDate || '—'}</span></article>)}</div><Pagination pagination={pagination} onPageChange={setPage} /></section>

      <section className="form-section"><h3>Giao dịch xu gần nhất</h3><div className="loyalty-transaction-list">{transactions.map((tx) => <article key={tx._id}><span className={tx.coins >= 0 ? 'positive' : 'negative'}>{tx.coins >= 0 ? '+' : ''}{Number(tx.coins).toLocaleString('vi-VN')} xu</span><div><b>{tx.phone}</b><p>{tx.note || tx.type}</p></div><time>{new Date(tx.createdAt).toLocaleString('vi-VN')}</time></article>)}</div></section>
    </section>
  );
};

export default LoyaltyManager;
