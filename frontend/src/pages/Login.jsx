import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  Mail, Lock, AlertCircle, ArrowRight, 
  Package, ShoppingCart, TrendingUp, Sparkles 
} from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const resetSuccess = new URLSearchParams(window.location.search).get('reset') === 'success';
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      {/* KHỐI CSS NỘI BỘ */}
      <style>{`
        :root {
          --primary-dark: #0f172a;
          --primary-gold: #f59e0b;
          --primary-gold-hover: #d97706;
          --bg-light: #f8fafc;
          --text-main: #334155;
          --text-light: #64748b;
          --border-color: #e2e8f0;
        }

        .login-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--bg-light);
          padding: 24px;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .login-container {
          display: flex;
          width: 100%;
          max-width: 1000px;
          background: #fff;
          border-radius: 24px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
          overflow: hidden;
        }

        /* Phần Form Đăng nhập (Bên trái) */
        .login-form-section {
          flex: 1;
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .login-header {
          margin-bottom: 32px;
        }
        .login-header h1 {
          font-size: 28px;
          font-weight: 700;
          color: var(--primary-dark);
          margin: 0 0 8px 0;
        }
        .login-header p {
          color: var(--text-light);
          margin: 0;
          font-size: 15px;
        }

        .alert-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background-color: #fef2f2;
          color: #dc2626;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 24px;
          border: 1px solid #fee2e2;
        }

        .alert-success {
          background:#ecfdf3;color:#18794e;border:1px solid #bde7ce;padding:12px 16px;border-radius:8px;font-size:14px;font-weight:600;margin-bottom:20px;
        }
        .forgot-password-row { display:flex; justify-content:flex-end; margin-top:-8px; margin-bottom:8px; }
        .forgot-password-row a { color:var(--primary-gold-hover); font-size:13px; font-weight:700; text-decoration:none; }
        .forgot-password-row a:hover { text-decoration:underline; }

        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-main);
          margin-bottom: 8px;
        }
        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-icon {
          position: absolute;
          left: 14px;
          color: #94a3b8;
        }
        .form-input {
          width: 100%;
          padding: 12px 16px 12px 42px;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          font-size: 15px;
          color: var(--primary-dark);
          transition: all 0.2s;
          box-sizing: border-box;
          outline: none;
        }
        .form-input::placeholder { color: #cbd5e1; }
        .form-input:focus {
          border-color: var(--primary-gold);
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
        }

        .btn-submit {
          width: 100%;
          background: var(--primary-gold);
          color: #fff;
          border: none;
          padding: 14px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 12px;
          box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.2);
        }
        .btn-submit:hover:not(:disabled) {
          background: var(--primary-gold-hover);
          transform: translateY(-1px);
        }
        .btn-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .register-link {
          margin-top: 24px;
          text-align: center;
          font-size: 14px;
          color: var(--text-light);
        }
        .register-link a {
          color: var(--primary-gold);
          font-weight: 600;
          text-decoration: none;
          margin-left: 4px;
          transition: color 0.2s;
        }
        .register-link a:hover { color: var(--primary-gold-hover); text-decoration: underline; }

        /* Phần Visual (Bên phải) */
        .login-visual-section {
          flex: 1;
          background: linear-gradient(135deg, var(--primary-dark) 0%, #1e293b 100%);
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          color: #fff;
          overflow: hidden;
        }
        
        /* Background Pattern */
        .visual-bg-pattern {
          position: absolute;
          inset: 0;
          opacity: 0.05;
          background-image: radial-gradient(#fff 1px, transparent 1px);
          background-size: 24px 24px;
        }

        .visual-content { position: relative; z-index: 10; }
        
        .pill-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(245, 158, 11, 0.15);
          color: var(--primary-gold);
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 24px;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .login-visual-section h2 {
          font-size: 32px;
          font-weight: 700;
          line-height: 1.3;
          margin: 0 0 16px 0;
        }
        .login-visual-section p {
          color: #94a3b8;
          font-size: 16px;
          line-height: 1.6;
          margin: 0 0 40px 0;
        }

        /* Mini Dashboard UI */
        .mini-dashboard {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 24px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .stat-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .stat-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-icon.blue { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
        .stat-icon.green { background: rgba(16, 185, 129, 0.2); color: #34d399; }
        .stat-icon.gold { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
        
        .stat-value { font-size: 20px; font-weight: 700; color: #fff; line-height: 1; }
        .stat-label { font-size: 13px; color: #94a3b8; font-weight: 500; }

        /* Responsive */
        @media (max-width: 860px) {
          .login-visual-section { display: none; }
          .login-form-section { padding: 40px 24px; }
          .login-container { max-width: 450px; }
        }
      `}</style>

      <div className="login-container">
        
        {/* CỘT TRÁI: FORM ĐĂNG NHẬP */}
        <div className="login-form-section">
          <div className="login-header">
            <h1>Đăng nhập</h1>
            <p>Vào dashboard để quản lý shop, sản phẩm và đơn hàng.</p>
          </div>

          {error && (
            <div className="alert-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {resetSuccess && !error && <div className="alert-success">Mật khẩu đã được đổi thành công. Hãy đăng nhập lại.</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input 
                  className="form-input"
                  name="email" 
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false" 
                  value={form.email} 
                  onChange={handleChange} 
                  placeholder="seller@example.com" 
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Mật khẩu</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input 
                  className="form-input"
                  name="password" 
                  type="password"
                  autoComplete="current-password" 
                  value={form.password} 
                  onChange={handleChange} 
                  placeholder="••••••••" 
                  required
                />
              </div>
            </div>

            <div className="forgot-password-row"><Link to="/forgot-password">Quên mật khẩu?</Link></div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}
              {!loading && <ArrowRight size={18} />}
            </button>

            <div className="register-link">
              Chưa có tài khoản? <Link to="/register">Đăng ký tạo shop</Link>
            </div>
          </form>
        </div>

        {/* CỘT PHẢI: VISUAL HIGHLIGHT (Ẩn trên Mobile) */}
        <div className="login-visual-section">
          <div className="visual-bg-pattern"></div>
          
          <div className="visual-content">
            <div className="pill-badge">
              <Sparkles size={14} /> Seller Console
            </div>
            <h2>Dashboard tinh gọn.<br/>Xử lý bán hàng mỗi ngày.</h2>
            <p>Theo dõi đơn hàng mới, cập nhật sản phẩm, thay đổi trạng thái giao hàng và phân tích doanh thu trực quan ngay trên một nền tảng.</p>
            
            {/* Widget Giả lập Dashboard */}
            <div className="mini-dashboard">
              <div className="stat-card">
                <div className="stat-icon blue"><Package size={18} /></div>
                <span className="stat-value">24</span>
                <span className="stat-label">Sản phẩm</span>
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><ShoppingCart size={18} /></div>
                <span className="stat-value">12</span>
                <span className="stat-label">Đơn mới</span>
              </div>
              <div className="stat-card">
                <div className="stat-icon gold"><TrendingUp size={18} /></div>
                <span className="stat-value">8.6M</span>
                <span className="stat-label">Doanh thu</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;