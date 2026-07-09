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
      setSpinError('Vui lòng xác thực số điện thoại trước khi quay để cộng xu vào ví.');
      return;
    }
    setSpinning(true);
    try {
      const res = await api.post(
        '/platform/spin',
        { phone: identity.phone, loyaltyToken: identity.token },
        { headers: { 'x-loyalty-token': identity.token } }
      );
      const index = Number(res.data.rewardIndex || 0);
      const slice = rewards.length ? 360 / rewards.length : 45;
      setAngle((current) => current + 1440 + (360 - index * slice - slice / 2));
      window.setTimeout(() => setSpinResult(res.data), 900);
    } catch (error) {
      setSpinError(error.message || 'Không thể quay vào lúc này');
    } finally {
      window.setTimeout(() => setSpinning(false), 1000);
    }
  };

  if (!data.saleGroups?.length && !data.spin?.enabled && !data.coupons?.length) return null;

  return (
    <section className="platform-marketing-section">
      <style>{`
        .platform-marketing-section {
          padding: 48px 0;
          background: radial-gradient(circle at 50% 0%, #334155 0%, #0f172a 60%, #1e1b4b 100%);
          color: #f8fafc;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          min-height: 100vh;
        }
        .pm-shell {
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 16px;
          display: grid;
          gap: 32px;
        }
        .pm-head {
          text-align: center;
          max-width: 760px;
          margin: 0 auto;
        }
        .pm-head span {
          display: inline-block;
          padding: 4px 12px;
          background: rgba(251, 191, 36, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 99px;
          font-weight: 700;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 12px;
        }
        .pm-head h2 {
          margin: 0 0 12px;
          font-size: clamp(24px, 5vw, 36px);
          font-weight: 800;
          line-height: 1.2;
          background: linear-gradient(to right, #ffffff, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .pm-head p {
          margin: 0;
          color: #94a3b8;
          font-size: clamp(14px, 3vw, 16px);
          line-height: 1.6;
        }
        .pm-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          align-items: start;
        }
        @media (min-width: 1024px) {
          .pm-layout {
            grid-template-columns: minmax(0, 1.6fr) minmax(340px, 0.9fr);
          }
        }
        .pm-card {
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(16px);
          overflow: hidden;
        }
        .pm-card-inner {
          padding: 20px;
        }
        @media (min-width: 640px) {
          .pm-card-inner {
            padding: 28px;
          }
        }
        .pm-sale-groups {
          display: grid;
          gap: 24px;
        }
        .pm-shop-row {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 16px;
          transition: border-color 0.2s;
        }
        .pm-shop-row:hover {
          border-color: rgba(255, 255, 255, 0.2);
        }
        .pm-shop-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .pm-shop-title {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }
        .pm-shop-title img {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          object-fit: cover;
          background: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .pm-shop-title b {
          display: block;
          font-size: 16px;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pm-shop-title small {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #38bdf8;
          font-size: 12px;
          font-weight: 500;
          margin-top: 2px;
        }
        .btn-outline {
          padding: 8px 16px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .btn-outline:hover {
          background: #fff;
          color: #0f172a;
        }
        
        /* --- THAY ĐỔI KHU VỰC THÀNH SLIDER TRƯỢT NGANG TẠI ĐÂY --- */
        .pm-products {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          padding: 4px 0 16px 0;
          scrollbar-width: none; /* Ẩn thanh cuộn trên Firefox */
        }
        .pm-products::-webkit-scrollbar {
          display: none; /* Ẩn thanh cuộn trên Chrome/Safari */
        }
        .pm-product {
          flex: 0 0 calc((100% - 12px) / 2); /* Hiện đúng 2 sản phẩm trên Mobile */
          scroll-snap-align: start;
          display: flex;
          flex-direction: column;
          color: #fff;
          text-decoration: none;
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          overflow: hidden;
          transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
        }
        @media (min-width: 640px) {
          .pm-products {
            gap: 16px;
          }
          .pm-product {
            flex: 0 0 calc((100% - 32px) / 3); /* Hiện 3 sản phẩm trên Tablet */
          }
        }
        @media (min-width: 1024px) {
          .pm-product {
            flex: 0 0 calc((100% - 48px) / 4); /* Hiện 4 sản phẩm trên PC */
          }
        }
        /* --- HẾT KHU VỰC THAY ĐỔI SLIDER --- */

        .pm-product:hover {
          transform: translateY(-4px);
          border-color: #fbbf24;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }
        .pm-product img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          display: block;
          background: #1e293b;
        }
        .pm-product-info {
          padding: 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          flex: 1;
          gap: 8px;
        }
        .pm-product b {
          font-size: 13px;
          line-height: 1.4;
          font-weight: 500;
          color: #e2e8f0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          height: 36px;
        }
        .pm-price {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .pm-price strong {
          color: #fbbf24;
          font-size: 15px;
          font-weight: 700;
        }
        .pm-price del {
          color: #64748b;
          font-size: 12px;
        }
        /* Spin Wheel Section */
        .pm-spin-card {
          position: sticky;
          top: 24px;
          border: 1px solid rgba(251, 191, 36, 0.3);
          box-shadow: 0 20px 50px rgba(245, 158, 11, 0.1);
        }
        .pm-spin-card h3 {
          margin: 0 0 6px;
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          text-align: center;
        }
        .pm-spin-card p {
          color: #94a3b8;
          margin: 0 0 16px;
          font-size: 14px;
          text-align: center;
        }
        .pm-wheel-wrap {
          display: grid;
          place-items: center;
          margin: 24px 0;
          position: relative;
        }
        .pm-pointer {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 14px solid transparent;
          border-right: 14px solid transparent;
          border-top: 28px solid #ef4444;
          z-index: 10;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5));
        }
        .pm-wheel {
          width: min(280px, 75vw);
          height: min(280px, 75vw);
          border-radius: 50%;
          border: 8px solid #334155;
          display: grid;
          place-items: center;
          transition: transform 3.5s cubic-bezier(0.1, 1, 0.1, 1);
          background: conic-gradient(
            #f59e0b 0 45deg, #ef4444 45deg 90deg, #10b981 90deg 135deg, #3b82f6 135deg 180deg,
            #8b5cf6 180deg 225deg, #06b6d4 225deg 270deg, #ec4899 270deg 315deg, #64748b 315deg 360deg
          );
          box-shadow: 0 0 0 4px rgba(255,255,255,0.1), inset 0 0 30px rgba(0,0,0,0.5), 0 20px 40px rgba(0,0,0,0.4);
        }
        .pm-wheel-center {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: #fff;
          color: #0f172a;
          display: grid;
          place-items: center;
          text-align: center;
          font-weight: 800;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          font-size: 12px;
          line-height: 1.2;
          border: 4px solid #e2e8f0;
          z-index: 5;
        }
        .pm-rewards {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin: 16px 0;
          max-height: 160px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .pm-rewards span {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 12px;
          color: #cbd5e1;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pm-spin-actions {
          display: grid;
          gap: 12px;
        }
        .pm-spin-actions button {
          border: 0;
          border-radius: 14px;
          padding: 14px 20px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #fff;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(245, 158, 11, 0.3);
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .pm-spin-actions button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(245, 158, 11, 0.4);
        }
        .pm-spin-actions button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: #64748b;
          box-shadow: none;
        }
        .pm-result {
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #6ee7b7;
          font-weight: 600;
          font-size: 13px;
          text-align: center;
        }
        .pm-error {
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          font-weight: 600;
          font-size: 13px;
          text-align: center;
        }
        /* Coupons */
        .pm-coupon-section {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .pm-coupon-title {
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 10px;
          display: block;
          text-align: center;
        }
        .pm-coupons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .pm-coupon {
          padding: 6px 12px;
          border-radius: 8px;
          background: rgba(251, 191, 36, 0.1);
          border: 1px dashed #fbbf24;
          color: #fde68a;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
          position: relative;
        }
      `}</style>

      <div className="pm-shell">
        <div className="pm-head">
          <span>Sale & Loyalty Hub</span>
          <h2>Săn Món Sale & Quay Xu Hệ Thống</h2>
          <p>
            Xu nhận từ vòng quay được áp dụng trừ tiền trực tiếp tại các shop đã bật tính năng tích xu. 
            Tích lũy mỗi ngày để mua sắm với giá ưu đãi nhất!
          </p>
        </div>

        <div className="pm-layout">
          {/* Left Column: Shops and Products */}
          <div className="pm-card">
            <div className="pm-card-inner">
              <div className="pm-sale-groups">
                {data.saleGroups?.length ? (
                  data.saleGroups.map((group) => {
                    const shop = group.shop || {};
                    const shopUrl = shop.customDomain ? `https://${shop.customDomain}` : `/shop/${shop.slug}`;
                    return (
                      <article className="pm-shop-row" key={shop._id}>
                        <div className="pm-shop-head">
                          <div className="pm-shop-title">
                            <img src={shop.logoUrl || '/logo.png'} alt="" />
                            <div>
                              <b>{shop.name}</b>
                              <small>
                                {shop.loyaltyEnabled ? '✓ Có áp dụng xu' : '✕ Không áp dụng xu'}
                              </small>
                            </div>
                          </div>
                          <a className="btn-outline" href={shopUrl}>Vào shop</a>
                        </div>

                        <div className="pm-products">
                          {(group.products || []).map((product) => (
                            <Link className="pm-product" key={product._id} to={`/shop/${shop.slug}/product/${product._id}`}>
                              <img src={product.images?.[0] || shop.bannerUrl || '/logo.png'} alt={product.name} loading="lazy" />
                              <div className="pm-product-info">
                                <b>{product.name}</b>
                                <span className="pm-price">
                                  <strong>{money(product.salePrice)}</strong>
                                  {product.price > product.salePrice && <del>{money(product.price)}</del>}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
                    Hiện chưa có sản phẩm khuyến mãi nào từ các shop.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Spin Wheel & Coupons */}
          {data.spin?.enabled && (
            <aside className="pm-card pm-spin-card">
              <div className="pm-card-inner">
                <h3>{data.spin.title || 'Vòng Quay May Mắn'}</h3>
                <p>{data.spin.description || 'Quay mỗi ngày để tích xu vào ví hệ thống'}</p>

                {!identity?.token ? (
                  <PhoneOtpPanel compact onVerified={setIdentity} />
                ) : (
                  <div className="pm-result" style={{ marginBottom: '16px' }}>
                    Đã xác thực: <b>{identity.phone}</b>
                  </div>
                )}

                <div className="pm-wheel-wrap">
                  <div className="pm-pointer" />
                  <div className="pm-wheel" style={{ transform: `rotate(${angle}deg)` }}>
                    <div className="pm-wheel-center">QUAY<br/>NHẬN XU</div>
                  </div>
                </div>

                <div className="pm-rewards">
                  {rewards.map((reward, index) => (
                    <span key={`${reward.label}-${index}`}>
                      {reward.label || (reward.type === 'coins' ? `${reward.value} xu` : 'May mắn')}
                    </span>
                  ))}
                </div>

                <div className="pm-spin-actions">
                  <button type="button" disabled={spinning} onClick={spin}>
                    {spinning ? 'Đang quay...' : 'Quay Ngay'}
                  </button>
                  {spinResult && <div className="pm-result">{spinResult.message}</div>}
                  {spinError && <div className="pm-error">{spinError}</div>}
                </div>

                {data.coupons?.length > 0 && (
                  <div className="pm-coupon-section">
                    <span className="pm-coupon-title">Mã giảm giá toàn sàn:</span>
                    <div className="pm-coupons">
                      {data.coupons.slice(0, 6).map((c) => (
                        <span className="pm-coupon" key={c._id}>{c.code}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
};

export default PlatformMarketingHome;