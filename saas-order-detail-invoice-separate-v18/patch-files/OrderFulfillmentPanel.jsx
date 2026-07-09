import React from 'react';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const text = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
const fmt = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
};

function getLatLng(order) {
  const loc = order?.deliveryLocation || order?.shippingLocation || order?.customerLocation || order?.location || order?.coordinates || {};
  const lat = text(loc.lat, loc.latitude, order?.lat, order?.latitude, order?.deliveryLat, order?.shippingLat);
  const lng = text(loc.lng, loc.lon, loc.longitude, order?.lng, order?.lon, order?.longitude, order?.deliveryLng, order?.shippingLng);
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  return { lat: nLat, lng: nLng };
}

function getAddress(order) {
  const loc = order?.deliveryLocation || order?.shippingLocation || order?.customerLocation || order?.location || {};
  return text(
    order?.deliveryAddress,
    order?.shippingAddress,
    order?.customerAddress,
    order?.address,
    order?.fullAddress,
    loc.address,
    loc.formattedAddress,
    loc.name
  );
}

function getPickupTime(order) {
  return text(order?.pickupAt, order?.pickupTime, order?.scheduledPickupAt, order?.scheduledAt, order?.takeawayTime, order?.receiveAt, order?.deliveryTime);
}

function getNote(order) {
  return text(order?.note, order?.customerNote, order?.checkoutNote, order?.deliveryNote, order?.shippingNote, order?.pickupNote, order?.staffNote);
}

