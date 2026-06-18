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
  const [phone, setPhone] = useState(saved?.phone || '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const request = async () => {
    setLoading(true); setMessage('');
    try {
      const res = await api.post('/loyalty/otp/request', { phone });
      setPhone(res.data.phone);
      setSent(true);
      setMessage(res.data.devCode ? `Mã OTP local: ${res.data.devCode}` : 'Đã gửi OTP tới số điện thoại');
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  };
  const verify = async () => {
    setLoading(true); setMessage('');
    try {
      const res = await api.post('/loyalty/otp/verify', { phone, code });
      const identity = { phone: res.data.phone, token: res.data.loyaltyToken };
      loyaltyStorage.set(identity);
      onVerified?.(identity);
      setMessage('Xác thực thành công');
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  };

  return (
    <div className={`phone-otp-panel ${compact ? 'compact' : ''}`}>
      <div className="phone-otp-row">
        <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại 09xxxxxxxx" />
        {!sent && <button type="button" onClick={request} disabled={loading}>{loading ? 'Đang gửi...' : 'Nhận OTP'}</button>}
      </div>
      {sent && <div className="phone-otp-row"><input inputMode="numeric" maxLength="6" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="Nhập 6 số OTP" /><button type="button" onClick={verify} disabled={loading || code.length < 6}>Xác thực</button></div>}
      {message && <small className="phone-otp-message">{message}</small>}
    </div>
  );
};

export default PhoneOtpPanel;
