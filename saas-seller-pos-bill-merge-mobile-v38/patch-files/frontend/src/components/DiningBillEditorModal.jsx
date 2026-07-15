import { useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  CheckCircle2,
  Minus,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import api from '../api/axios.js';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const DiningBillEditorModal = ({ sessionId, mode = 'pay', onClose, onDone }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [loyaltyPhone, setLoyaltyPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/dining-sessions/${sessionId}/bill-editor`);
      setData(res.data);
      setItems(res.data.items || []);
      setCouponCode(res.data.couponCode || '');
      setLoyaltyPhone(res.data.loyaltyPhone || '');
      setPreview({
        subtotal: Number(res.data.currentBill?.subtotal ?? res.data.currentBill?.totalAmount ?? 0),
        couponDiscount: Number(res.data.couponDiscount || 0),
        totalAmount: Number(res.data.currentBill?.totalAmount || 0)
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [sessionId]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.products || []).filter((product) => !query || `${product.name} ${product.category || ''}`.toLowerCase().includes(query)).slice(0, 12);
  }, [data, search]);

  const changeQuantity = (productId, quantity) => {
    setItems((current) => current
      .map((item) => String(item.productId) === String(productId) ? { ...item, quantity: Math.max(0, Number(quantity || 0)) } : item)
      .filter((item) => Number(item.quantity || 0) > 0));
    setPreview(null);
  };

  const addProduct = (product) => {
    const price = Number(product.salePrice > 0 ? product.salePrice : product.price);
    setItems((current) => {
      const found = current.find((item) => String(item.productId) === String(product._id));
      if (found) return current.map((item) => String(item.productId) === String(product._id) ? { ...item, quantity: Number(item.quantity || 0) + 1 } : item);
      return [...current, { productId: product._id, name: product.name, image: product.images?.[0] || '', price, quantity: 1 }];
    });
    setPreview(null);
  };

  const previewBill = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/dining-sessions/${sessionId}/bill-preview`, {
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        couponCode,
        loyaltyPhone
      });
      setPreview(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submit = async (action) => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/dining-sessions/${sessionId}/settle-bill`, {
        action,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        couponCode,
        loyaltyPhone,
        skipLoyalty: !loyaltyPhone,
        paymentMethod,
        paymentNote: 'Seller xác nhận tại POS',
        reason: 'Seller đóng bàn tại POS'
      });
      onDone?.(res.data);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const paid = data?.session?.paymentStatus === 'paid';
  const canEdit = Boolean(data?.canEdit);
  const primaryAction = mode === 'close' ? (paid ? 'close' : 'pay_and_close') : 'pay';
  const primaryLabel = mode === 'close'
    ? (paid ? 'Đóng bàn' : 'Thanh toán & đóng bàn')
    : 'Xác nhận thanh toán';

  return (
    <div className="dbem-overlay" role="dialog" aria-modal="true">
      <style>{styles}</style>
      <section className="dbem-modal">
        <header>
          <div><small>POS / HÓA ĐƠN TỔNG</small><h2>{data ? `Bàn ${data.session.tableNumber}` : 'Đang tải hóa đơn'}</h2><p>{data?.session?.sessionCode || ''}</p></div>
          <button type="button" onClick={onClose}><X size={22} /></button>
        </header>

        {loading ? <div className="dbem-state">Đang tải dữ liệu hóa đơn...</div> : (
          <div className="dbem-body">
            {error && <div className="dbem-error">{error}</div>}
            {!canEdit && <div className="dbem-warning">Hóa đơn đã thu một phần hoặc đã thanh toán. Không thể sửa món/voucher, chỉ có thể đóng bàn khi đã thu đủ.</div>}

            <div className="dbem-layout">
              <div className="dbem-main">
                <section className="dbem-card">
                  <div className="dbem-title"><span>Sản phẩm trong hóa đơn</span><b>{items.length} dòng</b></div>
                  <div className="dbem-lines">
                    {items.map((item) => (
                      <article key={item.productId}>
                        <img src={item.image || 'https://placehold.co/100/f4f1ec/8b6a3a?text=FH'} alt="" />
                        <div><b>{item.name}</b><small>{money(item.price)} / món</small></div>
                        <div className="dbem-qty">
                          <button type="button" disabled={!canEdit} onClick={() => changeQuantity(item.productId, item.quantity - 1)}><Minus size={15} /></button>
                          <span>{item.quantity}</span>
                          <button type="button" disabled={!canEdit} onClick={() => changeQuantity(item.productId, item.quantity + 1)}><Plus size={15} /></button>
                        </div>
                        <strong>{money(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
                        <button type="button" className="remove" disabled={!canEdit} onClick={() => changeQuantity(item.productId, 0)}><Trash2 size={16} /></button>
                      </article>
                    ))}
                    {!items.length && <div className="dbem-empty">Hóa đơn đang trống</div>}
                  </div>
                </section>

                {canEdit && <section className="dbem-card">
                  <div className="dbem-title"><span>Thêm sản phẩm</span></div>
                  <div className="dbem-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên món hoặc danh mục..." /></div>
                  <div className="dbem-products">
                    {filteredProducts.map((product) => <button type="button" key={product._id} onClick={() => addProduct(product)}><img src={product.images?.[0] || 'https://placehold.co/100'} alt=""/><span><b>{product.name}</b><small>{money(product.salePrice > 0 ? product.salePrice : product.price)}</small></span><Plus size={17}/></button>)}
                  </div>
                </section>}
              </div>

              <aside className="dbem-side">
                <section className="dbem-card">
                  <div className="dbem-title"><span><BadgePercent size={17}/> Voucher / mã giảm giá</span></div>
                  <input disabled={!canEdit} value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setPreview(null); }} placeholder="Nhập mã giảm giá" />
                  <label>Số điện thoại tích xu / voucher</label>
                  <input disabled={!canEdit} value={loyaltyPhone} onChange={(e) => { setLoyaltyPhone(e.target.value); setPreview(null); }} placeholder="03xxxxxxxx" />
                  {canEdit && <button type="button" className="secondary" disabled={saving || !items.length} onClick={previewBill}>{saving ? 'Đang tính...' : 'Áp dụng & tính lại'}</button>}
                </section>

                <section className="dbem-card totals">
                  <div><span>Tạm tính</span><b>{money(preview?.subtotal ?? items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0))}</b></div>
                  <div><span>Giảm voucher</span><b>-{money(preview?.couponDiscount || 0)}</b></div>
                  <div className="grand"><span>Khách thanh toán</span><b>{money(preview?.totalAmount ?? data?.currentBill?.totalAmount ?? 0)}</b></div>
                </section>

                {!paid && <section className="dbem-card">
                  <label>Phương thức thanh toán</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="cash">Tiền mặt</option>
                    <option value="bank_transfer">Chuyển khoản</option>
                    <option value="vnpay">VNPAY</option>
                  </select>
                </section>}
              </aside>
            </div>
          </div>
        )}

        {!loading && <footer>
          <button type="button" className="cancel" onClick={onClose}>Hủy</button>
          {canEdit && <button type="button" className="save" disabled={saving || !items.length} onClick={() => submit('save')}>Lưu hóa đơn</button>}
          <button type="button" className="primary" disabled={saving || (!paid && !items.length)} onClick={() => submit(primaryAction)}>{saving ? 'Đang xử lý...' : <><CheckCircle2 size={18}/>{primaryLabel}</>}</button>
        </footer>}
      </section>
    </div>
  );
};

const styles = `
.dbem-overlay{position:fixed;inset:0;z-index:1800;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.68);backdrop-filter:blur(6px)}.dbem-overlay *{box-sizing:border-box}.dbem-modal{width:min(1120px,100%);max-height:94dvh;display:flex;flex-direction:column;overflow:hidden;border-radius:24px;background:#f7f8f7;box-shadow:0 30px 90px rgba(0,0,0,.32)}.dbem-modal>header{display:flex;align-items:flex-start;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #e3e8e5;background:#fff}.dbem-modal>header small{color:#a4772b;font-size:10px;font-weight:900;letter-spacing:.12em}.dbem-modal>header h2{margin:4px 0 2px;font-size:25px}.dbem-modal>header p{margin:0;color:#64748b;font:12px monospace}.dbem-modal>header button{width:40px;height:40px;display:grid;place-items:center;border:1px solid #e2e8f0;border-radius:12px;background:#fff;cursor:pointer}.dbem-body{overflow:auto;padding:18px}.dbem-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px}.dbem-main,.dbem-side{display:flex;flex-direction:column;gap:14px}.dbem-card{padding:16px;border:1px solid #e1e7e3;border-radius:18px;background:#fff}.dbem-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.dbem-title span{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:900}.dbem-title>b{padding:5px 8px;border-radius:999px;background:#f0f4f2;color:#476158;font-size:10px}.dbem-lines{display:flex;flex-direction:column;gap:8px}.dbem-lines article{display:grid;grid-template-columns:52px minmax(0,1fr) auto 100px 36px;align-items:center;gap:10px;padding:9px;border:1px solid #edf0ee;border-radius:13px}.dbem-lines img,.dbem-products img{width:52px;height:52px;object-fit:contain;padding:3px;border-radius:10px;background:#f5f2ed}.dbem-lines article>div>b,.dbem-lines article>div>small{display:block}.dbem-lines article>div>b{font-size:13px}.dbem-lines article>div>small{margin-top:4px;color:#8c7657;font-size:10px}.dbem-lines strong{text-align:right;font-size:13px}.dbem-qty{display:grid;grid-template-columns:30px 28px 30px;align-items:center;text-align:center}.dbem-qty button,.dbem-lines .remove{height:30px;display:grid;place-items:center;border:1px solid #dfe5e1;border-radius:8px;background:#fff;cursor:pointer}.dbem-lines .remove{color:#c2413a}.dbem-qty button:disabled,.dbem-lines .remove:disabled{opacity:.35;cursor:not-allowed}.dbem-search{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:0 12px;border:1px solid #dfe5e1;border-radius:12px}.dbem-search input{flex:1;border:0!important;padding:12px 0!important;outline:0}.dbem-products{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dbem-products>button{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px;border:1px solid #e4e9e6;border-radius:12px;background:#fafbfa;text-align:left;cursor:pointer}.dbem-products span b,.dbem-products span small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dbem-products span b{font-size:11px}.dbem-products span small{margin-top:3px;color:#9a6b28;font-size:10px}.dbem-side input,.dbem-side select{width:100%;min-height:44px;margin-bottom:10px;padding:10px 12px;border:1px solid #dbe2de;border-radius:11px;background:#fff;outline:0}.dbem-side label{display:block;margin:4px 0 7px;color:#64748b;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.dbem-side .secondary{width:100%;min-height:42px;border:0;border-radius:11px;background:#173f35;color:#fff;font-weight:900;cursor:pointer}.totals>div{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px dashed #dde4e0;font-size:13px}.totals>div:last-child{border-bottom:0}.totals .grand{padding-top:13px;font-size:17px;font-weight:900}.totals .grand b{color:#b45309}.dbem-error,.dbem-warning{margin-bottom:12px;padding:11px 13px;border-radius:12px;font-size:12px;font-weight:700}.dbem-error{background:#fee2e2;color:#991b1b}.dbem-warning{background:#fff7ed;color:#9a5a13}.dbem-state,.dbem-empty{padding:35px;text-align:center;color:#64748b}.dbem-modal>footer{display:flex;justify-content:flex-end;gap:9px;padding:14px 18px;border-top:1px solid #e2e8e5;background:#fff}.dbem-modal>footer button{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 16px;border-radius:11px;font-weight:900;cursor:pointer}.dbem-modal>footer .cancel{border:1px solid #dce3df;background:#fff}.dbem-modal>footer .save{border:1px solid #c7a96f;background:#fffaf0;color:#805a1e}.dbem-modal>footer .primary{border:0;background:#173f35;color:#fff}.dbem-modal>footer button:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:820px){.dbem-overlay{align-items:flex-end;padding:0}.dbem-modal{max-height:96dvh;border-radius:22px 22px 0 0}.dbem-layout{grid-template-columns:1fr}.dbem-side{display:grid;grid-template-columns:1fr 1fr;align-items:start}.dbem-side .totals{grid-column:1/-1}.dbem-lines article{grid-template-columns:46px minmax(0,1fr) auto 34px}.dbem-lines article>strong{grid-column:2/4;text-align:left}.dbem-products{grid-template-columns:1fr}.dbem-modal>footer{position:sticky;bottom:0;display:grid;grid-template-columns:1fr 1fr;padding-bottom:calc(14px + env(safe-area-inset-bottom,0px))}.dbem-modal>footer .cancel{display:none}.dbem-modal>footer .primary:last-child{grid-column:1/-1}.dbem-modal>header{padding-top:calc(16px + env(safe-area-inset-top,0px))}}
@media(max-width:520px){.dbem-body{padding:10px}.dbem-card{padding:12px;border-radius:15px}.dbem-side{grid-template-columns:1fr}.dbem-side .totals{grid-column:auto}.dbem-lines article{gap:7px}.dbem-qty{grid-template-columns:28px 24px 28px}.dbem-modal>footer{grid-template-columns:1fr}.dbem-modal>footer .save,.dbem-modal>footer .primary{grid-column:1!important}}
`;

export default DiningBillEditorModal;
