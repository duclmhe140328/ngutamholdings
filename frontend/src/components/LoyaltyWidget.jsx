import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios.js';
import PhoneOtpPanel, { loyaltyStorage } from './PhoneOtpPanel.jsx';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
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
const rewardLabel = (value) => Number(value || 0) > 0
  ? Number(value).toLocaleString('vi-VN')
  : 'May mắn';

const WHEEL_COLORS = ['#F8C85C', '#F06A49', '#F5D58C', '#7EC092', '#F2A84A', '#6F9FBE', '#D781A1', '#BFA77D'];
const wheelPoint = (angle, radius) => {
  const radians = (angle * Math.PI) / 180;
  return {
    x: 120 + Math.sin(radians) * radius,
    y: 120 - Math.cos(radians) * radius
  };
};
const wheelSlicePath = (startAngle, endAngle, radius = 108) => {
  const start = wheelPoint(startAngle, radius);
  const end = wheelPoint(endAngle, radius);
  return `M 120 120 L ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)} Z`;
};

const LoyaltyWidget = ({ slug, shop }) => {
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState(() => loyaltyStorage.get());
  const [wallet, setWallet] = useState(null);
  const [offers, setOffers] = useState({ coupons: [], loyalty: {} });
  const [message, setMessage] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastReward, setLastReward] = useState(null);
  const [selectedRewardIndex, setSelectedRewardIndex] = useState(null);
  const rotationRef = useRef(0);
  const pendingSpinRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const rewards = useMemo(() => normalizeSpinRewards(wallet?.spinRewards), [wallet?.spinRewards]);
  const [wheelRewards, setWheelRewards] = useState(() => [...DEFAULT_SPIN_REWARDS]);

  useEffect(() => {
    if (!spinning) setWheelRewards(rewards);
  }, [rewards, spinning]);

  useEffect(() => () => {
    if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
  }, []);

  const loadWallet = async (current = identity) => {
    if (!current) { setWallet(null); return; }
    try {
      const res = await api.get(`/loyalty/${slug}/wallet`, { headers: { 'x-loyalty-token': current.token }, params: { phone: current.phone } });
      setWallet(res.data);
    } catch (error) {
      if (error.response?.status === 401) { loyaltyStorage.clear(); setIdentity(null); }
      setMessage(error.message);
    }
  };

  useEffect(() => {
    api.get(`/loyalty/${slug}/offers`).then((res) => setOffers(res.data)).catch(() => { });
    loadWallet();
  }, [slug]);

  const onVerified = (value) => { setIdentity(value); loadWallet(value); };
  const finishSpin = async () => {
    const pending = pendingSpinRef.current;
    if (!pending) return;

    pendingSpinRef.current = null;
    if (fallbackTimerRef.current) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    setSelectedRewardIndex(pending.rewardIndex);
    setLastReward(pending.reward);
    setMessage(pending.reward
      ? `Ô số ${pending.rewardIndex + 1}: đã cộng ${pending.reward.toLocaleString('vi-VN')} xu`
      : `Ô số ${pending.rewardIndex + 1}: chúc bạn may mắn ngày mai`);
    setSpinning(false);

    // Lấy lại số dư thật từ database sau khi bánh xe dừng.
    await loadWallet(pending.identity);
  };

  const handleWheelTransitionEnd = (event) => {
    if (event.propertyName !== 'transform') return;
    finishSpin();
  };

  const spin = async () => {
    if (!identity || spinning || wallet?.canSpinToday === false) return;
    setSpinning(true);
    setMessage('Đang xác nhận phần thưởng...');
    setLastReward(null);
    setSelectedRewardIndex(null);

    try {
      // Backend là nguồn sự thật duy nhất. Frontend không tự random.
      const res = await api.post(
        `/loyalty/${slug}/spin`,
        { phone: identity.phone },
        { headers: { 'x-loyalty-token': identity.token } }
      );

      const serverRewards = normalizeSpinRewards(res.data.spinRewards);
      const rawIndex = Number(res.data.rewardSlot?.index ?? res.data.rewardIndex);
      const rewardIndex = Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < 8
        ? rawIndex
        : 0;
      const reward = Number(
        res.data.rewardSlot?.value
        ?? res.data.reward
        ?? serverRewards[rewardIndex]
        ?? 0
      );

      // Bảo đảm nhãn đúng tại chính index mà backend trả về, kể cả khi
      // cấu hình shop vừa thay đổi và cache trình duyệt còn cũ.
      const exactRewards = [...serverRewards];
      exactRewards[rewardIndex] = reward;
      setWheelRewards(exactRewards);

      setWallet((current) => current
        ? {
          ...current,
          account: res.data.account,
          canSpinToday: false,
          spinRewards: exactRewards
        }
        : current
      );

      // V14.5: mỗi lát được vẽ với TÂM tại index * 45 độ.
      // Vì kim cố định ở 12 giờ (0 độ), chỉ cần quay lát trúng về -index*45.
      // Dùng rotationRef để không phụ thuộc state bất đồng bộ.
      const targetModulo = ((-rewardIndex * 45) % 360 + 360) % 360;
      const currentRotation = rotationRef.current;
      let finalRotation = (Math.floor(currentRotation / 360) + 6) * 360 + targetModulo;
      while (finalRotation <= currentRotation + 4 * 360) finalRotation += 360;

      rotationRef.current = finalRotation;
      pendingSpinRef.current = {
        rewardIndex,
        reward,
        identity
      };

      // Cho React render đúng 8 nhãn trước rồi mới bắt đầu animation.
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      window.requestAnimationFrame(() => setRotation(finalRotation));

      // Fallback nếu trình duyệt không phát transitionend.
      fallbackTimerRef.current = window.setTimeout(finishSpin, 2400);
    } catch (error) {
      pendingSpinRef.current = null;
      if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
      setMessage(error.response?.data?.message || error.message || 'Không thể quay lúc này');
      setSpinning(false);
      await loadWallet(identity);
    }
  };

  const exchange = async (couponId) => {
    if (!identity) return;
    try {
      const res = await api.post(`/loyalty/${slug}/exchange`, { phone: identity.phone, couponId }, { headers: { 'x-loyalty-token': identity.token } });
      setMessage(res.data.message);
      await loadWallet(identity);
    } catch (error) { setMessage(error.message); }
  };

  if (!offers.loyalty?.enabled && !offers.coupons?.length) return null;

  return (
    <>
      <style>{`
       /* Thêm vào trong khối <style> của LoyaltyWidget */
@media (max-width: 768px) {
  .loyalty-fab {
    bottom: 20px !important; /* Dịch xuống dưới */
    right: 10px !important;   /* Góc trái dưới */
    left: auto !important;   /* Hủy căn trái nếu có */
    display: flex;
  justify-content: flex-end; /* Căn phải */
  align-items: flex-end;
    
  }
}
      `}</style>
      <button type="button" className="loyalty-fab" onClick={() => setOpen(true)}>
        <span>🪙</span><div><b>{wallet?.account?.coinBalance?.toLocaleString('vi-VN') || 'Xu & ưu đãi'}</b><small>{wallet ? 'xu tại shop' : `Hoàn ${shop.cashbackPercent || offers.loyalty?.cashbackPercent || 0}%`}</small></div>
      </button>
      {open && <button type="button" className="loyalty-backdrop" onClick={() => setOpen(false)} aria-label="Đóng ví xu" />}
      <aside className={`loyalty-panel ${open ? 'open' : ''}`}>
        <header><div><span>FOODHUB REWARDS</span><h2>Ví xu & ưu đãi</h2></div><button type="button" onClick={() => setOpen(false)}>×</button></header>
        {!identity ? (
          <section className="loyalty-login"><div className="loyalty-login-icon">🪙</div><h3>Xác thực số điện thoại</h3><p>Mỗi số điện thoại có một ví xu riêng tại <b>{shop.name}</b>. Production cần OTP SMS thật để bảo vệ điểm thưởng.</p><PhoneOtpPanel onVerified={onVerified} /></section>
        ) : (
          <div className="loyalty-panel-body">
            <section className="wallet-balance-card">
              <div><small>SỐ DƯ HIỆN TẠI</small><b>{Number(wallet?.account?.coinBalance || 0).toLocaleString('vi-VN')} xu</b><p>1.000 xu = {money(1000)}</p></div>
              <button type="button" onClick={() => { loyaltyStorage.clear(); setIdentity(null); setWallet(null); }}>Đổi SĐT</button>
            </section>

            {shop.dailySpinEnabled !== false && <section className="daily-spin-card">
              <div className="daily-spin-heading"><div><span>MỖI NGÀY 1 LƯỢT</span><h3>Vòng quay tích xu</h3></div><small>{identity.phone}</small></div>
              <div className="spin-wheel-wrap spin-wheel-wrap-v2">
                <span className="spin-pointer" aria-hidden="true">▼</span>
                <div
                  className="spin-wheel-rotor-host"
                  style={{ transform: `rotate(${rotation}deg)` }}
                  onTransitionEnd={handleWheelTransitionEnd}
                >
                  <svg
                    className="spin-wheel-svg"
                    viewBox="0 0 240 240"
                    role="img"
                    aria-label="Vòng quay tích xu gồm 8 ô phần thưởng"
                  >
                    <circle cx="120" cy="120" r="114" className="spin-wheel-rim" />
                    {wheelRewards.map((reward, index) => {
                      // Tâm ô i nằm đúng tại i * 45°. Ô 1 vì thế có tâm ở 12 giờ.
                      const centerAngle = index * 45;
                      const startAngle = centerAngle - 22.5;
                      const endAngle = centerAngle + 22.5;
                      const labelPoint = wheelPoint(centerAngle, 72);
                      const selected = selectedRewardIndex === index;
                      const label = rewardLabel(reward);
                      return (
                        <g key={`slot-${index}`} className={`spin-wheel-slot ${selected ? 'selected-slot' : ''}`} data-slot={index + 1} data-value={reward}>
                          <path d={wheelSlicePath(startAngle, endAngle)} fill={WHEEL_COLORS[index]} />
                          <text
                            x={labelPoint.x}
                            y={labelPoint.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className={label.length > 7 ? 'spin-wheel-label spin-wheel-label-long' : 'spin-wheel-label'}
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="spin-wheel-hub-html" aria-hidden="true"><b>FH</b><small>QUAY</small></div>
              </div>
              <button type="button" className="spin-button" onClick={spin} disabled={spinning || wallet?.canSpinToday === false}>{spinning ? 'Đang quay...' : wallet?.canSpinToday === false ? 'Hôm nay đã quay' : 'Quay ngay'}</button>
              {lastReward !== null && !spinning && <div className="spin-result-card"><span>Phần thưởng hôm nay · Ô {Number(selectedRewardIndex) + 1}</span><b>{Number(lastReward).toLocaleString('vi-VN')} xu</b><small>Số dư đã được cộng trực tiếp vào ví của {identity.phone}.</small></div>}
            </section>}

            {message && <div className="loyalty-message">{message}</div>}

            <section className="reward-section"><div className="reward-section-head"><div><span>ĐỔI XU</span><h3>Voucher dành cho bạn</h3></div><small>Dùng xu để đổi mã riêng</small></div><div className="reward-list">{(wallet?.rewards || []).map((reward) => <article key={reward._id}><div><b>{reward.title}</b><p>{reward.discountType === 'percentage' ? `Giảm ${reward.discountValue}%` : `Giảm ${money(reward.discountValue)}`} · Đơn từ {money(reward.minOrder)}</p></div><button type="button" disabled={Number(wallet?.account?.coinBalance || 0) < reward.coinCost} onClick={() => exchange(reward._id)}>{Number(reward.coinCost).toLocaleString('vi-VN')} xu</button></article>)}{!wallet?.rewards?.length && <p className="empty-reward">Shop chưa mở voucher đổi xu.</p>}</div></section>

            <section className="reward-section"><div className="reward-section-head"><div><span>VOUCHER CỦA TÔI</span><h3>Mã đã đổi</h3></div></div><div className="my-voucher-list">{(wallet?.vouchers || []).map((voucher) => <article key={voucher._id}><div><b>{voucher.couponId?.title || 'Voucher'}</b><code>{voucher.code}</code></div><button type="button" onClick={() => navigator.clipboard?.writeText(voucher.code)}>Sao chép</button></article>)}{!wallet?.vouchers?.length && <p className="empty-reward">Chưa có voucher đã đổi.</p>}</div></section>
          </div>
        )}
        <section className="public-coupon-section">
          <div><span>MÃ ĐANG ÁP DỤNG</span><h3>Ưu đãi công khai</h3></div>
          <div>{(offers.coupons || []).filter((coupon) => !coupon.exchangeable).map((coupon) => <article key={coupon._id}><div><b>{coupon.code}</b><p>{coupon.title} · {coupon.discountType === 'percentage' ? `Giảm ${coupon.discountValue}%` : `Giảm ${money(coupon.discountValue)}`}</p></div><button type="button" onClick={() => navigator.clipboard?.writeText(coupon.code)}>Sao chép</button></article>)}{!(offers.coupons || []).some((coupon) => !coupon.exchangeable) && <small>Hiện chưa có mã công khai.</small>}</div>
        </section>
      </aside>
    </>
  );
};

export default LoyaltyWidget;
