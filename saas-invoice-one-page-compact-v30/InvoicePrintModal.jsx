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



// FH_SHOP_BANK_QR_V29: QR thanh toán ngân hàng của chủ shop, đúng tổng tiền hóa đơn.
const normalizeBankCode = (value = '') => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9]/g, '');

const buildShopBankQrUrl = ({ shop = {}, amount = 0, order = {} }) => {
  const bankCode = normalizeBankCode(shop.bankId || shop.bankCode || shop.bankName || shop.bankShortName || '');
  const accountNumber = normalizeBankCode(shop.bankAccountNumber || '');
  if (!bankCode || !accountNumber) return '';

  const transferContent = String(order.paymentReference || order.orderCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-_]/g, '');

  const params = new URLSearchParams({
    amount: String(Math.max(0, Math.round(Number(amount || 0)))),
    addInfo: transferContent,
    accountName: String(shop.bankAccountName || shop.legalName || shop.name || '').trim()
  });

  return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?${params.toString()}`;
};

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
  buyerAddress: order.buyerAddress || readAddress(order) || '',
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

function textOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return textOf(
      value.fullAddress || value.formattedAddress || value.displayName || value.label || value.address ||
      value.addressText || value.text || value.value || value.name || value.description || value.note || ''
    );
  }
  return '';
}

function firstText(...values) {
  for (const value of values) {
    const text = textOf(value);
    if (text) return text;
  }
  return '';
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const cleaned = value.replace(',', '.').trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validLatLng(lat, lng) {
  return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function parseCoordArray(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return null;
  const a = num(arr[0]);
  const b = num(arr[1]);
  if (validLatLng(a, b)) return { lat: a, lng: b };
  if (validLatLng(b, a)) return { lat: b, lng: a };
  return null;
}

function getDirectLatLng(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const lat = num(obj.customerLatitude ?? obj.deliveryLatitude ?? obj.shippingLatitude ?? obj.lat ?? obj.latitude ?? obj.Latitude ?? obj.LAT ?? obj.y);
  const lng = num(obj.customerLongitude ?? obj.deliveryLongitude ?? obj.shippingLongitude ?? obj.lng ?? obj.lon ?? obj.long ?? obj.longitude ?? obj.Longitude ?? obj.LNG ?? obj.x);
  if (validLatLng(lat, lng)) return { lat, lng };
  return null;
}

function findPinnedLocation(value, depth = 0, seen = new Set()) {
  if (!value || depth > 5) return null;
  if (typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    const parsed = parseCoordArray(value);
    if (parsed) return parsed;
    for (const item of value) {
      const found = findPinnedLocation(item, depth + 1, seen);
      if (found) return found;
    }
    return null;
  }

  const direct = getDirectLatLng(value);
  if (direct) return direct;

  for (const key of ['coordinates', 'coordinate', 'coords', 'coord', 'position', 'center', 'marker', 'pin', 'pinned', 'pinnedLocation', 'customerPin', 'customerLocation', 'deliveryLocation', 'shippingLocation', 'location', 'geo', 'geometry', 'map', 'mapLocation', 'addressLocation', 'selectedLocation', 'selectedAddress', 'checkoutLocation', 'place']) {
    if (value[key] !== undefined) {
      const found = findPinnedLocation(value[key], depth + 1, seen);
      if (found) return found;
    }
  }

  if (value.type === 'Point' && value.coordinates) {
    const found = findPinnedLocation(value.coordinates, depth + 1, seen);
    if (found) return found;
  }

  if (value.geometry?.location) {
    const found = findPinnedLocation(value.geometry.location, depth + 1, seen);
    if (found) return found;
  }

  // last resort: scan nested objects with keys that look like location data
  for (const [key, child] of Object.entries(value)) {
    if (!child || typeof child !== 'object') continue;
    if (/loc|map|pin|geo|coord|address|delivery|shipping|customer/i.test(key)) {
      const found = findPinnedLocation(child, depth + 1, seen);
      if (found) return found;
    }
  }
  return null;
}

function readAddress(order) {
  return firstText(
    order.deliveryAddress,
    order.shippingAddress,
    order.customerAddress,
    order.address,
    order.fullAddress,
    order.receiverAddress,
    order.recipientAddress,
    order.deliveryLocation,
    order.shippingLocation,
    order.customerLocation,
    order.location,
    order.checkoutLocation,
    order.selectedAddress,
    order.mapAddress
  );
}

function readNote(order) {
  return firstText(
    order.customerNote,
    order.checkoutNote,
    order.deliveryNote,
    order.shippingNote,
    order.pickupNote,
    order.note,
    order.orderNote,
    order.buyerNote,
    order.message,
    order.specialInstructions
  );
}

function readPickupTime(order) {
  return firstText(
    order.pickupAt,
    order.pickupTime,
    order.pickupDateTime,
    order.scheduledPickupAt,
    order.takeAwayAt,
    order.receiveAt,
    order.receiveTime,
    order.expectedPickupAt,
    order.expectedReceiveAt,
    order.deliveryTime,
    order.scheduledAt
  );
}

function readMapUrl(order, pinned) {
  const direct = firstText(order.mapUrl, order.googleMapUrl, order.mapsUrl, order.deliveryMapUrl, order.locationUrl, order.pinnedMapUrl);
  if (direct) return direct;
  if (pinned) return `https://www.google.com/maps?q=${pinned.lat},${pinned.lng}`;
  return '';
}

