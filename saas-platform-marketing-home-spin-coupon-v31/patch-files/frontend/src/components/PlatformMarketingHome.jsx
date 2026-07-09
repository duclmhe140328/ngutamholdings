import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import PhoneOtpPanel, { loyaltyStorage } from './PhoneOtpPanel.jsx';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const PlatformMarketingHome = () => {
  const [data, setData] = useState({ saleGroups: [], spin: null, coupons: [] });
  const [identity, setIdentity] = useState(() => loyaltyStorage.get());
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [spinError, setSpinError] = useState('');
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    api.get('/platform/public')
      .then((res) => setData(res.data || { saleGroups: [], spin: null, coupons: [] }))
      .catch(() => setData({ saleGroups: [], spin: null, coupons: [] }));
  }, []);

  const rewards = useMemo(() => {
    const source = data.spin?.rewards?.length ? data.spin.rewards : [];
    return source.slice(0, 8);
  }, [data.spin]);

  const spin = async () => {
    setSpinError('');
    setSpinResult(null);
    if (!identity?.phone || !identity?.token) {
      setSpinError('Xác thực số điện thoại trước khi quay để cộng xu vào ví hệ thống.');
      return;
    }
    setSpinning(true);
    try {
      const res = await api.post('/platform/spin', { phone: identity.phone, loyaltyToken: identity.token }, { headers: { 'x-loyalty-token': identity.token } });
      const index = Number(res.data.rewardIndex || 0);
      const slice = rewards.length ? 360 / rewards.length : 45;
      setAngle((current) => current + 1440 + (360 - index * slice - slice / 2));
      window.setTimeout(() => setSpinResult(res.data), 900);
    } catch (error) {
      setSpinError(error.message || 'Không quay được lúc này');
    } finally {
      window.setTimeout(() => setSpinning(false), 1000);
    }
  };

  if (!data.saleGroups?.length && !data.spin?.enabled && !data.coupons?.length) return null;

  return (
    <section className="platform-marketing-section">
      <style>{`
        .platform-marketing-section { padding: 72px 0; background: linear-gradient(135deg,#0f172a 0%,#1e293b 45%,#451a03 100%); color:#fff; }
        .pm-shell { max-width:1200px; margin:0 auto; padding:0 20px; display:grid; gap:28px; }
        .pm-head { display:flex; justify-content:space-between; gap:20px; align-items:flex-end; flex-wrap:wrap; }
        .pm-head span { color:#fbbf24; font-weight:900; font-size:12px; text-transform:uppercase; letter-spacing:.12em; }
        .pm-head h2 { margin:8px 0 8px; font-size:32px; line-height:1.12; }
        .pm-head p { margin:0; color:#cbd5e1; max-width:680px; }
        .pm-layout { display:grid; grid-template-columns: minmax(0,1.55fr) minmax(320px,.9fr); gap:24px; align-items:start; }
        .pm-card { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.14); border-radius:24px; box-shadow:0 24px 80px rgba(0,0,0,.24); backdrop-filter:blur(18px); overflow:hidden; }
        .pm-card-inner { padding:22px; }
        .pm-sale-groups { display:grid; gap:18px; }
        .pm-shop-row { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); border-radius:20px; padding:16px; }
        .pm-shop-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px; }
        .pm-shop-title { display:flex; align-items:center; gap:10px; min-width:0; }
        .pm-shop-title img { width:42px; height:42px; border-radius:13px; object-fit:cover; background:#fff; }
        .pm-shop-title b { display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pm-shop-title small { color:#cbd5e1; }
        .pm-products { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
        .pm-product { color:#fff; text-decoration:none; background:rgba(15,23,42,.58); border:1px solid rgba(255,255,255,.12); border-radius:16px; overflow:hidden; transition:.2s; }
        .pm-product:hover { transform:translateY(-4px); border-color:#fbbf24; }
        .pm-product img { width:100%; aspect-ratio:1.1; object-fit:cover; display:block; background:#1e293b; }
        .pm-product div { padding:10px; display:grid; gap:5px; }
        .pm-product b { font-size:13px; line-height:1.25; min-height:34px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .pm-price { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
        .pm-price strong { color:#fbbf24; }
        .pm-price del { color:#94a3b8; font-size:12px; }
        .pm-spin-card h3 { margin:0 0 8px; font-size:23px; }
        .pm-spin-card p { color:#cbd5e1; margin:0 0 14px; }
        .pm-wheel-wrap { display:grid; place-items:center; margin:18px 0; position:relative; }
        .pm-pointer { position:absolute; top:-2px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:12px solid transparent; border-right:12px solid transparent; border-top:24px solid #fbbf24; z-index:2; filter:drop-shadow(0 2px 4px rgba(0,0,0,.35)); }
        .pm-wheel { width:250px; height:250px; border-radius:50%; border:8px solid rgba(255,255,255,.9); display:grid; place-items:center; transition:transform .9s cubic-bezier(.16,.8,.28,1); background:conic-gradient(#f59e0b 0 45deg,#ef4444 45deg 90deg,#22c55e 90deg 135deg,#3b82f6 135deg 180deg,#a855f7 180deg 225deg,#14b8a6 225deg 270deg,#f97316 270deg 315deg,#64748b 315deg 360deg); box-shadow:inset 0 0 35px rgba(0,0,0,.25),0 18px 55px rgba(0,0,0,.35); }
        .pm-wheel-center { width:96px; height:96px; border-radius:50%; background:#fff; color:#0f172a; display:grid; place-items:center; text-align:center; font-weight:900; box-shadow:0 8px 24px rgba(0,0,0,.25); font-size:13px; }
        .pm-rewards { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; }
        .pm-rewards span { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:8px 10px; font-size:12px; color:#e2e8f0; }
        .pm-spin-actions { display:grid; gap:10px; }
        .pm-spin-actions button { border:0; border-radius:14px; padding:13px 16px; background:#f59e0b; color:#fff; font-weight:900; cursor:pointer; box-shadow:0 12px 30px rgba(245,158,11,.28); }
        .pm-spin-actions button:disabled { opacity:.7; cursor:not-allowed; }
        .pm-result { padding:12px 14px; border-radius:14px; background:rgba(34,197,94,.16); border:1px solid rgba(34,197,94,.28); color:#dcfce7; font-weight:800; }
        .pm-error { padding:12px 14px; border-radius:14px; background:rgba(239,68,68,.14); border:1px solid rgba(239,68,68,.25); color:#fecaca; font-weight:700; }
        .pm-coupons { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
        .pm-coupon { padding:8px 10px; border-radius:999px; background:rgba(251,191,36,.14); border:1px solid rgba(251,191,36,.24); color:#fde68a; font-size:12px; font-weight:800; }
        .phone-otp-panel { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:12px; margin-bottom:12px; }
        .phone-otp-row { display:flex; gap:8px; margin-bottom:8px; }
        .phone-otp-row input { flex:1; min-width:0; border:1px solid rgba(255,255,255,.18); background:rgba(15,23,42,.72); color:#fff; border-radius:12px; padding:10px 12px; outline:none; }
        .phone-otp-row button { border:0; border-radius:12px; background:#fff; color:#0f172a; font-weight:900; padding:0 12px; cursor:pointer; }
        .phone-otp-message { color:#fde68a; }
        @media(max-width:900px){.pm-layout{grid-template-columns:1fr}.pm-products{grid-template-columns:repeat(2,1fr)}.pm-head h2{font-size:26px}.pm-wheel{width:220px;height:220px}.pm-wheel-center{width:84px;height:84px}}
      `}</style>
      <div className="pm-shell">
        <div className="pm-head">
          <div>
            <span>Sale & loyalty hub</span>
            <h2>Săn món sale từ các shop và quay xu toàn hệ thống</h2>
            <p>Xu nhận từ vòng quay dùng để trừ tiền tại những shop đã bật tích xu. Shop nào không tham gia tích xu sẽ không áp dụng xu.</p>
          </div>
        </div>
        <div className="pm-layout">
          <div className="pm-card">
            <div className="pm-card-inner">
              <div className="pm-sale-groups">
                {data.saleGroups?.length ? data.saleGroups.map((group) => {
                  const shop = group.shop || {};
                  const shopUrl = shop.customDomain ? `https://${shop.customDomain}` : `/shop/${shop.slug}`;
                  return (
                    <article className="pm-shop-row" key={shop._id}>
                      <div className="pm-shop-head">
                        <div className="pm-shop-title">
                          <img src={shop.logoUrl || '/logo.png'} alt="" />
                          <div><b>{shop.name}</b><small>{shop.loyaltyEnabled ? 'Có tích xu' : 'Không áp dụng xu'}</small></div>
                        </div>
                        <a className="btn-outline" href={shopUrl}>Vào shop</a>
                      </div>
                      <div className="pm-products">
                        {(group.products || []).map((product) => (
                          <Link className="pm-product" key={product._id} to={`/shop/${shop.slug}/product/${product._id}`}>
                            <img src={product.images?.[0] || shop.bannerUrl || '/logo.png'} alt={product.name} loading="lazy" />
                            <div>
                              <b>{product.name}</b>
                              <span className="pm-price"><strong>{money(product.salePrice)}</strong><del>{money(product.price)}</del></span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </article>
                  );
                }) : <p style={{ color: '#cbd5e1' }}>Chưa có sản phẩm sale từ các shop.</p>}
              </div>
            </div>
          </div>

          {data.spin?.enabled && (
            <aside className="pm-card pm-spin-card">
              <div className="pm-card-inner">
                <h3>{data.spin.title || 'Vòng quay xu'}</h3>
                <p>{data.spin.description || 'Mỗi ngày quay một lần để nhận xu hệ thống.'}</p>
                {!identity?.token ? <PhoneOtpPanel compact onVerified={setIdentity} /> : <div className="pm-result">Đã xác thực: {identity.phone}</div>}
                <div className="pm-wheel-wrap">
                  <div className="pm-pointer" />
                  <div className="pm-wheel" style={{ transform: `rotate(${angle}deg)` }}><div className="pm-wheel-center">QUAY<br/>NHẬN XU</div></div>
                </div>
                <div className="pm-rewards">
                  {rewards.map((reward, index) => <span key={`${reward.label}-${index}`}>{reward.label || (reward.type === 'coins' ? `${reward.value} xu` : 'May mắn')}</span>)}
                </div>
                <div className="pm-spin-actions">
                  <button type="button" disabled={spinning} onClick={spin}>{spinning ? 'Đang quay...' : 'Quay ngay'}</button>
                  {spinResult && <div className="pm-result">{spinResult.message}</div>}
                  {spinError && <div className="pm-error">{spinError}</div>}
                </div>
                {data.coupons?.length > 0 && <div className="pm-coupons">{data.coupons.slice(0, 6).map((c) => <span className="pm-coupon" key={c._id}>{c.code}</span>)}</div>}
              </div>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
};

export default PlatformMarketingHome;
