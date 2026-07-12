import { useState } from 'react';
import api from '../api/axios.js';

export const loyaltyStorage = {
  get() {
    try { return JSON.parse(localStorage.getItem('foodhub_loyalty_identity') || 'null'); } catch { return null; }
  },
  set(value) { localStorage.setItem('foodhub_loyalty_identity', JSON.stringify(value)); },
  clear() { localStorage.removeItem('foodhub_loyalty_identity'); }
};

const PhoneOtpPanel = ({ onVerified, compact = false }) => {
  const saved = loyaltyStorage.get();
  const [channel, setChannel] = useState(saved?.verificationChannel || 'email');
  const [phone, setPhone] = useState(saved?.phone || '');
  const [email, setEmail] = useState(saved?.email || '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const changeChannel = (next) => {
    setChannel(next);
    setSent(false);
    setCode('');
    setMessage('');
  };

  const request = async () => {
    setLoading(true);
    setMessage('');
    try {
      const payload = { phone, channel };
      if (channel === 'email') payload.email = email.trim().toLowerCase();
      const res = await api.post('/loyalty/otp/request', payload);
      setPhone(res.data.phone || phone);
      if (res.data.email) setEmail(res.data.email);
      setSent(true);
      setMessage(
        res.data.devCode
          ? `Mã OTP local: ${res.data.devCode}`
          : (res.data.message || (channel === 'email' ? 'Đã gửi OTP tới email' : 'Đã gửi OTP tới số điện thoại'))
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    setMessage('');
    try {
      const payload = { phone, code, channel };
      if (channel === 'email') payload.email = email.trim().toLowerCase();
      const res = await api.post('/loyalty/otp/verify', payload);
      const identity = {
        phone: res.data.phone,
        email: res.data.email || (channel === 'email' ? email.trim().toLowerCase() : ''),
        token: res.data.loyaltyToken,
        verificationChannel: res.data.channel || channel
      };
      loyaltyStorage.set(identity);
      window.dispatchEvent(new CustomEvent('foodhub:loyalty-verified', { detail: identity }));
      onVerified?.(identity);
      setMessage(res.data.message || 'Xác thực thành công');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`phone-otp-panel ${compact ? 'compact' : ''}`}>
      <style>{`
        .phone-otp-panel .otp-channel-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
        .phone-otp-panel .otp-channel-tabs button{min-height:40px;border:1px solid #dfd3c2;border-radius:12px;background:#fff;color:#594d40;font-weight:800;padding:8px 10px;cursor:pointer}
        .phone-otp-panel .otp-channel-tabs button.active{background:#1f1710;color:#f7d69a;border-color:#1f1710}
        .phone-otp-panel .otp-field{display:grid;gap:6px;margin-bottom:9px}
        .phone-otp-panel .otp-field label{font-size:12px;font-weight:800;color:inherit;opacity:.82}
        .phone-otp-panel .otp-field input{width:100%;min-height:46px;box-sizing:border-box;border:1px solid #e1d4c1;border-radius:14px;padding:11px 13px;font-size:16px}
        .phone-otp-panel .otp-actions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center}
        .phone-otp-panel .otp-actions input{min-width:0;min-height:46px;border:1px solid #e1d4c1;border-radius:14px;padding:11px 13px;font-size:16px}
        .phone-otp-panel .otp-primary{min-height:46px;border:0;border-radius:14px;padding:10px 16px;background:#1f1710;color:#f7d69a;font-weight:900;cursor:pointer}
        .phone-otp-panel .otp-secondary{margin-top:8px;border:0;background:transparent;color:inherit;text-decoration:underline;font-weight:700;cursor:pointer;padding:4px 0}
        .phone-otp-panel .otp-help{display:block;margin-top:8px;font-size:11px;line-height:1.45;opacity:.72}
        @media(max-width:420px){.phone-otp-panel .otp-actions{grid-template-columns:1fr}.phone-otp-panel .otp-primary{width:100%}}
      `}</style>

      <div className="otp-channel-tabs" role="tablist" aria-label="Cách nhận OTP">
        <button type="button" className={channel === 'email' ? 'active' : ''} onClick={() => changeChannel('email')}>Email miễn phí</button>
        <button type="button" className={channel === 'sms' ? 'active' : ''} onClick={() => changeChannel('sms')}>SMS</button>
      </div>

      <div className="otp-field">
        <label>Số điện thoại dùng làm ví xu</label>
        <input inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09xxxxxxxx" disabled={sent} />
      </div>

      {channel === 'email' && (
        <div className="otp-field">
          <label>Email nhận mã OTP</label>
          <input type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck="false" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ten@gmail.com" disabled={sent} />
        </div>
      )}

      {!sent ? (
        <button type="button" className="otp-primary" onClick={request} disabled={loading || !phone.trim() || (channel === 'email' && !email.trim())}>
          {loading ? 'Đang gửi...' : channel === 'email' ? 'Gửi OTP qua Email' : 'Gửi OTP qua SMS'}
        </button>
      ) : (
        <>
          <div className="otp-actions">
            <input inputMode="numeric" autoComplete="one-time-code" maxLength="6" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Nhập 6 số OTP" />
            <button type="button" className="otp-primary" onClick={verify} disabled={loading || code.length < 6}>{loading ? 'Đang kiểm tra...' : 'Xác thực'}</button>
          </div>
          <button type="button" className="otp-secondary" onClick={() => { setSent(false); setCode(''); setMessage(''); }}>Đổi thông tin / gửi lại</button>
        </>
      )}

      {channel === 'email' && <small className="otp-help">Sau lần xác thực đầu tiên, email được gắn với số điện thoại ví xu để bảo vệ số dư.</small>}
      {channel === 'sms' && <small className="otp-help">SMS chỉ hoạt động khi backend có nhà cung cấp SMS. Không có SMS thì hãy chọn Email.</small>}
      {message && <small className="phone-otp-message">{message}</small>}
    </div>
  );
};

export default PhoneOtpPanel;