function fulfillmentInfo(order = {}) {
  const type = String(order.orderType || order.type || order.serviceMode || '').toLowerCase();
  const isDelivery = ['delivery', 'shipping', 'ship', 'giao_hang'].includes(type);
  const isPickup = ['pickup', 'takeaway', 'take_away', 'self_pickup', 'den_lay', 'to_go'].includes(type);
  const pinned = findPinnedLocation(order);
  const address = readAddress(order);
  const note = readNote(order);
  const pickupTime = readPickupTime(order);
  const mapUrl = readMapUrl(order, pinned);
  return {
    type,
    label: order.tableNumber ? `Tại bàn ${order.tableNumber}` : isDelivery ? 'Giao hàng' : isPickup ? 'Khách tự đến lấy' : (order.orderType || 'Đơn hàng'),
    isDelivery,
    isPickup,
    address,
    note,
    pickupTime,
    pinned,
    mapUrl,
    phone: firstText(order.phone, order.customerPhone, order.receiverPhone, order.recipientPhone, order.loyaltyPhone),
    receiver: firstText(order.receiverName, order.recipientName, order.customerName, order.buyerName)
  };
}

const row = (label, value) => value ? <p><b>{label}:</b> <span>{value}</span></p> : null;

const InvoicePrintModal = ({ order, shop, onClose, onSave }) => {
  const [form, setForm] = useState(() => initialForm(order, shop));
  const [saving, setSaving] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => setForm(initialForm(order, shop)), [order?._id, shop?._id]);

  const fulfill = useMemo(() => fulfillmentInfo(order), [order]);

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
    const rows = (order.products || []).map((item, index) => {
      const amount = Number(item.price || 0) * Number(item.quantity || 0);
      return `<tr>
        <td class="center">${index + 1}</td>
        <td class="item-name">${escapeHtml(item.name)}</td>
        <td class="center">${escapeHtml(item.unit || (shop.businessType === 'restaurant' ? 'Phần' : 'SP'))}</td>
        <td class="num">${Number(item.quantity || 0).toLocaleString('vi-VN')}</td>
        <td class="num">${Number(item.price || 0).toLocaleString('vi-VN')}</td>
        <td class="num"><b>${amount.toLocaleString('vi-VN')}</b></td>
      </tr>`;
    }).join('');

    const customerNames = (order.customerNames || []).length
      ? order.customerNames.join(' · ')
      : (form.buyerName || order.customerName || 'Khách lẻ');
    const customerPhone = fulfill.phone || order.phone || order.loyaltyPhone || '—';
    const customerAddress = form.buyerAddress || fulfill.address || readAddress(order) || '—';
    const orderTypeText = order.tableNumber ? `Tại bàn ${order.tableNumber}` : (fulfill.label || order.orderType || 'Đơn hàng');
    const paymentStatusText = order.paymentStatus === 'paid'
      ? `Đã thanh toán${order.paidAt ? ` lúc ${dateTime(order.paidAt)}` : ''}`
      : (order.paymentStatus === 'partial'
        ? `Đã nhận ${money(order.bankReceivedAmount)} / ${money(order.totalAmount)}`
        : 'Chưa thanh toán');
    const noteText = fulfill.note || order.note || form.invoiceNote || '';
    const vatText = form.vatRate === 'KCT' ? 'Không chịu thuế' : `${escapeHtml(form.vatRate)}%`;
    const shopBankQrUrl = buildShopBankQrUrl({ shop, amount: totals.total, order });
    const shopBankTransferContent = escapeHtml(String(order.paymentReference || order.orderCode || '').trim().toUpperCase());
    const invoiceDateText = dateTime(form.invoiceIssuedAt || order.paidAt || order.createdAt || new Date());

    const externalBlock = external ? `<section class="compact-external">
      ${qrDataUrl ? `<img class="lookup-qr" src="${qrDataUrl}" alt="QR tra cứu"/>` : ''}
      <div><b>HĐĐT bên ngoài:</b> Mẫu ${escapeHtml(form.invoiceTemplateCode || '—')} · Ký hiệu ${escapeHtml(form.invoiceSymbol || '—')} · Số ${escapeHtml(form.invoiceNumber || '—')} · Mã tra cứu ${escapeHtml(form.invoiceLookupCode || '—')}</div>
    </section>` : '';

    const bankQrBlock = shopBankQrUrl ? `<section class="pay-qr">
      <img src="${escapeHtml(shopBankQrUrl)}" alt="QR thanh toán chủ shop"/>
      <div>
        <h3>QR thanh toán chủ shop</h3>
        <p><b>Số tiền:</b> <strong>${money(totals.total)}</strong></p>
        <p><b>Nội dung:</b> ${shopBankTransferContent || escapeHtml(order.orderCode || '—')}</p>
        <p><b>TK:</b> ${escapeHtml(shop.bankAccountNumber || '—')} · ${escapeHtml(shop.bankAccountName || shop.legalName || shop.name || '—')}</p>
        <p><b>NH:</b> ${escapeHtml(shop.bankName || shop.bankCode || shop.bankId || '—')}</p>
      </div>
    </section>` : '';

    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(title)} #${escapeHtml(order.orderCode)}</title>
    <style>
      *{box-sizing:border-box}body{margin:0;background:#fff;color:#15120e;font:${isThermal ? '10.5px/1.28' : '11px/1.28'} Arial,sans-serif}.sheet{width:${isThermal ? '80mm' : '210mm'};margin:0 auto;background:#fff;padding:${isThermal ? '4mm 3mm' : '6mm 7mm'};box-shadow:none}
      .header{display:grid;grid-template-columns:${isThermal ? '1fr' : '1.15fr .85fr'};gap:${isThermal ? '5px' : '10px'};padding-bottom:7px;border-bottom:1.5px solid #1d1710}.brand{display:flex;gap:8px;align-items:flex-start}.logo{width:${isThermal ? '34px' : '42px'};height:${isThermal ? '34px' : '42px'};object-fit:cover;border-radius:8px;border:1px solid #ddd}.brand h2{margin:0 0 3px;font:800 ${isThermal ? '13px' : '16px'} Arial,sans-serif}.brand p,.invoice-title p{margin:1px 0;font-size:${isThermal ? '9px' : '10px'}}.invoice-title{text-align:${isThermal ? 'left' : 'right'}}.invoice-title h1{margin:0;font:900 ${isThermal ? '15px' : '20px'} Arial,sans-serif;text-transform:uppercase}.invoice-title b{display:block;margin-top:3px;color:#9b6a27;font-size:${isThermal ? '12px' : '14px'}}.badge{display:inline-block;margin-top:3px;padding:3px 6px;border-radius:999px;background:#f4ead7;font-size:8px;font-weight:800}.muted{color:#665f57}
      .customer-strip{display:grid;grid-template-columns:${isThermal ? '1fr' : '1.15fr .85fr'};gap:6px;margin:7px 0;padding:6px 7px;border:1px solid #d9d1c6;border-radius:8px;background:#fffdf8}.customer-strip p{margin:1px 0}.customer-strip b{color:#5f421f}.wide{grid-column:1/-1}.line-clamp{display:block;white-space:normal;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${isThermal ? '2' : '1'};-webkit-box-orient:vertical}
      table{width:100%;border-collapse:collapse;margin-top:6px;font-size:${isThermal ? '9px' : '10.2px'}}th,td{border:1px solid #cfc6ba;padding:${isThermal ? '3px 2px' : '4px 4px'};vertical-align:top}th{background:#f4eee5;text-transform:uppercase;font-size:${isThermal ? '7px' : '8.5px'}}.num{text-align:right;white-space:nowrap}.center{text-align:center}.item-name{font-weight:700}.bottom-grid{display:grid;grid-template-columns:${isThermal ? '1fr' : '1fr 210px'};gap:${isThermal ? '6px' : '10px'};align-items:start;margin-top:7px}.totals{border:1px solid #d9d1c6;border-radius:8px;padding:6px 8px}.total-row{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px dashed #d6cec2}.total-row:last-child{border-bottom:0}.total-row.grand{font-size:${isThermal ? '12px' : '14px'};font-weight:900}.words{margin-top:5px;padding:5px 6px;border-radius:7px;background:#f8f3ec;font-size:${isThermal ? '9px' : '10px'};font-style:italic}.pay-qr{display:grid;grid-template-columns:${isThermal ? '64px 1fr' : '74px 1fr'};gap:7px;align-items:center;border:1.5px solid #1d1710;border-radius:9px;padding:6px;background:#fff}.pay-qr img{width:${isThermal ? '60px' : '70px'};height:${isThermal ? '60px' : '70px'};object-fit:contain}.pay-qr h3{margin:0 0 3px;font-size:${isThermal ? '9px' : '10px'};text-transform:uppercase;color:#8b612a}.pay-qr p{margin:1px 0;font-size:${isThermal ? '8.5px' : '9.5px'}}.pay-qr strong{font-size:${isThermal ? '11px' : '12px'};color:#111827}.compact-external{display:flex;gap:6px;align-items:center;margin-top:6px;padding:5px;border:1px dashed #d9d1c6;border-radius:7px;font-size:9px}.lookup-qr{width:42px;height:42px;object-fit:contain}.footer{margin-top:6px;padding-top:5px;border-top:1px solid #d7d0c7;text-align:center;font-size:8px;color:#625b52}
      @media print{body{background:#fff}.sheet{margin:0;box-shadow:none;width:100%;min-height:auto}@page{size:${isThermal ? '80mm auto' : 'A4'};margin:${isThermal ? '0' : '5mm'}}}
      @media(max-width:700px){.sheet{width:100%;padding:14px}.header,.customer-strip,.bottom-grid{grid-template-columns:1fr}.invoice-title{text-align:left}.pay-qr{grid-template-columns:72px 1fr}.pay-qr img{width:70px;height:70px}}
    </style></head><body><main class="sheet">
      <section class="header">
        <div class="brand">${shop.logoUrl ? `<img class="logo" src="${escapeHtml(shop.logoUrl)}" alt=""/>` : ''}<div><h2>${escapeHtml(sellerName)}</h2><p><b>MST:</b> ${escapeHtml(shop.taxCode || 'Chưa cập nhật')}</p><p>${escapeHtml(sellerAddress)}</p><p>${escapeHtml([sellerPhone, shop.invoiceEmail].filter(Boolean).join(' · '))}</p></div></div>
        <div class="invoice-title"><h1>${escapeHtml(title)}</h1><b>#${escapeHtml(order.orderCode)}</b><span class="badge">${external ? 'Dữ liệu HĐĐT do shop khai báo' : 'Bản in nội bộ'}</span><p class="muted">Ngày lập: ${invoiceDateText}</p></div>
      </section>

      <section class="customer-strip">
        <div><p><b>Khách hàng:</b> ${escapeHtml(customerNames)}</p><p><b>SĐT:</b> ${escapeHtml(customerPhone)}</p></div>
        <div><p><b>Loại đơn:</b> ${escapeHtml(orderTypeText)}</p><p><b>Thanh toán:</b> ${escapeHtml(paymentStatusText)}</p></div>
        <p class="wide"><b>Địa chỉ:</b> <span class="line-clamp">${escapeHtml(customerAddress)}</span></p>
        ${noteText ? `<p class="wide"><b>Ghi chú:</b> <span class="line-clamp">${escapeHtml(noteText)}</span></p>` : ''}
      </section>

      <table><thead><tr><th>STT</th><th>Tên hàng hóa/dịch vụ</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${rows}</tbody></table>
      <section class="bottom-grid">
        <div>
          <section class="totals">
            <div class="total-row"><span>Cộng tiền hàng trước thuế</span><b>${money(totals.beforeVat)}</b></div>
            <div class="total-row"><span>Thuế suất GTGT</span><b>${vatText}</b></div>
            <div class="total-row"><span>Tiền thuế GTGT</span><b>${money(totals.vat)}</b></div>
            ${Number(order.deliveryFee || 0) ? `<div class="total-row"><span>Phí giao hàng đã gồm trong tổng</span><b>${money(order.deliveryFee)}</b></div>` : ''}
            <div class="total-row grand"><span>Tổng thanh toán</span><b>${money(totals.total)}</b></div>
          </section>
          <div class="words"><b>Bằng chữ:</b> ${escapeHtml(numberToVietnamese(totals.total))}</div>
        </div>
        ${bankQrBlock}
      </section>
      ${externalBlock}
      <footer class="footer">Cảm ơn quý khách. Phiếu in nội bộ, người bán chịu trách nhiệm về thông tin thuế và phát hành hóa đơn điện tử khi cần.</footer>
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

            <div className="form-grid two">
              <div><label>Người mua hàng</label><input value={form.buyerName} onChange={(e) => update('buyerName', e.target.value)} /></div>
              <div><label>Tên công ty/đơn vị</label><input value={form.buyerCompanyName} onChange={(e) => update('buyerCompanyName', e.target.value)} /></div>
              <div><label>Mã số thuế người mua</label><input value={form.buyerTaxCode} onChange={(e) => update('buyerTaxCode', e.target.value)} /></div>
              <div><label>Email nhận hóa đơn</label><input type="email" value={form.buyerEmail} onChange={(e) => update('buyerEmail', e.target.value)} /></div>
            </div>
            <label>Địa chỉ người mua</label><input value={form.buyerAddress} onChange={(e) => update('buyerAddress', e.target.value)} />

            <section style={{ margin: '16px 0', padding: 14, borderRadius: 16, border: '1px solid #f2cf8a', background: '#fffaf0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <b style={{ display: 'block', color: '#78350f', marginBottom: 4 }}>Thông tin nhận / giao hàng</b>
                  <small style={{ color: '#92400e' }}>Dữ liệu lấy từ checkout của khách, gồm map khách ghim nếu backend đã lưu tọa độ.</small>
                </div>
                <span className="badge">{fulfill.label}</span>
              </div>
              <div style={{ display: 'grid', gap: 6, fontSize: 13, color: '#3f3528' }}>
                {row('Người nhận', fulfill.receiver)}
                {row('SĐT', fulfill.phone)}
                {(fulfill.isPickup || fulfill.pickupTime) && row('Thời gian khách đến lấy', dateTime(fulfill.pickupTime))}
                {row('Địa chỉ', fulfill.address)}
                {row('Ghi chú khách', fulfill.note)}
                {fulfill.pinned ? (
                  <p><b>Tọa độ khách ghim:</b> <span>{fulfill.pinned.lat}, {fulfill.pinned.lng}</span></p>
                ) : (
                  <p style={{ color: '#b45309' }}><b>Tọa độ khách ghim:</b> Chưa thấy trong dữ liệu order. Cần kiểm tra backend checkout có lưu lat/lng không.</p>
                )}
              </div>
              {fulfill.pinned && (
                <div style={{ marginTop: 12, overflow: 'hidden', borderRadius: 14, border: '1px solid #f4d28b' }}>
                  <iframe
                    title="Vị trí khách ghim"
                    src={`https://maps.google.com/maps?q=${fulfill.pinned.lat},${fulfill.pinned.lng}&z=17&output=embed`}
                    style={{ width: '100%', height: 210, border: 0, display: 'block' }}
                    loading="lazy"
                  />
                </div>
              )}
              {fulfill.mapUrl && <a href={fulfill.mapUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', marginTop: 10, color: '#b45309', fontWeight: 800 }}>Mở đúng vị trí trên Google Maps</a>}
            </section>

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
            <div className="invoice-preview-title"><span>#{order.orderCode}</span><h3>{form.buyerCompanyName || (order.customerNames?.length ? order.customerNames.join(' · ') : form.buyerName || order.customerName)}</h3><p>{order.products?.length || 0} dòng hàng · {order.isDiningSessionInvoice ? 'Hóa đơn tổng phiên bàn' : fulfill.label} · {dateTime(order.paidAt || order.createdAt)}</p></div>
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
