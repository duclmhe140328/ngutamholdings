import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="not-found-wrapper">
      <style>{`
        .not-found-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: #f8fafc; /* Màu nền nhẹ giống trang Checkout */
          font-family: system-ui, -apple-system, sans-serif;
          padding: 24px;
          box-sizing: border-box;
        }
        
        .not-found-card {
          text-align: center;
          max-width: 440px;
          width: 100%;
          padding: 48px 32px;
          background: #ffffff;
          border-radius: 24px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
          border: 1px solid #e2e8f0;
        }

        .not-found-emoji {
          font-size: 48px;
          margin-bottom: 8px;
          display: inline-block;
          animation: float 3s ease-in-out infinite;
        }

        /* Hiệu ứng gradient mượt mà cho số 404 */
        .not-found-code {
          font-size: clamp(80px, 15vw, 110px);
          font-weight: 900;
          line-height: 1;
          margin: 0;
          background: linear-gradient(135deg, #0f172a 0%, #475569 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.04em;
        }

        .not-found-title {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 16px 0 10px 0;
        }

        .not-found-desc {
          font-size: 14px;
          color: #64748b;
          line-height: 1.6;
          margin: 0 0 32px 0;
        }

        /* Nút quay về trang chủ phong cách tinh tế */
        .not-found-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #000000;
          color: #ffffff;
          padding: 14px 32px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .not-found-btn:hover {
          background: #222222;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }

        .not-found-btn:active {
          transform: translateY(0);
        }

        /* Animation nhẹ nhàng cho icon */
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      <div className="not-found-card">
        <div className="not-found-emoji">🔍</div>
        <h1 className="not-found-code">404</h1>
        <h2 className="not-found-title">Không tìm thấy trang</h2>
        <p className="not-found-desc">
          Đường dẫn bạn truy cập không tồn tại, đã bị xóa hoặc đã được di chuyển sang một địa chỉ khác.
        </p>
        <Link className="not-found-btn" to="/">Về trang chủ</Link>
      </div>
    </div>
  );
};

export default NotFound;