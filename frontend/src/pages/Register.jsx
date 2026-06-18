import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', businessType: 'restaurant' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      sessionStorage.setItem('pending_business_type', form.businessType);
      navigate('/create-shop');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-stage">
      <div className="auth-luxury-panel">
        <div className="auth-story">
          <span className="eyebrow">Merchant onboarding</span>
          <h1>Tạo không gian bán hàng mang dấu ấn riêng.</h1>
          <p>Từ nhà hàng gọi món tại bàn đến cửa hàng giao hàng toàn quốc — một hệ thống quản lý thống nhất.</p>
          <div className="auth-feature-list">
            <span>QR riêng từng bàn</span><span>POS & quản lý thanh toán</span><span>Chat realtime</span><span>Telegram báo đơn</span>
          </div>
        </div>

        <form className="auth-luxury-card" onSubmit={handleSubmit}>
          <span className="step-kicker">Bước 1 / 2</span>
          <h2>Đăng ký tài khoản</h2>
          <p className="muted">Chọn mô hình trước để hệ thống thiết lập đúng luồng bán hàng.</p>
          {error && <div className="alert error">{error}</div>}

          <div className="business-choice-grid">
            <button type="button" className={form.businessType === 'restaurant' ? 'selected' : ''} onClick={() => setForm({ ...form, businessType: 'restaurant' })}>
              <span>🍽</span><b>Nhà hàng / quán ăn</b><small>Order tại bàn, mang về hoặc giao tận nơi</small>
            </button>
            <button type="button" className={form.businessType === 'retail' ? 'selected' : ''} onClick={() => setForm({ ...form, businessType: 'retail' })}>
              <span>🛍</span><b>Cửa hàng thương mại</b><small>Bán sản phẩm, nhận tại shop hoặc gửi hàng</small>
            </button>
          </div>

          <div className="form-grid two">
            <div><label>Họ tên chủ cửa hàng</label><input required name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nguyễn Văn A" /></div>
            <div><label>Số điện thoại</label><input name="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xxxxxxxx" /></div>
          </div>
          <label>Email đăng nhập</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@example.com" />
          <label>Mật khẩu</label><input required type="password" minLength="6" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 6 ký tự" />
          <button className="btn-gold full" disabled={loading}>{loading ? 'Đang tạo tài khoản...' : 'Tiếp tục thiết lập cửa hàng'}</button>
          <p className="muted center">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
        </form>
      </div>
    </section>
  );
};

export default Register;
