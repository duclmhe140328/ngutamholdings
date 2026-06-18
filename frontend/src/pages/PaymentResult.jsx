import { Link, useSearchParams } from 'react-router-dom';

const PaymentResult = () => {
  const [params] = useSearchParams();
  const success = params.get('status') === 'success';
  const orderCode = params.get('orderCode');
  const shopSlug = params.get('shopSlug');
  return (
    <section className="checkout-stage">
      <div className="success-receipt">
        <span className={`success-icon ${success ? '' : 'failed'}`}>{success ? '✓' : '!'}</span>
        <span className="eyebrow">VNPAY result</span>
        <h1>{success ? 'Thanh toán thành công' : 'Thanh toán chưa thành công'}</h1>
        <p>Mã đơn <b>#{orderCode || '—'}</b></p>
        <p className="muted">{params.get('message') || 'Trạng thái giao dịch đã được cập nhật.'}</p>
        <Link className="btn-gold" to={shopSlug ? `/shop/${shopSlug}` : '/'}>{shopSlug ? 'Quay lại cửa hàng' : 'Về trang chủ'}</Link>
      </div>
    </section>
  );
};

export default PaymentResult;
