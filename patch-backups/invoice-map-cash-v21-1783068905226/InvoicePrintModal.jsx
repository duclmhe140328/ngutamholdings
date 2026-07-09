import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;
const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', {
  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
}) : '—';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

const readThree = (value, full = false) => {
  const hundred = Math.floor(value / 100);
  const ten = Math.floor((value % 100) / 10);
  const one = value % 10;
  const parts = [];
  if (hundred || full) {
    parts.push(`${digits[hundred]} trăm`);
    if (!ten && one) parts.push('lẻ');
  }
  if (ten > 1) parts.push(`${digits[ten]} mươi`);
  else if (ten === 1) parts.push('mười');
  if (one) {
    if (ten > 1 && one === 1) parts.push('mốt');
    else if (ten > 0 && one === 5) parts.push('lăm');
    else if (ten > 1 && one === 4) parts.push('tư');
    else parts.push(digits[one]);
  }
  return parts.join(' ');
};

const numberToVietnamese = (input) => {
  const value = Math.max(0, Math.round(Number(input || 0)));
  if (value === 0) return 'Không đồng';
  const groups = [];
  let remaining = value;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  const words = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    if (!groups[index]) continue;
    const full = index < groups.length - 1 && groups[index] < 100;
    words.push(readThree(groups[index], full));
    if (units[index]) words.push(units[index]);
  }
  const sentence = words.join(' ').replace(/\s+/g, ' ').trim();
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} đồng`;
};

const initialForm = (order, shop) => ({
  invoiceStatus: order.invoiceStatus === 'external_issued' ? 'external_issued' : 'draft',
  buyerName: order.buyerName || order.customerName || '',
  buyerCompanyName: order.buyerCompanyName || '',
  buyerTaxCode: order.buyerTaxCode || '',
  buyerAddress: order.buyerAddress || order.address || order.deliveryAddress || order.shippingAddress || '',
  buyerEmail: order.buyerEmail || '',
  vatRate: order.vatRate || shop.defaultVatRate || '0',
  invoiceNumber: order.invoiceNumber || '',
  invoiceSymbol: order.invoiceSymbol || '',
  invoiceTemplateCode: order.invoiceTemplateCode || '',
  invoiceProviderName: order.invoiceProviderName || shop.invoiceProviderName || '',
  invoiceIssuedAt: order.invoiceIssuedAt ? new Date(order.invoiceIssuedAt).toISOString().slice(0, 16) : '',
  invoiceLookupUrl: order.invoiceLookupUrl || shop.invoiceLookupUrl || '',
  invoiceLookupCode: order.invoiceLookupCode || '',
  invoiceNote: order.invoiceNote || ''
});

const pickText = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'object') continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
};

const addressFromObject = (value) => {
  if (!value || typeof value !== 'object') return '';
  return pickText(
    value.address,
    value.formattedAddress,
    value.fullAddress,
    value.displayName,
    value.name,
    [value.street, value.ward, value.district, value.city, value.province].filter(Boolean).join(', ')
  );
};

const readLatLng = (value) => {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      const maybeLngLat = Math.abs(first) > 90 && Math.abs(second) <= 90;
      return maybeLngLat ? { lat: second, lng: first } : { lat: first, lng: second };
    }
  }
  if (typeof value !== 'object') return null;
  if (Array.isArray(value.coordinates)) return readLatLng(value.coordinates);
  const lat = Number(value.lat ?? value.latitude ?? value.Latitude ?? value.mapLat ?? value.deliveryLat);
  const lng = Number(value.lng ?? value.lon ?? value.long ?? value.longitude ?? value.Longitude ?? value.mapLng ?? value.deliveryLng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
};

const getPinnedLocation = (order = {}) => {
  const nestedKeys = [
    'deliveryLocation', 'shippingLocation', 'customerLocation', 'receiverLocation',
    'pinnedLocation', 'pinLocation', 'mapLocation', 'location', 'geo', 'coords',
    'coordinate', 'coordinates', 'delivery', 'shipping', 'fulfillment', 'receiver', 'customer'
  ];
  const direct = readLatLng(order);
  if (direct) return direct;
  for (const key of nestedKeys) {
    const found = readLatLng(order[key]);
    if (found) return found;
  }
  return null;
};

const getFulfillmentInfo = (order = {}) => {
  const pinned = getPinnedLocation(order);
  const rawType = pickText(order.orderType, order.fulfillmentType, order.deliveryType, order.shippingType).toLowerCase();
  const nestedAddress = addressFromObject(order.deliveryLocation)
    || addressFromObject(order.shippingLocation)
    || addressFromObject(order.customerLocation)
    || addressFromObject(order.receiverLocation)
    || addressFromObject(order.location)
    || addressFromObject(order.shipping)
    || addressFromObject(order.delivery)
    || addressFromObject(order.fulfillment);
  const address = pickText(
    order.deliveryAddress,
    order.shippingAddress,
    order.customerAddress,
    order.receiverAddress,
    order.address,
    order.fullAddress,
    order.shipping?.address,
    order.delivery?.address,
    order.fulfillment?.address,
    nestedAddress
  );
  const note = pickText(
    order.customerNote,
    order.checkoutNote,
    order.deliveryNote,
    order.shippingNote,
    order.pickupNote,
    order.fulfillmentNote,
    order.note,
    order.invoiceNote
  );
  const scheduledAt = pickText(
    order.pickupAt,
    order.pickupTime,
    order.pickupDateTime,
    order.scheduledPickupAt,
    order.receiveAt,
    order.receiveTime,
    order.deliveryAt,
    order.deliveryTime,
    order.scheduledDeliveryAt,
    order.scheduledAt,
    order.fulfillmentAt
  );
  const isPickup = ['pickup', 'takeaway', 'take_away', 'self_pickup', 'self-pickup', 'den_lay', 'đến lấy', 'tu_den_lay', 'nhan_tai_shop'].some((key) => rawType.includes(key));
  const isDelivery = ['delivery', 'shipping', 'ship', 'giao', 'giao_hang'].some((key) => rawType.includes(key)) || Boolean(address || pinned);
  const typeLabel = order.tableNumber
    ? `Tại bàn ${order.tableNumber}`
    : isPickup
      ? 'Tự đến lấy'
      : isDelivery
        ? 'Giao hàng'
        : (rawType ? rawType : 'Đơn hàng');
  const customerName = pickText(order.receiverName, order.customerName, order.buyerName, order.name, order.shipping?.name, order.delivery?.name) || 'Khách hàng';
  const phone = pickText(order.receiverPhone, order.customerPhone, order.phone, order.loyaltyPhone, order.shipping?.phone, order.delivery?.phone);
  const mapQuery = pinned ? `${pinned.lat},${pinned.lng}` : address;
  const googleMapsUrl = mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : '';
  const embedUrl = pinned ? `https://maps.google.com/maps?q=${encodeURIComponent(`${pinned.lat},${pinned.lng}`)}&z=17&output=embed` : '';
  return {
    hasAny: Boolean(order.tableNumber || rawType || address || pinned || note || scheduledAt || phone),
    rawType,
    typeLabel,
    isPickup,
    isDelivery,
    customerName,
    phone,
    address,
    note,
    scheduledAt,
    pinned,
    googleMapsUrl,
    embedUrl
  };
};

