import React from 'react';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const pickFirst = (...values) => {
  for (const value of values) {
    if (value === 0) return value;
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const getNested = (obj, path) => path.split('.').reduce((acc, key) => acc?.[key], obj);

const findLatLng = (order = {}) => {
  const sources = [
    order.deliveryLocation,
    order.shippingLocation,
    order.customerLocation,
    order.location,
    order.geo,
    order.coords,
    order.coordinates,
    order.map,
    order.addressLocation,
    order.shippingAddress,
    order.deliveryAddress,
    order.customerAddress,
    order.address
  ].filter(Boolean);

  const directLat = pickFirst(order.lat, order.latitude, order.deliveryLat, order.shippingLat, order.customerLat, getNested(order, 'location.lat'), getNested(order, 'location.latitude'));
  const directLng = pickFirst(order.lng, order.long, order.longitude, order.deliveryLng, order.shippingLng, order.customerLng, getNested(order, 'location.lng'), getNested(order, 'location.longitude'));
  if (directLat && directLng) return { lat: Number(directLat), lng: Number(directLng) };

  for (const source of sources) {
    if (Array.isArray(source) && source.length >= 2) return { lng: Number(source[0]), lat: Number(source[1]) };
    const lat = pickFirst(source.lat, source.latitude, source.y, source._lat);
    const lng = pickFirst(source.lng, source.long, source.longitude, source.x, source._lng);
    if (lat && lng) return { lat: Number(lat), lng: Number(lng) };
    if (source.coordinates && Array.isArray(source.coordinates) && source.coordinates.length >= 2) {
      return { lng: Number(source.coordinates[0]), lat: Number(source.coordinates[1]) };
    }
  }

  return null;
};

const getAddressText = (order = {}) => {
  const candidates = [
    order.fullAddress,
    order.addressText,
    order.deliveryAddressText,
    order.shippingAddressText,
    order.customerAddressText,
    order.address,
    order.deliveryAddress,
    order.shippingAddress,
    order.customerAddress,
    order.receiverAddress,
    order.location?.address,
    order.deliveryLocation?.address,
    order.shippingLocation?.address,
    order.customerLocation?.address,
    order.address?.fullAddress,
    order.address?.detail,
    order.address?.formatted,
    order.deliveryAddress?.fullAddress,
    order.deliveryAddress?.detail,
    order.deliveryAddress?.formatted,
    order.shippingAddress?.fullAddress,
    order.shippingAddress?.detail,
    order.shippingAddress?.formatted
  ];

  for (const item of candidates) {
    if (!item) continue;
    if (typeof item === 'string') return item;
    if (typeof item === 'object') {
      const text = pickFirst(item.fullAddress, item.formatted, item.address, item.detail, item.street, item.description, item.name);
      if (text) return String(text);
      const parts = [item.houseNumber, item.street, item.ward, item.district, item.city, item.province].filter(Boolean);
      if (parts.length) return parts.join(', ');
    }
  }

  return '';
};

const getPickupTime = (order = {}) => pickFirst(
  order.pickupAt,
  order.pickupTime,
  order.pickupDateTime,
  order.pickupDate,
  order.scheduledPickupAt,
  order.expectedPickupAt,
  order.receiveAt,
  order.customerPickupAt,
  order.takeawayTime,
  order.fulfillment?.pickupAt,
  order.fulfillment?.time,
  order.schedule?.pickupAt,
  order.schedule?.time
);

const getNote = (order = {}) => pickFirst(
  order.note,
  order.customerNote,
  order.checkoutNote,
  order.orderNote,
  order.deliveryNote,
  order.pickupNote,
  order.shippingNote,
  order.specialRequest,
  order.specialRequests,
  order.message,
  order.fulfillment?.note,
  order.customer?.note
);

const getPhone = (order = {}) => pickFirst(
  order.phone,
  order.customerPhone,
  order.receiverPhone,
  order.shippingPhone,
  order.deliveryPhone,
  order.customer?.phone,
  order.receiver?.phone
);

const getCustomerName = (order = {}) => pickFirst(
  order.buyerCompanyName,
  order.buyerName,
  order.customerName,
  order.receiverName,
  order.customer?.name,
  order.receiver?.name,
  'Khách lẻ'
);

const getMode = (order = {}) => {
  const raw = String(pickFirst(order.orderType, order.fulfillmentType, order.deliveryMethod, order.shippingMethod, order.method, order.serviceMode, order.fulfillment?.type)).toLowerCase();
  if (raw.includes('pickup') || raw.includes('takeaway') || raw.includes('take_away') || raw.includes('self') || raw.includes('den_lay') || raw.includes('đến lấy') || raw.includes('nhan_tai_shop')) return 'pickup';
  if (raw.includes('delivery') || raw.includes('shipping') || raw.includes('ship') || raw.includes('giao')) return 'delivery';
  if (order.tableNumber || raw.includes('dine')) return 'dine_in';
  return raw || 'unknown';
};

const modeLabel = {
  pickup: 'Khách tự đến lấy',
  delivery: 'Giao hàng / ship',
  dine_in: 'Ăn tại bàn',
  unknown: 'Thông tin nhận hàng'
};

export default function OrderFulfillmentPanel({ order }) {
  if (!order) return null;

  const mode = getMode(order);
  const address = getAddressText(order);
  const location = findLatLng(order);
  const note = getNote(order);
  const pickupTime = getPickupTime(order);
  const phone = getPhone(order);
  const customerName = getCustomerName(order);
  const mapQuery = location ? `${location.lat},${location.lng}` : address;
  const hasMap = mode === 'delivery' && Boolean(mapQuery);
  const mapUrl = hasMap ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}` : '';
  const mapEmbed = hasMap ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&output=embed` : '';

  return (
    <aside className="fh-invoice-fulfillment-panel" aria-label="Thông tin nhận giao hàng">
      <style>{`
        .fh-invoice-fulfillment-panel {
          position: fixed;
          right: 18px;
          top: 18px;
          width: min(430px, calc(100vw - 36px));
          max-height: calc(100vh - 36px);
          overflow: auto;
          z-index: 2147483000;
          background: #ffffff;
          color: #0f172a;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .fh-invoice-fulfillment-head {
          padding: 18px 20px;
          background: linear-gradient(135deg, #0f172a, #1e293b 60%, #92400e);
          color: white;
        }
        .fh-invoice-fulfillment-head small { color: rgba(255,255,255,.7); display:block; margin-bottom: 6px; }
        .fh-invoice-fulfillment-head h3 { margin:0; font-size: 18px; line-height: 1.25; }
        .fh-invoice-fulfillment-body { padding: 18px 20px 20px; display: grid; gap: 12px; }
        .fh-fulfill-row { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 14px; padding: 12px 14px; }
        .fh-fulfill-row span { display:block; color:#64748b; font-size:12px; font-weight:700; text-transform: uppercase; letter-spacing:.04em; margin-bottom: 5px; }
        .fh-fulfill-row b, .fh-fulfill-row p { margin:0; color:#0f172a; font-size:14px; line-height:1.45; overflow-wrap:anywhere; }
        .fh-fulfill-note { background:#fffbeb; border-color:#fde68a; }
        .fh-fulfill-map { border-radius: 16px; overflow:hidden; border:1px solid #e2e8f0; background:#f1f5f9; }
        .fh-fulfill-map iframe { width:100%; height:190px; border:0; display:block; }
        .fh-fulfill-map a { display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; text-decoration:none; color:#0f172a; font-weight:800; background:#fff; border-top:1px solid #e2e8f0; }
        .fh-fulfill-money { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
        @media (max-width: 768px) {
          .fh-invoice-fulfillment-panel {
            left: 10px;
            right: 10px;
            top: auto;
            bottom: 10px;
            width: auto;
            max-height: 56vh;
            border-radius: 18px;
          }
          .fh-fulfill-map iframe { height: 160px; }
        }
        @media print {
          .fh-invoice-fulfillment-panel { display: none !important; }
        }
      `}</style>

      <div className="fh-invoice-fulfillment-head">
        <small>Chi tiết nhận / giao hàng</small>
        <h3>{modeLabel[mode] || 'Thông tin đơn hàng'} · #{order.orderCode || order._id || ''}</h3>
      </div>

      <div className="fh-invoice-fulfillment-body">
        <div className="fh-fulfill-row">
          <span>Khách hàng</span>
          <b>{customerName}</b>
          {phone && <p>{phone}</p>}
        </div>

        {mode === 'pickup' && (
          <div className="fh-fulfill-row">
            <span>Ngày giờ khách đến lấy</span>
            <b>{pickupTime ? formatDateTime(pickupTime) : 'Chưa có thông tin thời gian lấy hàng'}</b>
          </div>
        )}

        {mode === 'delivery' && (
          <div className="fh-fulfill-row">
            <span>Địa chỉ giao hàng</span>
            <b>{address || 'Chưa có địa chỉ giao hàng trong đơn'}</b>
            {location && <p>Tọa độ: {location.lat}, {location.lng}</p>}
          </div>
        )}

        {note && (
          <div className="fh-fulfill-row fh-fulfill-note">
            <span>Ghi chú khách nhập</span>
            <p>{note}</p>
          </div>
        )}

        <div className="fh-fulfill-money">
          <div className="fh-fulfill-row">
            <span>Loại đơn</span>
            <b>{modeLabel[mode] || mode}</b>
          </div>
          <div className="fh-fulfill-row">
            <span>Tổng tiền</span>
            <b>{money(order.totalAmount || order.total || order.grandTotal)}</b>
          </div>
        </div>

        {hasMap && (
          <div className="fh-fulfill-map">
            <iframe title="Bản đồ giao hàng" src={mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            <a href={mapUrl} target="_blank" rel="noreferrer">Mở Google Maps</a>
          </div>
        )}
      </div>
    </aside>
  );
}
