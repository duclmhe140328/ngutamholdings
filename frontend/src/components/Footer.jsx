import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className="lux-footer">
    <div className="container footer-cta">
      <div><span className="eyebrow">Launch your space</span><h2>Biến thực đơn hoặc bộ sưu tập của bạn thành trải nghiệm số.</h2></div>
      <Link className="btn-gold" to="/register">Bắt đầu thiết lập</Link>
    </div>
    <div className="container footer-grid">
      <div className="footer-brand">

        <img src="/icons/icon-192.png" alt="Ngự Tâm Holdings Logo" style={{ width: '70px', height: '70px' }} />
      <h3>Ngự Tâm Holdings</h3><p>Nền tảng vận hành đa cửa hàng cho nhà hàng, quán ăn và thương mại điện tử.</p><div className="socials"><a href="tel:0900000000">☎</a><a href="mailto:support@example.com">✉</a><a href="https://zalo.me/0900000000">Z</a></div></div>
      <div><h4>Sản phẩm</h4><Link to="/register">QR gọi món</Link><Link to="/register">POS tại quầy</Link><Link to="/register">Website bán hàng</Link><Link to="/register">Chat realtime</Link></div>
      <div><h4>Vận hành</h4><Link to="/dashboard">Seller Center</Link><Link to="/admin">Admin Center</Link><a href="#features">Thông báo đơn</a><a href="#merchants">Khám phá shop</a></div>
      <div><h4>Liên hệ</h4><p>Hotline: 0900 000 000</p><p>Email: support@example.com</p><p>Sóc Sơn, Hà Nội</p><small>Hỗ trợ mỗi ngày 08:00–22:00</small></div>
    </div>
    <div className="container footer-bottom"><span>© 2026 Ngự Tâm Holdings</span><span>Điều khoản · Bảo mật · Quy định hàng hóa</span></div>
  </footer>
);

export default Footer;