export default function OrderFulfillmentPanel({ order, onClose }) {
  if (!order) return null;

  const orderType = String(order.orderType || order.type || '').toLowerCase();
  const isDelivery = ['delivery', 'shipping', 'ship', 'giao_hang', 'giao-hang'].includes(orderType);
  const isPickup = ['pickup', 'takeaway', 'take_away', 'self_pickup', 'den_lay', 'đến lấy'].includes(orderType);
  const address = getAddress(order);
  const latLng = getLatLng(order);
  const note = getNote(order);
  const pickupTime = getPickupTime(order);
  const mapQuery = latLng ? `${latLng.lat},${latLng.lng}` : address;
  const mapUrl = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}` : '';
  const embedUrl = latLng
    ? `https://maps.google.com/maps?q=${latLng.lat},${latLng.lng}&z=16&output=embed`
    : address
      ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`
      : '';

  const title = isDelivery ? 'Thông tin nhận / giao hàng' : isPickup ? 'Thông tin khách tự đến lấy' : 'Thông tin xử lý đơn';
  const pill = isDelivery ? 'GIAO HÀNG' : isPickup ? 'ĐẾN LẤY' : (orderType || 'ĐƠN HÀNG').toUpperCase();

  return (
    <div className="fh-fulfillment-overlay" onClick={onClose}>
      <style>{`
        .fh-fulfillment-overlay { position: fixed; inset: 0; z-index: 3500; background: rgba(15,23,42,.55); backdrop-filter: blur(5px); display:flex; align-items:center; justify-content:center; padding: 20px; }
        .fh-fulfillment-modal { width: min(760px, 96vw); max-height: 92vh; overflow:auto; background: linear-gradient(180deg,#f8fbff 0%,#fff 100%); border: 1px solid rgba(226,232,240,.95); border-radius: 24px; box-shadow: 0 30px 90px rgba(15,23,42,.35); color:#0f172a; }
        .fh-fulfillment-head { padding: 22px 24px 14px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; border-bottom:1px solid #e2e8f0; }
        .fh-fulfillment-title h2 { margin:0 0 6px; font-size:22px; font-weight:900; letter-spacing:-.02em; }
        .fh-fulfillment-title p { margin:0; color:#64748b; font-size:14px; }
        .fh-fulfillment-close { width:40px; height:40px; border-radius:14px; border:1px solid #e2e8f0; background:white; cursor:pointer; font-size:22px; line-height:1; color:#334155; }
        .fh-fulfillment-body { padding: 20px 24px 24px; }
        .fh-fulfillment-pill { display:inline-flex; align-items:center; padding:7px 12px; border-radius:999px; background:#dbeafe; color:#1d4ed8; font-size:12px; font-weight:900; margin-bottom:10px; }
        .fh-fulfillment-grid { display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap:12px; margin-bottom:16px; }
        .fh-fulfillment-box { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:14px; }
        .fh-fulfillment-box label { display:block; color:#64748b; font-size:12px; font-weight:800; text-transform:uppercase; margin-bottom:7px; }
        .fh-fulfillment-box strong, .fh-fulfillment-box span { color:#0f172a; font-size:15px; font-weight:800; word-break:break-word; }
        .fh-fulfillment-wide { grid-column:1/-1; }
        .fh-fulfillment-products { display:flex; flex-direction:column; gap:8px; margin-top:8px; }
        .fh-fulfillment-line { display:flex; justify-content:space-between; gap:14px; padding:10px 0; border-bottom:1px dashed #e2e8f0; font-size:14px; }
        .fh-map-wrap { overflow:hidden; border-radius:18px; border:1px solid #dbe3ef; background:#eef2f7; margin-top:10px; }
        .fh-map-wrap iframe { width:100%; height:280px; border:0; display:block; }
        .fh-map-actions { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; background:#fff; border-top:1px solid #e2e8f0; }
        .fh-map-actions a { color:#1d4ed8; font-weight:800; text-decoration:none; }
        @media (max-width: 640px) { .fh-fulfillment-overlay { align-items:flex-end; padding:0; } .fh-fulfillment-modal { width:100%; max-height:94vh; border-radius:24px 24px 0 0; } .fh-fulfillment-grid { grid-template-columns: 1fr; } .fh-map-wrap iframe { height:240px; } }
      `}</style>
      <div className="fh-fulfillment-modal" onClick={(event) => event.stopPropagation()}>
        <header className="fh-fulfillment-head">
          <div className="fh-fulfillment-title">
            <span className="fh-fulfillment-pill">{pill}</span>
            <h2>{title}</h2>
            <p>Đơn #{order.orderCode || order.code || order._id}</p>
          </div>
          <button className="fh-fulfillment-close" onClick={onClose} aria-label="Đóng">×</button>
        </header>

        <div className="fh-fulfillment-body">
          <div className="fh-fulfillment-grid">
            <div className="fh-fulfillment-box"><label>Người nhận</label><strong>{text(order.customerName, order.buyerName, order.receiverName, 'Khách lẻ')}</strong></div>
            <div className="fh-fulfillment-box"><label>Số điện thoại</label><strong>{text(order.phone, order.customerPhone, order.receiverPhone, order.loyaltyPhone, 'Chưa có')}</strong></div>
            <div className="fh-fulfillment-box"><label>Loại đơn</label><strong>{isDelivery ? 'Giao hàng' : isPickup ? 'Tự đến lấy' : text(order.orderType, 'Đơn hàng')}</strong></div>
            <div className="fh-fulfillment-box"><label>Tổng tiền</label><strong>{money(order.totalAmount || order.total || order.amount || order.grandTotal)}</strong></div>
            {isPickup && <div className="fh-fulfillment-box fh-fulfillment-wide"><label>Ngày giờ khách đến lấy</label><strong>{fmt(pickupTime) || 'Chưa có'}</strong></div>}
            {address && <div className="fh-fulfillment-box fh-fulfillment-wide"><label>Địa chỉ giao hàng</label><strong>{address}</strong></div>}
            {note && <div className="fh-fulfillment-box fh-fulfillment-wide"><label>Ghi chú khách hàng</label><span>{note}</span></div>}
          </div>

          {(isDelivery || address || latLng) && embedUrl && (
            <div className="fh-map-wrap">
              <iframe title="Bản đồ giao hàng" loading="lazy" src={embedUrl}></iframe>
              <div className="fh-map-actions">
                <span>{latLng ? `${latLng.lat}, ${latLng.lng}` : 'Vị trí theo địa chỉ khách nhập'}</span>
                <a href={mapUrl} target="_blank" rel="noreferrer">Mở trong Google Maps →</a>
              </div>
            </div>
          )}

          <div className="fh-fulfillment-box fh-fulfillment-wide" style={{ marginTop: 16 }}>
            <label>Sản phẩm</label>
            <div className="fh-fulfillment-products">
              {(order.products || order.items || []).map((item, index) => (
                <div className="fh-fulfillment-line" key={`${item._id || item.name || index}-${index}`}>
                  <span>{item.quantity || 1} × {item.name || item.productName || 'Sản phẩm'}</span>
                  <strong>{money(item.amount || item.total || Number(item.price || 0) * Number(item.quantity || 1))}</strong>
                </div>
              ))}
              {!(order.products || order.items || []).length && <span>Chưa có danh sách sản phẩm</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
