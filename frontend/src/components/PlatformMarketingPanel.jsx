import { useEffect, useState } from 'react';
import api from '../api/axios.js';

const emptyCoupon = {
  code: '', title: '', description: '', discountType: 'fixed', discountValue: '', maxDiscount: '', minOrder: '',
  startsAt: '', endsAt: '', usageLimit: '', perPhoneLimit: 1, appliesToAll: true, shopIds: [], isActive: true
};

const defaultRewards = [10, 20, 50, 100, 200, 500, 1000, 0].map((value) => ({
  label: value ? `${value} xu` : 'Chúc may mắn',
  type: value ? 'coins' : 'none',
  value,
  weight: 1,
  isActive: true,
  couponCode: ''
}));

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const PlatformMarketingPanel = ({ onToast, onError }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({ enabled: true, oncePerDay: true, title: '', description: '', rewards: defaultRewards });
  const [coupons, setCoupons] = useState([]);
  const [shops, setShops] = useState([]);
  const [couponForm, setCouponForm] = useState(emptyCoupon);

  const showError = (error) => onError?.(error) || alert(error.message || 'Có lỗi xảy ra');
  const toast = (text) => onToast?.(text);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/platform/admin');
      setConfig({ ...res.data.config, rewards: res.data.config?.rewards?.length ? res.data.config.rewards : defaultRewards });
      setCoupons(res.data.coupons || []);
      setShops(res.data.shops || []);
    } catch (error) { showError(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const updateReward = (index, field, value) => {
    setConfig((current) => {
      const rewards = [...(current.rewards || defaultRewards)];
      rewards[index] = { ...rewards[index], [field]: value };
      if (field === 'type') {
        rewards[index].label = value === 'coins' ? `${Number(rewards[index].value || 0)} xu` : value === 'coupon' ? `Mã ${rewards[index].couponCode || ''}` : 'Chúc may mắn';
      }
      if (field === 'value' && rewards[index].type === 'coins') rewards[index].label = `${Number(value || 0)} xu`;
      return { ...current, rewards };
    });
  };

  const saveSpin = async () => {
    setSaving(true);
    try {
      const res = await api.put('/platform/admin/spin-config', config);
      setConfig(res.data.config);
      toast('Đã lưu cấu hình vòng quay hệ thống');
    } catch (error) { showError(error); }
    finally { setSaving(false); }
  };

  const saveCoupon = async () => {
    setSaving(true);
    try {
      const payload = { ...couponForm, code: couponForm.code.toUpperCase(), shopIds: couponForm.appliesToAll ? [] : couponForm.shopIds };
      if (couponForm._id) await api.put(`/platform/admin/coupons/${couponForm._id}`, payload);
      else await api.post('/platform/admin/coupons', payload);
      setCouponForm(emptyCoupon);
      await load();
      toast('Đã lưu mã giảm giá hệ thống');
    } catch (error) { showError(error); }
    finally { setSaving(false); }
  };

  const editCoupon = (coupon) => {
    setCouponForm({
      ...emptyCoupon,
      ...coupon,
      shopIds: (coupon.shopIds || []).map((shop) => String(shop._id || shop)),
      startsAt: coupon.startsAt ? String(coupon.startsAt).slice(0, 10) : '',
      endsAt: coupon.endsAt ? String(coupon.endsAt).slice(0, 10) : ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleShop = (shopId) => {
    setCouponForm((current) => {
      const exists = current.shopIds.includes(shopId);
      return { ...current, shopIds: exists ? current.shopIds.filter((id) => id !== shopId) : [...current.shopIds, shopId] };
    });
  };

  const removeCoupon = async (id) => {
    if (!window.confirm('Xóa mã giảm giá hệ thống này?')) return;
    try { await api.delete(`/platform/admin/coupons/${id}`); await load(); toast('Đã xóa mã giảm giá'); } catch (error) { showError(error); }
  };

  if (loading) return <div className="ad-loading">Đang tải marketing hệ thống...</div>;

  return (
    <div className="platform-marketing-admin">
      <style>{`
        .platform-marketing-admin { display:grid; gap:24px; }
        .pma-card { background:#fff; border:1px solid #e2e8f0; border-radius:20px; padding:22px; box-shadow:0 4px 14px rgba(15,23,42,.04); }
        .pma-card h2 { margin:0 0 8px; color:#0f172a; font-size:20px; }
        .pma-card p { margin:0 0 18px; color:#64748b; }
        .pma-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .pma-grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
        .pma-field { display:grid; gap:7px; }
        .pma-field label { font-size:13px; font-weight:800; color:#334155; }
        .pma-field input,.pma-field select,.pma-field textarea { width:100%; border:1px solid #cbd5e1; border-radius:12px; padding:11px 12px; outline:none; box-sizing:border-box; }
        .pma-field textarea { min-height:74px; resize:vertical; }
        .pma-check { display:flex; gap:8px; align-items:center; font-weight:800; color:#334155; margin:10px 0; }
        .pma-rewards { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .pma-reward { border:1px solid #e2e8f0; border-radius:16px; padding:12px; display:grid; gap:9px; background:#f8fafc; }
        .pma-shop-pick { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:8px; max-height:180px; overflow:auto; padding:10px; background:#f8fafc; border-radius:14px; border:1px solid #e2e8f0; }
        .pma-shop-pick label { display:flex; align-items:center; gap:7px; font-size:13px; }
        .pma-actions { display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; margin-top:16px; }
        .pma-btn { border:0; border-radius:12px; padding:11px 16px; font-weight:900; cursor:pointer; }
        .pma-btn.gold { background:#f59e0b; color:#fff; }
        .pma-btn.dark { background:#0f172a; color:#fff; }
        .pma-btn.ghost { background:#f1f5f9; color:#334155; }
        .pma-coupon-list { display:grid; gap:12px; }
        .pma-coupon { display:grid; grid-template-columns:1fr auto; gap:12px; border:1px solid #e2e8f0; border-radius:16px; padding:14px; align-items:center; }
        .pma-coupon b { display:block; color:#0f172a; }
        .pma-coupon small { color:#64748b; }
        @media(max-width:900px){.pma-grid-2,.pma-grid-3,.pma-rewards{grid-template-columns:1fr}.pma-coupon{grid-template-columns:1fr}.pma-actions{justify-content:stretch}.pma-btn{flex:1}}
      `}</style>

      <section className="pma-card">
        <h2>Vòng quay xu toàn hệ thống</h2>
        <p>Admin tổng căn chỉnh phần thưởng. Xu quay được dùng tại shop nào bật tích xu; shop tắt tích xu sẽ không cho trừ tiền bằng xu.</p>
        <div className="pma-grid-2">
          <div className="pma-field"><label>Tiêu đề</label><input value={config.title || ''} onChange={(e) => setConfig({ ...config, title: e.target.value })} /></div>
          <div className="pma-field"><label>Mô tả</label><input value={config.description || ''} onChange={(e) => setConfig({ ...config, description: e.target.value })} /></div>
        </div>
        <label className="pma-check"><input type="checkbox" checked={config.enabled !== false} onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} /> Bật vòng quay trên trang chủ</label>
        <label className="pma-check"><input type="checkbox" checked={config.oncePerDay !== false} onChange={(e) => setConfig({ ...config, oncePerDay: e.target.checked })} /> Mỗi SĐT chỉ quay 1 lần/ngày</label>
        <div className="pma-rewards">
          {(config.rewards || defaultRewards).map((reward, index) => (
            <div className="pma-reward" key={index}>
              <b>Ô {index + 1}</b>
              <select value={reward.type || 'coins'} onChange={(e) => updateReward(index, 'type', e.target.value)}>
                <option value="coins">Tặng xu</option>
                <option value="coupon">Tặng mã</option>
                <option value="none">May mắn lần sau</option>
              </select>
              {reward.type === 'coupon' ? <input value={reward.couponCode || ''} onChange={(e) => updateReward(index, 'couponCode', e.target.value.toUpperCase())} placeholder="Mã coupon" /> : <input type="number" value={reward.value || 0} onChange={(e) => updateReward(index, 'value', e.target.value)} placeholder="Số xu" />}
              <input value={reward.label || ''} onChange={(e) => updateReward(index, 'label', e.target.value)} placeholder="Tên hiển thị" />
              <input type="number" value={reward.weight ?? 1} onChange={(e) => updateReward(index, 'weight', e.target.value)} placeholder="Tỉ lệ" />
            </div>
          ))}
        </div>
        <div className="pma-actions"><button className="pma-btn gold" disabled={saving} onClick={saveSpin}>{saving ? 'Đang lưu...' : 'Lưu vòng quay'}</button></div>
      </section>

      <section className="pma-card">
        <h2>{couponForm._id ? 'Sửa mã giảm giá toàn hệ thống' : 'Thêm mã giảm giá toàn hệ thống'}</h2>
        <p>Mã này có thể áp dụng cho toàn bộ shop hoặc chỉ các shop được admin chọn.</p>
        <div className="pma-grid-3">
          <div className="pma-field"><label>Mã</label><input value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} disabled={Boolean(couponForm._id)} /></div>
          <div className="pma-field"><label>Tên ưu đãi</label><input value={couponForm.title} onChange={(e) => setCouponForm({ ...couponForm, title: e.target.value })} /></div>
          <div className="pma-field"><label>Loại giảm</label><select value={couponForm.discountType} onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value })}><option value="fixed">Giảm tiền</option><option value="percentage">Giảm %</option></select></div>
          <div className="pma-field"><label>Giá trị giảm</label><input type="number" value={couponForm.discountValue} onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })} /></div>
          <div className="pma-field"><label>Giảm tối đa</label><input type="number" value={couponForm.maxDiscount} onChange={(e) => setCouponForm({ ...couponForm, maxDiscount: e.target.value })} /></div>
          <div className="pma-field"><label>Đơn tối thiểu</label><input type="number" value={couponForm.minOrder} onChange={(e) => setCouponForm({ ...couponForm, minOrder: e.target.value })} /></div>
          <div className="pma-field"><label>Giới hạn tổng lượt</label><input type="number" value={couponForm.usageLimit} onChange={(e) => setCouponForm({ ...couponForm, usageLimit: e.target.value })} /></div>
          <div className="pma-field"><label>Mỗi SĐT dùng</label><input type="number" value={couponForm.perPhoneLimit} onChange={(e) => setCouponForm({ ...couponForm, perPhoneLimit: e.target.value })} /></div>
          <div className="pma-field"><label>Trạng thái</label><select value={couponForm.isActive ? 'on' : 'off'} onChange={(e) => setCouponForm({ ...couponForm, isActive: e.target.value === 'on' })}><option value="on">Đang bật</option><option value="off">Tạm tắt</option></select></div>
        </div>
        <label className="pma-check"><input type="checkbox" checked={couponForm.appliesToAll} onChange={(e) => setCouponForm({ ...couponForm, appliesToAll: e.target.checked, shopIds: [] })} /> Áp dụng toàn bộ shop đăng ký trên hệ thống</label>
        {!couponForm.appliesToAll && <div className="pma-shop-pick">{shops.map((shop) => <label key={shop._id}><input type="checkbox" checked={couponForm.shopIds.includes(String(shop._id))} onChange={() => toggleShop(String(shop._id))} /> {shop.name}</label>)}</div>}
        <div className="pma-actions">
          {couponForm._id && <button className="pma-btn ghost" onClick={() => setCouponForm(emptyCoupon)}>Tạo mã mới</button>}
          <button className="pma-btn dark" disabled={saving} onClick={saveCoupon}>{saving ? 'Đang lưu...' : 'Lưu mã giảm giá'}</button>
        </div>
      </section>

      <section className="pma-card">
        <h2>Danh sách mã hệ thống</h2>
        <div className="pma-coupon-list">
          {coupons.map((coupon) => (
            <article className="pma-coupon" key={coupon._id}>
              <div>
                <b>{coupon.code} · {coupon.title}</b>
                <small>{coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : money(coupon.discountValue)} · Đơn tối thiểu {money(coupon.minOrder)} · {coupon.appliesToAll ? 'Toàn bộ shop' : `${coupon.shopIds?.length || 0} shop`} · Đã dùng {coupon.usedCount || 0}</small>
              </div>
              <div className="pma-actions" style={{ marginTop: 0 }}>
                <button className="pma-btn ghost" onClick={() => editCoupon(coupon)}>Sửa</button>
                <button className="pma-btn ghost" onClick={() => removeCoupon(coupon._id)}>Xóa</button>
              </div>
            </article>
          ))}
          {!coupons.length && <p>Chưa có mã giảm giá hệ thống.</p>}
        </div>
      </section>
    </div>
  );
};

export default PlatformMarketingPanel;
