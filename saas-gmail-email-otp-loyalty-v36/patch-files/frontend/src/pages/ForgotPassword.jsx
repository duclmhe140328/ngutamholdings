import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, LockKeyhole, Mail, MessageSquareText } from 'lucide-react';
import api from '../api/axios.js';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [devCode, setDevCode] = useState('');
  const [form, setForm] = useState({ code: '', password: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestCode = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await api.post('/auth/forgot-password', { email: normalizedEmail }, { skipAuth: true });
      setEmail(normalizedEmail);
      setMaskedEmail(res.data.maskedEmail || normalizedEmail);
      setDevCode(res.data.devCode || '');
      setMessage(res.data.message || 'Đã gửi mã OTP');
      setStep('reset');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('Mật khẩu mới phải có ít nhất 6 ký tự');
    if (form.password !== form.confirmPassword) return setError('Hai mật khẩu mới chưa trùng nhau');

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email,
        code: form.code.trim(),
        password: form.password
      }, { skipAuth: true });
      navigate('/login?reset=success', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-page">
      <style>{`
        .forgot-page{min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 10%,#fff2d5 0,transparent 35%),#f7f4ee;font-family:system-ui,-apple-system,sans-serif}
        .forgot-card{width:min(470px,100%);padding:34px;border:1px solid #eadfce;border-radius:26px;background:#fff;box-shadow:0 24px 70px rgba(43,31,19,.13)}
        .forgot-icon{width:58px;height:58px;display:grid;place-items:center;border-radius:18px;background:#17130f;color:#e2bc72;margin-bottom:20px}
        .forgot-card h1{margin:0 0 8px;font:800 28px/1.15 Georgia,serif;color:#17130f}.forgot-card>p{margin:0 0 24px;color:#746a5e;line-height:1.6}
        .forgot-card label{display:block;margin:15px 0 7px;font-size:13px;font-weight:800;color:#3f382f}.forgot-input-wrap{position:relative}.forgot-input-wrap svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#9b8c78}.forgot-card input{width:100%;min-height:48px;padding:11px 13px 11px 42px;border:1px solid #dcd2c5;border-radius:12px;outline:none;font-size:16px;box-sizing:border-box}.forgot-card input:focus{border-color:#c9953c;box-shadow:0 0 0 3px rgba(201,149,60,.14)}
        .forgot-btn{width:100%;min-height:48px;margin-top:22px;border:0;border-radius:12px;background:#c99132;color:#fff;font-weight:900;font-size:15px;cursor:pointer}.forgot-btn:disabled{opacity:.65}.forgot-alert{margin:14px 0;padding:11px 13px;border-radius:11px;font-size:13px;line-height:1.45}.forgot-alert.error{background:#fff0ee;color:#a43d34;border:1px solid #f1c7c2}.forgot-alert.success{background:#eef9f2;color:#236a43;border:1px solid #c9e8d5}.forgot-dev{margin-top:10px;padding:10px;border-radius:10px;background:#fff8dd;color:#795b12;font-size:12px}.forgot-back{display:inline-flex;align-items:center;gap:7px;margin-top:20px;color:#7d5a24;font-weight:800;text-decoration:none;font-size:13px}.forgot-note{padding:12px;border-radius:12px;background:#f8f5ef;color:#655d53;font-size:12px;line-height:1.55}
      `}</style>
      <section className="forgot-card">
        <div className="forgot-icon">{step === 'request' ? <KeyRound size={28} /> : <MessageSquareText size={28} />}</div>
        <h1>{step === 'request' ? 'Quên mật khẩu' : 'Nhập OTP và mật khẩu mới'}</h1>
        <p>{step === 'request' ? 'Nhập email đăng ký. Hệ thống sẽ gửi OTP trực tiếp tới hộp thư này.' : `Mã đã được gửi tới ${maskedEmail}. OTP có hiệu lực 5 phút.`}</p>

        {error && <div className="forgot-alert error">{error}</div>}
        {message && <div className="forgot-alert success">{message}</div>}
        {devCode && <div className="forgot-dev"><b>Mã test:</b> {devCode} — chỉ hiện khi backend đang bật chế độ DEV.</div>}

        {step === 'request' ? (
          <form onSubmit={requestCode}>
            <label>Email đăng nhập</label>
            <div className="forgot-input-wrap"><Mail size={18} /><input type="email" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck="false" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@example.com" /></div>
            <button className="forgot-btn" disabled={loading}>{loading ? 'Đang gửi OTP...' : 'Gửi mã khôi phục'}</button>
          </form>
        ) : (
          <form onSubmit={resetPassword}>
            <label>Mã OTP</label>
            <div className="forgot-input-wrap"><MessageSquareText size={18} /><input required inputMode="numeric" autoComplete="one-time-code" maxLength="6" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="6 chữ số" /></div>
            <label>Mật khẩu mới</label>
            <div className="forgot-input-wrap"><LockKeyhole size={18} /><input required type="password" autoComplete="new-password" minLength="6" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Tối thiểu 6 ký tự" /></div>
            <label>Nhập lại mật khẩu mới</label>
            <div className="forgot-input-wrap"><LockKeyhole size={18} /><input required type="password" autoComplete="new-password" minLength="6" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} placeholder="Nhập lại mật khẩu" /></div>
            <button className="forgot-btn" disabled={loading}>{loading ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}</button>
            <button type="button" className="forgot-btn" style={{ background: '#eee8df', color: '#473f35', marginTop: 10 }} onClick={() => { setStep('request'); setMessage(''); setError(''); }}>Gửi lại OTP</button>
          </form>
        )}

        <div className="forgot-note" style={{ marginTop: 18 }}>Kiểm tra cả Hộp thư đến và Thư rác. Không chia sẻ mã OTP cho bất kỳ ai.</div>
        <Link className="forgot-back" to="/login"><ArrowLeft size={16} /> Quay lại đăng nhập</Link>
      </section>
    </div>
  );
};

export default ForgotPassword;