const FulfillmentPanel = ({ order }) => {
  const info = getFulfillmentInfo(order);
  if (!info.hasAny) return null;
  return (
    <div style={{ margin: '0 0 20px', padding: 18, border: '1px solid #dbeafe', borderRadius: 18, background: 'linear-gradient(135deg,#eff6ff,#f8fbff)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <div>
          <b style={{ display: 'block', color: '#0f172a', fontSize: 16 }}>Thông tin nhận / giao hàng</b>
          <small style={{ color: '#64748b' }}>Dữ liệu từ checkout của khách</small>
        </div>
        <span style={{ padding: '7px 12px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>{info.typeLabel}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <div style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff' }}><small style={{ color: '#64748b', fontWeight: 800 }}>NGƯỜI NHẬN</small><p style={{ margin: '6px 0 0', fontWeight: 800 }}>{info.customerName}</p></div>
        <div style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff' }}><small style={{ color: '#64748b', fontWeight: 800 }}>SỐ ĐIỆN THOẠI</small><p style={{ margin: '6px 0 0', fontWeight: 800 }}>{info.phone || '—'}</p></div>
      </div>
      {info.address && <div style={{ marginTop: 12 }}><small style={{ color: '#64748b', fontWeight: 800 }}>{info.isPickup ? 'ĐỊA CHỈ / GHI CHÚ NHẬN' : 'ĐỊA CHỈ GIAO HÀNG'}</small><p style={{ margin: '6px 0 0', color: '#0f172a', fontWeight: 700 }}>{info.address}</p></div>}
      {info.scheduledAt && <div style={{ marginTop: 12 }}><small style={{ color: '#64748b', fontWeight: 800 }}>{info.isPickup ? 'THỜI GIAN KHÁCH ĐẾN LẤY' : 'THỜI GIAN HẸN GIAO/NHẬN'}</small><p style={{ margin: '6px 0 0', color: '#0f172a', fontWeight: 700 }}>{dateTime(info.scheduledAt)}</p></div>}
      {info.note && <div style={{ marginTop: 12 }}><small style={{ color: '#64748b', fontWeight: 800 }}>GHI CHÚ CỦA KHÁCH</small><p style={{ margin: '6px 0 0', color: '#0f172a', whiteSpace: 'pre-wrap' }}>{info.note}</p></div>}
      {info.pinned && (
        <div style={{ marginTop: 14 }}>
          <small style={{ color: '#64748b', fontWeight: 800 }}>MAP KHÁCH ĐÃ GHIM</small>
          <iframe title="Vị trí khách ghim" src={info.embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ width: '100%', height: 220, border: 0, borderRadius: 16, marginTop: 8 }} />
          <a href={info.googleMapsUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', marginTop: 10, color: '#2563eb', fontWeight: 800, textDecoration: 'none' }}>Mở vị trí khách ghim trên Google Maps →</a>
        </div>
      )}
    </div>
  );
};

const MiniFulfillment = ({ order }) => {
  const info = getFulfillmentInfo(order);
  if (!info.hasAny) return null;
  return (
    <div style={{ margin: '14px 0', padding: 12, borderRadius: 14, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)' }}>
      <b style={{ display: 'block', marginBottom: 6 }}>Nhận / giao hàng</b>
      <p style={{ margin: 0, color: '#d7c6b3', fontSize: 13 }}>{info.typeLabel} · {info.phone || 'Không SĐT'}</p>
      {info.address && <p style={{ margin: '4px 0 0', color: '#d7c6b3', fontSize: 13 }}>{info.address}</p>}
      {info.pinned && <a href={info.googleMapsUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, color: '#f6cf8b', fontWeight: 800, fontSize: 13 }}>Mở map khách ghim</a>}
    </div>
  );
};

const InvoicePrintModal = ({ order, shop, onClose, onSave }) => {
  const [form, setForm] = useState(() => initialForm(order, shop));
  const [saving, setSaving] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => setForm(initialForm(order, shop)), [order?._id, shop?._id]);

  const totals = useMemo(() => {
    const rate = form.vatRate === 'KCT' ? 0 : Number(form.vatRate || 0);
    const invoiceTotal = Number(order.totalAmount || 0);
    const beforeVat = rate > 0 ? Math.round(invoiceTotal / (1 + rate / 100)) : invoiceTotal;
    return { rate, beforeVat, vat: Math.max(0, invoiceTotal - beforeVat), total: invoiceTotal };
  }, [order.totalAmount, form.vatRate]);

  useEffect(() => {
    const source = form.invoiceLookupUrl || form.invoiceLookupCode;
    if (!source) { setQrDataUrl(''); return; }
    QRCode.toDataURL(source, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [form.invoiceLookupUrl, form.invoiceLookupCode]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  const buildPrintHtml = (paper = 'a4') => {
    const isThermal = paper === 'thermal';
    const external = form.invoiceStatus === 'external_issued';
    const title = external
      ? 'BẢN THỂ HIỆN HÓA ĐƠN ĐIỆN TỬ'
      : (isThermal ? 'PHIẾU THANH TOÁN' : 'PHIẾU BÁN HÀNG / THAM KHẢO THUẾ GTGT');
    const sellerName = shop.legalName || shop.name;
    const sellerAddress = shop.invoiceAddress || shop.address || '';
    const sellerPhone = shop.invoicePhone || shop.phone || '';
    const fulfillment = getFulfillmentInfo(order);
    const rows = (order.products || []).map((item, index) => {
      const amount = Number(item.price || 0) * Number(item.quantity || 0);
      return `<tr>
        <td>${index + 1}</td>
        <td class="item-name">${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.unit || (shop.businessType === 'restaurant' ? 'Phần' : 'Sản phẩm'))}</td>
        <td class="num">${Number(item.quantity || 0).toLocaleString('vi-VN')}</td>
        <td class="num">${Number(item.price || 0).toLocaleString('vi-VN')}</td>
        <td class="num">${amount.toLocaleString('vi-VN')}</td>
      </tr>`;
    }).join('');
    const customerNames = (order.customerNames || []).length
      ? order.customerNames.join(' · ')
      : (form.buyerName || order.customerName || 'Khách lẻ');
    const paymentHistory = (order.paymentHistory || []).map((payment, index) =>
      `<p><b>Lần ${index + 1}:</b> ${Number(payment.amount || 0).toLocaleString('vi-VN')}đ · ${escapeHtml(payment.method || 'cash')} · ${dateTime(payment.paidAt)}</p>`
    ).join('');
    const roundHistory = (order.orders || []).map((round) =>
      `<p><b>Lượt ${Number(round.orderRound || 1)} · ${escapeHtml(round.customerName || 'Khách tại bàn')}</b> · ${dateTime(round.createdAt)}<br/><span>${escapeHtml((round.products || []).map((item) => `${item.name} ×${item.quantity}`).join(', '))}</span></p>`
    ).join('');
    const fulfillmentHtml = fulfillment.hasAny ? `<section class="box fulfillment-box"><h3>Thông tin nhận / giao hàng</h3><p><b>Loại đơn:</b> ${escapeHtml(fulfillment.typeLabel)}</p><p><b>Người nhận:</b> ${escapeHtml(fulfillment.customerName)}${fulfillment.phone ? ` · ${escapeHtml(fulfillment.phone)}` : ''}</p>${fulfillment.address ? `<p><b>Địa chỉ:</b> ${escapeHtml(fulfillment.address)}</p>` : ''}${fulfillment.scheduledAt ? `<p><b>${fulfillment.isPickup ? 'Thời gian khách đến lấy' : 'Thời gian hẹn giao/nhận'}:</b> ${escapeHtml(dateTime(fulfillment.scheduledAt))}</p>` : ''}${fulfillment.note ? `<p><b>Ghi chú khách:</b> ${escapeHtml(fulfillment.note)}</p>` : ''}${fulfillment.pinned ? `<p><b>Map khách ghim:</b> ${escapeHtml(fulfillment.pinned.lat)}, ${escapeHtml(fulfillment.pinned.lng)}</p><p><b>Google Maps:</b> ${escapeHtml(fulfillment.googleMapsUrl)}</p>${!isThermal ? `<iframe class="fulfillment-map" src="${escapeHtml(fulfillment.embedUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ''}` : ''}</section>` : '';

    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(title)} #${escapeHtml(order.orderCode)}</title>
    <style>
      *{box-sizing:border-box}body{margin:0;background:#ece8e1;color:#15120e;font:14px/1.45 Arial,sans-serif}.sheet{width:${isThermal ? '80mm' : '210mm'};min-height:${isThermal ? 'auto' : '297mm'};margin:16px auto;background:#fff;padding:${isThermal ? '6mm 4mm' : '14mm 15mm'};box-shadow:0 12px 38px rgba(0,0,0,.14)}
      .header{display:grid;grid-template-columns:${isThermal ? '1fr' : '1.2fr .8fr'};gap:16px;padding-bottom:14px;border-bottom:2px solid #1d1710}.brand{display:flex;gap:12px;align-items:flex-start}.logo{width:64px;height:64px;object-fit:cover;border-radius:14px;border:1px solid #ddd}.brand h2{margin:0 0 5px;font:700 20px Georgia,serif}.brand p,.meta p{margin:2px 0;font-size:12px}.invoice-title{text-align:${isThermal ? 'left' : 'right'}}.invoice-title h1{margin:0;font:700 ${isThermal ? '20px' : '25px'} Georgia,serif}.invoice-title b{display:block;margin-top:6px;color:#9b6a27}.badge{display:inline-block;padding:5px 8px;border-radius:999px;background:#f4ead7;font-size:10px;font-weight:700;margin-top:6px}
      .info-grid{display:grid;grid-template-columns:${isThermal ? '1fr' : '1fr 1fr'};gap:10px;margin:14px 0}.box{border:1px solid #d9d1c6;border-radius:12px;padding:10px;margin-top:10px}.box h3{margin:0 0 7px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8b612a}.box p{margin:3px 0}.muted{color:#665f57;font-size:12px}.fulfillment-box{background:#f8fbff;border-color:#bdd7ff}.fulfillment-map{width:100%;height:210px;border:0;border-radius:10px;margin-top:8px}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:${isThermal ? '10px' : '12px'}}th,td{border:1px solid #cfc6ba;padding:${isThermal ? '5px 3px' : '8px 6px'};vertical-align:top}th{background:#f4eee5;text-transform:uppercase;font-size:${isThermal ? '8px' : '10px'}}.num{text-align:right;white-space:nowrap}.item-name{font-weight:700}.totals{margin-left:auto;width:${isThermal ? '100%' : '52%'};margin-top:12px}.total-row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed #d6cec2}.total-row.grand{font-size:17px;font-weight:800;border-bottom:2px solid #1c1710}.words{margin:13px 0;padding:10px;border-radius:10px;background:#f8f3ec;font-style:italic}.signatures{display:${isThermal ? 'none' : 'grid'};grid-template-columns:1fr 1fr;gap:20px;text-align:center;margin-top:26px}.signatures div{min-height:90px}.signatures b{display:block}.footer{margin-top:18px;padding-top:10px;border-top:1px solid #d7d0c7;text-align:center;font-size:10px;color:#625b52}.warning{padding:9px;border-radius:9px;background:#fff4df;border:1px solid #e6c986;color:#6e4d1e;margin-top:10px;font-size:10px}.qr{width:82px;height:82px;object-fit:contain;float:right;margin-left:10px}.lookup{overflow-wrap:anywhere}
      @media print{body{background:#fff}.sheet{margin:0;box-shadow:none;width:100%;min-height:auto}@page{size:${isThermal ? '80mm auto' : 'A4'};margin:${isThermal ? '0' : '8mm'}}.no-print{display:none!important}}
      @media(max-width:700px){.sheet{width:100%;margin:0;min-height:100vh;padding:18px}.header,.info-grid{grid-template-columns:1fr}.invoice-title{text-align:left}.logo{width:52px;height:52px}.totals{width:100%}}
    </style></head><body><main class="sheet">
      <section class="header">
        <div class="brand">${shop.logoUrl ? `<img class="logo" src="${escapeHtml(shop.logoUrl)}" alt=""/>` : ''}<div><h2>${escapeHtml(sellerName)}</h2><p><b>Mã số thuế:</b> ${escapeHtml(shop.taxCode || 'Chưa cập nhật')}</p><p>${escapeHtml(sellerAddress)}</p><p>${escapeHtml([sellerPhone, shop.invoiceEmail].filter(Boolean).join(' · '))}</p></div></div>
        <div class="invoice-title"><h1>${escapeHtml(title)}</h1><b>#${escapeHtml(order.orderCode)}</b><span class="badge">${external ? 'Dữ liệu HĐĐT do shop khai báo' : 'Bản in nội bộ'}</span><p class="muted">Ngày lập: ${dateTime(form.invoiceIssuedAt || order.paidAt || new Date())}</p></div>
      </section>
      <section class="info-grid">
        <div class="box"><h3>Thông tin người mua</h3><p><b>Người gọi món:</b> ${escapeHtml(customerNames)}</p><p><b>SĐT tích xu:</b> ${escapeHtml(order.loyaltyPhone || order.phone || 'Không sử dụng')}</p><p><b>Đơn vị:</b> ${escapeHtml(form.buyerCompanyName || '—')}</p><p><b>MST:</b> ${escapeHtml(form.buyerTaxCode || '—')}</p><p><b>Địa chỉ:</b> ${escapeHtml(form.buyerAddress || order.address || fulfillment.address || '—')}</p><p><b>Email:</b> ${escapeHtml(form.buyerEmail || '—')}</p></div>
        <div class="box"><h3>Thông tin giao dịch</h3><p><b>Loại đơn:</b> ${escapeHtml(order.tableNumber ? `Tại bàn ${order.tableNumber}` : fulfillment.typeLabel || order.orderType)}</p><p><b>Phương thức:</b> ${escapeHtml(order.paymentMethod === 'multiple' ? 'Nhiều phương thức' : order.paymentMethod)}</p><p><b>Thanh toán:</b> ${escapeHtml(order.paymentStatus === 'paid' ? `Đã thanh toán lúc ${dateTime(order.paidAt)}` : 'Chưa thanh toán')}</p>${paymentHistory ? `<div class="payment-history"><b>Lịch sử thanh toán</b>${paymentHistory}</div>` : ''}<p><b>Ghi chú:</b> ${escapeHtml(order.note || form.invoiceNote || fulfillment.note || '—')}</p></div>
      </section>
      ${fulfillmentHtml}
      ${roundHistory ? `<section class="box"><h3>Chi tiết các lượt gọi món</h3>${roundHistory}</section>` : ''}
      <table><thead><tr><th>STT</th><th>Tên hàng hóa/dịch vụ</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${rows}</tbody></table>
      <section class="totals"><div class="total-row"><span>Cộng tiền hàng trước thuế</span><b>${money(totals.beforeVat)}</b></div><div class="total-row"><span>Thuế suất GTGT</span><b>${form.vatRate === 'KCT' ? 'Không chịu thuế' : `${escapeHtml(form.vatRate)}%`}</b></div><div class="total-row"><span>Tiền thuế GTGT</span><b>${money(totals.vat)}</b></div>${Number(order.deliveryFee || 0) ? `<div class="total-row"><span>Phí giao hàng đã gồm trong tổng</span><b>${money(order.deliveryFee)}</b></div>` : ''}<div class="total-row grand"><span>Tổng tiền thanh toán</span><b>${money(totals.total)}</b></div></section>
      <div class="words"><b>Số tiền bằng chữ:</b> ${escapeHtml(numberToVietnamese(totals.total))}</div>
      ${external ? `<section class="box lookup">${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR tra cứu"/>` : ''}<h3>Thông tin hóa đơn điện tử đã phát hành bên ngoài</h3><p><b>Mẫu số:</b> ${escapeHtml(form.invoiceTemplateCode || '—')} · <b>Ký hiệu:</b> ${escapeHtml(form.invoiceSymbol || '—')} · <b>Số:</b> ${escapeHtml(form.invoiceNumber || '—')}</p><p><b>Nhà cung cấp:</b> ${escapeHtml(form.invoiceProviderName || '—')}</p><p><b>Mã tra cứu:</b> ${escapeHtml(form.invoiceLookupCode || '—')}</p><p><b>Đường dẫn:</b> ${escapeHtml(form.invoiceLookupUrl || '—')}</p></section>` : ''}
      <section class="signatures"><div><b>Người mua hàng</b><span class="muted">(Ký, ghi rõ họ tên)</span></div><div><b>Người bán hàng</b><span class="muted">(Ký, ghi rõ họ tên)</span></div></section>
      <div class="warning">${external ? 'Bản thể hiện này được tạo từ dữ liệu do người bán nhập sau khi phát hành hóa đơn điện tử tại nhà cung cấp bên ngoài. Hãy kiểm tra mã/số hóa đơn trên hệ thống tra cứu chính thức.' : 'Đây là phiếu bán hàng/phiếu tính tiền có tách thuế GTGT để in nội bộ, không tự thay thế hóa đơn điện tử hợp pháp và không có mã của cơ quan thuế.'}</div>
      <footer class="footer">Cảm ơn quý khách. FoodHub Atelier hỗ trợ trình bày và in dữ liệu bán hàng; người bán chịu trách nhiệm về thông tin thuế và việc phát hành hóa đơn điện tử.</footer>
    </main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));</script></body></html>`;
  };

  const print = (paper) => {
    const popup = window.open('', '_blank', 'width=980,height=900');
    if (!popup) return window.alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup rồi thử lại.');
    try { popup.opener = null; } catch { /* no-op */ }
    popup.document.open();
    popup.document.write(buildPrintHtml(paper));
    popup.document.close();
  };

  return (
    <div className="invoice-modal-backdrop" role="dialog" aria-modal="true">
      <section className="invoice-modal">
        <header className="invoice-modal-head">
          <div><span className="eyebrow">Invoice workspace</span><h2>In hóa đơn · #{order.orderCode}</h2><p>Hoàn thiện thông tin người mua, thuế GTGT và dữ liệu hóa đơn điện tử nếu đã phát hành bên ngoài.</p></div>
          <button type="button" onClick={onClose} aria-label="Đóng">×</button>
        </header>

        <div className="invoice-modal-body">
          <aside className="invoice-form-panel">
            <div className="invoice-legal-note"><b>Lưu ý pháp lý</b><p>Mẫu này in phiếu bán hàng hoặc bản thể hiện tham khảo. Để phát hành hóa đơn điện tử hợp pháp, shop vẫn cần kết nối nhà cung cấp HĐĐT và hệ thống thuế.</p></div>
            <FulfillmentPanel order={order} />

            <div className="form-grid two">
              <div><label>Người mua hàng</label><input value={form.buyerName} onChange={(e) => update('buyerName', e.target.value)} /></div>
              <div><label>Tên công ty/đơn vị</label><input value={form.buyerCompanyName} onChange={(e) => update('buyerCompanyName', e.target.value)} /></div>
              <div><label>Mã số thuế người mua</label><input value={form.buyerTaxCode} onChange={(e) => update('buyerTaxCode', e.target.value)} /></div>
              <div><label>Email nhận hóa đơn</label><input type="email" value={form.buyerEmail} onChange={(e) => update('buyerEmail', e.target.value)} /></div>
            </div>
            <label>Địa chỉ người mua</label><input value={form.buyerAddress} onChange={(e) => update('buyerAddress', e.target.value)} />

            <div className="form-grid two">
              <div><label>Thuế suất GTGT</label><select value={form.vatRate} onChange={(e) => update('vatRate', e.target.value)}><option value="KCT">Không chịu thuế</option><option value="0">0%</option><option value="5">5%</option><option value="8">8%</option><option value="10">10%</option></select></div>
              <div><label>Trạng thái</label><select value={form.invoiceStatus} onChange={(e) => update('invoiceStatus', e.target.value)}><option value="draft">Phiếu in/nháp</option><option value="external_issued">Đã phát hành HĐĐT bên ngoài</option><option value="cancelled">Đã hủy</option></select></div>
            </div>

            {form.invoiceStatus === 'external_issued' && <div className="external-invoice-fields">
              <div className="form-grid three">
                <div><label>Mẫu số</label><input value={form.invoiceTemplateCode} onChange={(e) => update('invoiceTemplateCode', e.target.value)} /></div>
                <div><label>Ký hiệu</label><input value={form.invoiceSymbol} onChange={(e) => update('invoiceSymbol', e.target.value)} /></div>
                <div><label>Số hóa đơn *</label><input required value={form.invoiceNumber} onChange={(e) => update('invoiceNumber', e.target.value)} /></div>
              </div>
              <div className="form-grid two">
                <div><label>Ngày phát hành</label><input type="datetime-local" value={form.invoiceIssuedAt} onChange={(e) => update('invoiceIssuedAt', e.target.value)} /></div>
                <div><label>Nhà cung cấp HĐĐT</label><input value={form.invoiceProviderName} onChange={(e) => update('invoiceProviderName', e.target.value)} placeholder="MISA, VNPT, Viettel..." /></div>
                <div><label>Mã tra cứu</label><input value={form.invoiceLookupCode} onChange={(e) => update('invoiceLookupCode', e.target.value)} /></div>
                <div><label>Link tra cứu</label><input value={form.invoiceLookupUrl} onChange={(e) => update('invoiceLookupUrl', e.target.value)} /></div>
              </div>
            </div>}
            <label>Ghi chú hóa đơn</label><textarea value={form.invoiceNote} onChange={(e) => update('invoiceNote', e.target.value)} />
          </aside>

          <article className="invoice-preview-card">
            <div className="invoice-preview-brand"><div>{shop.logoUrl ? <img src={shop.logoUrl} alt="" /> : <span>FH</span>}<section><b>{shop.legalName || shop.name}</b><small>MST: {shop.taxCode || 'Chưa cập nhật'}</small></section></div><em>{form.invoiceStatus === 'external_issued' ? 'Bản thể hiện HĐĐT' : 'Phiếu bán hàng'}</em></div>
            <div className="invoice-preview-title"><span>#{order.orderCode}</span><h3>{form.buyerCompanyName || (order.customerNames?.length ? order.customerNames.join(' · ') : form.buyerName || order.customerName)}</h3><p>{order.products?.length || 0} dòng hàng · {order.isDiningSessionInvoice ? 'Hóa đơn tổng phiên bàn' : 'Đơn hàng'} · {dateTime(order.paidAt || order.createdAt)}</p></div>
            <MiniFulfillment order={order} />
            <div className="invoice-preview-items">{order.products?.map((item) => <p key={`${item.productId}-${item.name}`}><span>{item.quantity} × {item.name}</span><b>{money(item.price * item.quantity)}</b></p>)}</div>
            <div className="invoice-preview-total"><p><span>Trước thuế</span><b>{money(totals.beforeVat)}</b></p><p><span>VAT {form.vatRate === 'KCT' ? 'KCT' : `${form.vatRate}%`}</span><b>{money(totals.vat)}</b></p><p><span>Tổng thanh toán</span><b>{money(totals.total)}</b></p></div>
            <small className="invoice-preview-warning">Giá đơn hàng được hiểu là đã bao gồm VAT; hệ thống tách phần tiền trước thuế và tiền thuế để tổng thanh toán không thay đổi.</small>
          </article>
        </div>

        <footer className="invoice-modal-actions"><button type="button" className="btn-ghost" onClick={onClose}>Đóng</button><button type="button" className="btn-outline" onClick={() => print('thermal')}>In POS 80mm</button><button type="button" className="btn-outline" onClick={() => print('a4')}>In A4 / Lưu PDF</button><button type="button" className="btn-gold" disabled={saving} onClick={save}>{saving ? 'Đang lưu...' : 'Lưu dữ liệu hóa đơn'}</button></footer>
      </section>
    </div>
  );
};

export default InvoicePrintModal;
