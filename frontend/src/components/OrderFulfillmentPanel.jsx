import React from 'react';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const fmt = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const pick = (obj, keys) => {
  for (const key of keys) {
    const parts = key.split('.');
    let value = obj;
    for (const part of parts) value = value?.[part];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
};

const getLatLng = (order) => {
  const lat = pick(order, ['customerLatitude', 'deliveryLatitude', 'shippingLatitude', 'deliveryLocation.lat', 'deliveryLocation.latitude', 'shippingLocation.lat', 'shippingLocation.latitude', 'location.lat', 'location.latitude', 'coordinates.lat', 'latitude', 'lat']);
  const lng = pick(order, ['customerLongitude', 'deliveryLongitude', 'shippingLongitude', 'deliveryLocation.lng', 'deliveryLocation.longitude', 'shippingLocation.lng', 'shippingLocation.longitude', 'location.lng', 'location.longitude', 'coordinates.lng', 'longitude', 'lng']);
  if (!lat || !lng) return null;
  return { lat, lng };
};

export default function OrderFulfillmentPanel({ order, onClose }) {
  if (!order) return null;

  const type = String(order.orderType || order.fulfillmentType || order.deliveryMethod || '').toLowerCase();
  const isPickup = type.includes('pickup') || type.includes('takeaway') || type.includes('take_away') || type.includes('self') || type.includes('take');
  const isDelivery = type.includes('delivery') || type.includes('ship') || type.includes('shipping');
  const label = isDelivery ? 'Giao hàng' : isPickup ? 'Tự đến lấy' : (order.tableNumber ? `Tại bàn ${order.tableNumber}` : 'Đơn hàng');

  const customerName = pick(order, ['customerName', 'buyerName', 'receiverName', 'recipientName', 'shippingName', 'deliveryName']) || 'Khách hàng';
  const phone = pick(order, ['phone', 'customerPhone', 'receiverPhone', 'recipientPhone', 'shippingPhone', 'deliveryPhone']);
  const address = pick(order, [
    'deliveryLocation.address', 'shippingLocation.address', 'location.address',
    'deliveryAddress', 'shippingAddress', 'customerAddress', 'address',
    'receiverAddress', 'recipientAddress', 'fullAddress'
  ]);
  const note = pick(order, [
    'customerNote', 'checkoutNote', 'deliveryNote', 'shippingNote', 'pickupNote',
    'note', 'notes', 'orderNote', 'message', 'deliveryLocation.note', 'shippingLocation.note'
  ]);
  const pickupTime = pick(order, ['pickupAt', 'pickupTime', 'pickupDateTime', 'pickupDate', 'scheduledPickupAt', 'takeawayTime']);
  const deliveryTime = pick(order, ['deliveryAt', 'deliveryTime', 'scheduledDeliveryAt', 'shippingTime']);
  const latLng = getLatLng(order);
  const mapQuery = latLng ? `${latLng.lat},${latLng.lng}` : address;
  const mapUrl = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}` : '';
  const embedUrl = mapQuery ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&output=embed` : '';

  return (
    <div className="fh-fulfillment-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="fh-fulfillment-modal" onMouseDown={(event) => event.stopPropagation()}>
        <style>{`
          .fh-fulfillment-overlay{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.56);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:22px}
          .fh-fulfillment-modal{width:min(760px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(180deg,#fff,#f8fafc);border:1px solid rgba(226,232,240,.9);border-radius:24px;box-shadow:0 28px 90px rgba(15,23,42,.28);padding:24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a}
          .fh-fulfillment-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
          .fh-fulfillment-head h2{margin:0 0 6px;font-size:22px;font-weight:900;letter-spacing:-.02em}
          .fh-fulfillment-head p{margin:0;color:#64748b;font-size:14px}.fh-fulfillment-close{width:42px;height:42px;border-radius:14px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font-size:22px;line-height:1}.fh-fulfillment-badge{display:inline-flex;align-items:center;border-radius:999px;padding:7px 12px;background:#dbeafe;color:#1d4ed8;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.04em}.fh-fulfillment-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.fh-info-box{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px}.fh-info-box.full{grid-column:1 / -1}.fh-info-box small{display:block;color:#64748b;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.fh-info-box b,.fh-info-box span{display:block;color:#0f172a;font-size:15px;font-weight:750;white-space:pre-wrap;word-break:break-word}.fh-map-frame{width:100%;height:260px;border:0;border-radius:18px;box-shadow:inset 0 0 0 1px #e2e8f0;background:#e2e8f0}.fh-map-link{display:inline-flex;margin-top:10px;text-decoration:none;background:#0f172a;color:#fff;border-radius:999px;padding:10px 14px;font-weight:800;font-size:13px}.fh-product-list{margin:14px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}.fh-product-list li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px dashed #e2e8f0;color:#334155;font-size:14px}.fh-product-list li:last-child{border-bottom:0}.fh-total-line{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:18px;font-weight:900}@media(max-width:640px){.fh-fulfillment-overlay{padding:10px;align-items:flex-end}.fh-fulfillment-modal{border-radius:24px 24px 0 0;max-height:92vh;padding:18px}.fh-fulfillment-grid{grid-template-columns:1fr}.fh-info-box.full{grid-column:auto}.fh-map-frame{height:220px}}
        `}</style>
        <div className="fh-fulfillment-head">
          <div>
            <span className="fh-fulfillment-badge">{label}</span>
            <h2>Thông tin nhận / giao hàng</h2>
            <p>Đơn #{order.orderCode || order._id || ''}</p>
          </div>
          <button className="fh-fulfillment-close" type="button" onClick={onClose}>×</button>
        </div>

        <div className="fh-fulfillment-grid">
          <div className="fh-info-box"><small>Người nhận</small><b>{customerName}</b></div>
          <div className="fh-info-box"><small>Số điện thoại</small><b>{phone || 'Chưa có'}</b></div>
          {isPickup && <div className="fh-info-box full"><small>Ngày giờ khách đến lấy</small><b>{fmt(pickupTime) || 'Chưa chọn giờ lấy'}</b></div>}
          {isDelivery && <div className="fh-info-box full"><small>Địa chỉ giao hàng</small><b>{address || 'Chưa có địa chỉ'}</b></div>}
          {!isDelivery && address && <div className="fh-info-box full"><small>Địa chỉ</small><b>{address}</b></div>}
          {deliveryTime && <div className="fh-info-box full"><small>Thời gian giao dự kiến</small><b>{fmt(deliveryTime)}</b></div>}
          {note && <div className="fh-info-box full"><small>Ghi chú của khách</small><span>{note}</span></div>}
          {latLng && <div className="fh-info-box"><small>Tọa độ</small><b>{latLng.lat}, {latLng.lng}</b></div>}
          <div className="fh-info-box"><small>Thanh toán</small><b>{order.paymentStatus || 'Chưa rõ'} · {order.paymentMethod || 'N/A'}</b></div>
        </div>

        {isDelivery && (embedUrl || address) && (
          <div className="fh-info-box full" style={{ marginTop: 12 }}>
            <small>Bản đồ giao hàng</small>
            {embedUrl ? <iframe className="fh-map-frame" src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <b>{address}</b>}
            {mapUrl && <a className="fh-map-link" href={mapUrl} target="_blank" rel="noreferrer">Mở vị trí trên Google Maps →</a>}
          </div>
        )}

        <div className="fh-info-box full" style={{ marginTop: 12 }}>
          <small>Sản phẩm</small>
          <ul className="fh-product-list">
            {(order.products || []).map((item, index) => (
              <li key={index}><span>{item.name} ×{item.quantity || 1}</span><b>{money((item.price || item.salePrice || 0) * (item.quantity || 1))}</b></li>
            ))}
          </ul>
          <div className="fh-total-line"><span>Tổng tiền</span><b>{money(order.totalAmount || order.total || order.amount)}</b></div>
        </div>
      </section>
    </div>
  );
}
