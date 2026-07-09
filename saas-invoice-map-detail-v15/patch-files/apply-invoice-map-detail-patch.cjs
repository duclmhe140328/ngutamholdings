const fs = require('fs');
const path = require('path');

const root = process.cwd();
const log = (m) => console.log(`[v15] ${m}`);
const ok = (m) => console.log(`[OK] ${m}`);
const warn = (m) => console.warn(`[WARN] ${m}`);

function exists(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s, 'utf8'); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function backup(file) {
  if (!exists(file)) return;
  const rel = path.relative(root, file).replace(/[\\/:*?"<>|]/g, '_');
  const dir = path.join(root, 'patch-backups', `invoice-map-detail-v15-${Date.now()}`);
  ensureDir(dir);
  fs.copyFileSync(file, path.join(dir, rel));
}
function walk(dir, acc = []) {
  if (!exists(dir)) return acc;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'build', '.git', 'patch-backups'].includes(item.name)) continue;
    const p = path.join(dir, item.name);
    if (item.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
function findFile(name, preferred = []) {
  for (const p of preferred) if (exists(p)) return p;
  return walk(root).find((p) => path.basename(p) === name) || null;
}

const frontendDir = ['frontend', 'client', 'web', '.']
  .map((d) => path.join(root, d))
  .find((d) => exists(path.join(d, 'src')));
if (!frontendDir) throw new Error('Cannot find frontend src directory');
const srcDir = path.join(frontendDir, 'src');
const componentsDir = path.join(srcDir, 'components');
ensureDir(componentsDir);

const sellerDashboard = findFile('SellerDashboard.jsx', [
  path.join(srcDir, 'pages', 'SellerDashboard.jsx'),
  path.join(srcDir, 'SellerDashboard.jsx'),
]);
if (!sellerDashboard) throw new Error('Cannot find SellerDashboard.jsx');
ok(`Found SellerDashboard: ${path.relative(root, sellerDashboard)}`);

const fulfillmentPanel = path.join(componentsDir, 'OrderFulfillmentPanel.jsx');
write(fulfillmentPanel, `import React from 'react';

const safeText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (typeof value === 'object') {
    const parts = [
      value.fullName,
      value.name,
      value.phone,
      value.address,
      value.detail,
      value.street,
      value.ward,
      value.district,
      value.province,
      value.city,
      value.note
    ].filter(Boolean);
    return parts.join(', ');
  }
  return '';
};

const first = (...values) => values.map(safeText).find(Boolean) || '';
const firstRaw = (...values) => values.find((v) => v !== null && v !== undefined && String(v).trim?.() !== '') || null;

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

const getLatLng = (order = {}) => {
  const candidates = [
    order.deliveryLocation,
    order.location,
    order.customerLocation,
    order.shippingLocation,
    order.geo,
    order.coordinates,
    order.map,
    order.shippingAddress,
    order.deliveryAddress,
    order.addressInfo,
    order.fulfillmentInfo,
    order.checkoutInfo
  ].filter(Boolean);

  for (const item of candidates) {
    if (Array.isArray(item) && item.length >= 2) {
      const lng = Number(item[0]);
      const lat = Number(item[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    if (typeof item === 'object') {
      const lat = Number(item.lat ?? item.latitude ?? item.y);
      const lng = Number(item.lng ?? item.longitude ?? item.lon ?? item.x);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      if (Array.isArray(item.coordinates) && item.coordinates.length >= 2) {
        const lng2 = Number(item.coordinates[0]);
        const lat2 = Number(item.coordinates[1]);
        if (Number.isFinite(lat2) && Number.isFinite(lng2)) return { lat: lat2, lng: lng2 };
      }
    }
  }
  return null;
};

const isPickupOrder = (order = {}) => {
  const type = String(order.orderType || order.fulfillmentType || order.deliveryMethod || order.shippingMethod || order.receiveMethod || '').toLowerCase();
  return ['pickup', 'takeaway', 'take_away', 'self_pickup', 'at_shop', 'store_pickup', 'den_lay', 'tu_den_lay'].some((key) => type.includes(key));
};

const isShippingOrder = (order = {}) => {
  const type = String(order.orderType || order.fulfillmentType || order.deliveryMethod || order.shippingMethod || order.receiveMethod || '').toLowerCase();
  return ['delivery', 'shipping', 'ship', 'giao_hang', 'home_delivery'].some((key) => type.includes(key));
};

const getAddress = (order = {}) => first(
  order.fullAddress,
  order.address,
  order.customerAddress,
  order.deliveryAddress,
  order.shippingAddress,
  order.receiverAddress,
  order.location?.address,
  order.deliveryLocation?.address,
  order.shippingLocation?.address,
  order.fulfillmentInfo?.address,
  order.checkoutInfo?.address
);

const getNote = (order = {}) => first(
  order.note,
  order.customerNote,
  order.orderNote,
  order.checkoutNote,
  order.noteToSeller,
  order.deliveryNote,
  order.shippingNote,
  order.pickupNote,
  order.fulfillmentInfo?.note,
  order.checkoutInfo?.note,
  order.deliveryAddress?.note,
  order.shippingAddress?.note
);

const getPickupAt = (order = {}) => {
  const value = firstRaw(
    order.pickupAt,
    order.pickupTime,
    order.pickupDateTime,
    order.scheduledPickupAt,
    order.expectedPickupAt,
    order.receiveAt,
    order.fulfillmentInfo?.pickupAt,
    order.checkoutInfo?.pickupAt
  );
  if (value) return formatDateTime(value);
  const date = first(order.pickupDate, order.fulfillmentInfo?.pickupDate, order.checkoutInfo?.pickupDate);
  const time = first(order.pickupHour, order.pickupTimeText, order.pickupSlot, order.fulfillmentInfo?.pickupTime, order.checkoutInfo?.pickupTime);
  return [date, time].filter(Boolean).join(' ');
};

const getPhone = (order = {}) => first(
  order.phone,
  order.customerPhone,
  order.receiverPhone,
  order.deliveryPhone,
  order.shippingAddress?.phone,
  order.deliveryAddress?.phone,
  order.fulfillmentInfo?.phone,
  order.checkoutInfo?.phone
);

const OrderFulfillmentPanel = ({ order }) => {
  if (!order) return null;
  const pickup = isPickupOrder(order);
  const shipping = isShippingOrder(order) || getAddress(order) || getLatLng(order);
  const address = getAddress(order);
  const note = getNote(order);
  const pickupAt = getPickupAt(order);
  const phone = getPhone(order);
  const latLng = getLatLng(order);
  const mapQuery = latLng ? `${latLng.lat},${latLng.lng}` : address;
  const mapUrl = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}` : '';
  const embedUrl = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&output=embed` : '';

  if (!pickup && !shipping && !note && !phone) return null;

  return (
    <section className="fh-fulfillment-panel">
      <style>{`
        .fh-fulfillment-panel{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;box-shadow:0 16px 40px rgba(15,23,42,.08);}
        .fh-fulfillment-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px;}
        .fh-fulfillment-head h3{margin:0;font-size:17px;font-weight:800;color:#0f172a;}
        .fh-fulfillment-badge{border-radius:999px;padding:6px 10px;font-size:12px;font-weight:800;background:#fff7ed;color:#c2410c;white-space:nowrap;}
        .fh-fulfillment-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px;}
        .fh-fulfillment-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px;}
        .fh-fulfillment-item span{display:block;font-size:12px;color:#64748b;margin-bottom:5px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;}
        .fh-fulfillment-item b,.fh-fulfillment-item p{display:block;margin:0;color:#0f172a;font-size:14px;line-height:1.45;word-break:break-word;}
        .fh-map-box{overflow:hidden;border-radius:16px;border:1px solid #e2e8f0;background:#f8fafc;margin-top:12px;}
        .fh-map-box iframe{display:block;width:100%;height:260px;border:0;}
        .fh-map-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;background:#fff;}
        .fh-map-footer small{color:#64748b;}
        .fh-map-footer a{color:#2563eb;font-weight:800;text-decoration:none;}
        @media(max-width:720px){.fh-fulfillment-grid{grid-template-columns:1fr}.fh-map-box iframe{height:220px}.fh-fulfillment-head{flex-direction:column}.fh-fulfillment-badge{width:max-content}}
      `}</style>
      <div className="fh-fulfillment-head">
        <div>
          <h3>Thông tin nhận / giao hàng</h3>
          <p style={{margin:'4px 0 0',color:'#64748b',fontSize:13}}>Dữ liệu lấy từ phần checkout của khách.</p>
        </div>
        <span className="fh-fulfillment-badge">{pickup ? 'Tự đến lấy' : shipping ? 'Giao hàng / Ship' : 'Thông tin đơn'}</span>
      </div>

      <div className="fh-fulfillment-grid">
        {pickupAt && <div className="fh-fulfillment-item"><span>Ngày giờ lấy</span><b>{pickupAt}</b></div>}
        {phone && <div className="fh-fulfillment-item"><span>Số điện thoại</span><b>{phone}</b></div>}
        {address && <div className="fh-fulfillment-item" style={{gridColumn:'1 / -1'}}><span>Địa chỉ giao hàng</span><p>{address}</p></div>}
        {note && <div className="fh-fulfillment-item" style={{gridColumn:'1 / -1'}}><span>Ghi chú khách hàng</span><p>{note}</p></div>}
      </div>

      {embedUrl && (
        <div className="fh-map-box">
          <iframe title="Bản đồ giao hàng" src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <div className="fh-map-footer">
            <small>{latLng ? `${latLng.lat}, ${latLng.lng}` : 'Bản đồ theo địa chỉ khách nhập'}</small>
            <a href={mapUrl} target="_blank" rel="noreferrer">Mở Google Maps</a>
          </div>
        </div>
      )}

      {!embedUrl && shipping && (
        <div className="fh-fulfillment-item">
          <span>Bản đồ</span>
          <p>Chưa thấy tọa độ/địa chỉ map trong dữ liệu đơn. Kiểm tra checkout đã gửi lat/lng và backend đã lưu vào order chưa.</p>
        </div>
      )}
    </section>
  );
};

export default OrderFulfillmentPanel;
`);
ok(`Wrote ${path.relative(root, fulfillmentPanel)}`);

const fullModal = path.join(componentsDir, 'FullInvoiceDetailModal.jsx');
write(fullModal, `import React, { useState } from 'react';
import InvoicePrintModal from './InvoicePrintModal.jsx';
import OrderFulfillmentPanel from './OrderFulfillmentPanel.jsx';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const formatDateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

const customerName = (order = {}) => order.buyerCompanyName || order.buyerName || order.customerName || order.name || 'Khách lẻ';
const phone = (order = {}) => order.phone || order.customerPhone || order.receiverPhone || order.shippingAddress?.phone || order.deliveryAddress?.phone || '';
const products = (order = {}) => Array.isArray(order.products) ? order.products : [];

const FullInvoiceDetailModal = ({ order, shop, onClose, onSave }) => {
  const [printOpen, setPrintOpen] = useState(false);
  if (!order) return null;

  return (
    <>
      <div className="fh-full-invoice-layer">
        <style>{`
          .fh-full-invoice-layer{position:fixed;inset:0;background:rgba(15,23,42,.72);backdrop-filter:blur(8px);z-index:9997;display:flex;align-items:center;justify-content:center;padding:18px;}
          .fh-full-invoice-modal{width:min(1120px,100%);max-height:94vh;overflow:auto;background:#f8fafc;border-radius:24px;box-shadow:0 30px 80px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.22);}
          .fh-full-invoice-header{position:sticky;top:0;z-index:2;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;padding:20px 22px;display:flex;justify-content:space-between;gap:14px;align-items:flex-start;}
          .fh-full-invoice-header h2{margin:0;font-size:22px;font-weight:900;}
          .fh-full-invoice-header p{margin:6px 0 0;color:#cbd5e1;font-size:14px;}
          .fh-full-invoice-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;}
          .fh-full-invoice-btn{border:0;border-radius:12px;padding:11px 14px;font-weight:800;cursor:pointer;}
          .fh-full-invoice-btn.gold{background:#f59e0b;color:#fff;}.fh-full-invoice-btn.light{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.22);}
          .fh-full-invoice-body{padding:20px;display:grid;grid-template-columns:1fr 1.2fr;gap:18px;}
          .fh-full-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;box-shadow:0 12px 30px rgba(15,23,42,.06);}
          .fh-full-card h3{margin:0 0 14px;font-size:17px;font-weight:900;color:#0f172a;}
          .fh-info-row{display:flex;justify-content:space-between;gap:16px;border-bottom:1px dashed #e2e8f0;padding:10px 0;font-size:14px;}
          .fh-info-row span{color:#64748b;}.fh-info-row b{color:#0f172a;text-align:right;}
          .fh-product-row{display:grid;grid-template-columns:1fr auto auto;gap:12px;padding:12px 0;border-bottom:1px dashed #e2e8f0;font-size:14px;align-items:start;}
          .fh-product-row b{color:#0f172a;}.fh-product-row small{color:#64748b;display:block;margin-top:3px;}.fh-total-row{display:flex;justify-content:space-between;gap:14px;margin-top:14px;padding-top:14px;border-top:2px solid #e2e8f0;font-size:18px;font-weight:900;color:#0f172a;}
          .fh-full-invoice-wide{grid-column:1 / -1;}
          @media(max-width:820px){.fh-full-invoice-layer{padding:0;align-items:stretch}.fh-full-invoice-modal{max-height:100vh;border-radius:0}.fh-full-invoice-header{flex-direction:column}.fh-full-invoice-actions{width:100%;justify-content:stretch}.fh-full-invoice-btn{flex:1}.fh-full-invoice-body{grid-template-columns:1fr;padding:14px}.fh-product-row{grid-template-columns:1fr}.fh-info-row{flex-direction:column;gap:4px}.fh-info-row b{text-align:left}}
        `}</style>
        <section className="fh-full-invoice-modal">
          <header className="fh-full-invoice-header">
            <div>
              <h2>Chi tiết hóa đơn #{order.orderCode || order.sessionCode || order._id}</h2>
              <p>Hiển thị đầy đủ thông tin khách nhập ở checkout: ghi chú, giờ lấy, địa chỉ và bản đồ giao hàng.</p>
            </div>
            <div className="fh-full-invoice-actions">
              <button className="fh-full-invoice-btn gold" onClick={() => setPrintOpen(true)}>In hóa đơn</button>
              <button className="fh-full-invoice-btn light" onClick={onClose}>Đóng</button>
            </div>
          </header>
          <main className="fh-full-invoice-body">
            <section className="fh-full-card">
              <h3>Thông tin khách</h3>
              <div className="fh-info-row"><span>Khách hàng</span><b>{customerName(order)}</b></div>
              <div className="fh-info-row"><span>Số điện thoại</span><b>{phone(order) || 'Chưa có'}</b></div>
              <div className="fh-info-row"><span>Loại đơn</span><b>{order.orderType || order.fulfillmentType || order.deliveryMethod || 'Không rõ'}</b></div>
              <div className="fh-info-row"><span>Thời gian tạo</span><b>{formatDateTime(order.createdAt)}</b></div>
              <div className="fh-info-row"><span>Đã thu</span><b>{formatDateTime(order.paidAt)}</b></div>
              <div className="fh-info-row"><span>Thanh toán</span><b>{order.paymentMethod || order.paymentStatus || 'Không rõ'}</b></div>
            </section>

            <section className="fh-full-card">
              <h3>Sản phẩm / món</h3>
              {products(order).length ? products(order).map((item, index) => (
                <div className="fh-product-row" key={item._id || index}>
                  <div><b>{item.name || item.productName || 'Sản phẩm'}</b>{item.note && <small>Ghi chú: {item.note}</small>}</div>
                  <span>x{item.quantity || 1}</span>
                  <b>{money(item.amount || item.total || Number(item.price || 0) * Number(item.quantity || 1))}</b>
                </div>
              )) : <p style={{color:'#64748b',margin:0}}>Chưa có danh sách sản phẩm trong dữ liệu hóa đơn.</p>}
              <div className="fh-total-row"><span>Tổng tiền</span><b>{money(order.totalAmount || order.total || order.grandTotal)}</b></div>
            </section>

            <div className="fh-full-invoice-wide">
              <OrderFulfillmentPanel order={order} />
            </div>
          </main>
        </section>
      </div>
      {printOpen && <InvoicePrintModal order={order} shop={shop} onClose={() => setPrintOpen(false)} onSave={onSave} />}
    </>
  );
};

export default FullInvoiceDetailModal;
`);
ok(`Wrote ${path.relative(root, fullModal)}`);

backup(sellerDashboard);
let s = read(sellerDashboard);
if (!s.includes("FullInvoiceDetailModal")) {
  const importLine = "import InvoicePrintModal from '../components/InvoicePrintModal.jsx';";
  if (s.includes(importLine)) {
    s = s.replace(importLine, "import InvoicePrintModal from '../components/InvoicePrintModal.jsx';\nimport FullInvoiceDetailModal from '../components/FullInvoiceDetailModal.jsx';");
  } else {
    const lastImportMatch = [...s.matchAll(/^import .*;$/gm)].pop();
    if (lastImportMatch) {
      const idx = lastImportMatch.index + lastImportMatch[0].length;
      s = s.slice(0, idx) + "\nimport FullInvoiceDetailModal from '../components/FullInvoiceDetailModal.jsx';" + s.slice(idx);
    }
  }
}

if (!s.includes('const openInvoiceOrder = async (order) =>')) {
  const fn = `
  const openInvoiceOrder = async (order) => {
    if (!order) return;
    const id = order._id || order.id;
    if (!id || order.isDiningSessionInvoice) {
      setInvoiceOrder(order);
      return;
    }
    const detailPaths = [
      \`/orders/\${id}\`,
      \`/orders/my-shop/\${id}\`,
      \`/orders/detail/\${id}\`,
      \`/orders/\${id}/detail\`
    ];
    for (const url of detailPaths) {
      try {
        const res = await api.get(url);
        const detail = res.data?.order || res.data?.data || res.data;
        if (detail && typeof detail === 'object') {
          setInvoiceOrder({ ...order, ...detail });
          return;
        }
      } catch (_) {}
    }
    setInvoiceOrder(order);
  };
`;
  const anchor = '  const updateInvoiceFilter = (field, value) =>';
  if (s.includes(anchor)) s = s.replace(anchor, fn + '\n' + anchor);
  else s = s.replace('  const saveInvoiceData = async (payload) =>', fn + '\n  const saveInvoiceData = async (payload) =>');
}

s = s.replaceAll('onClick={() => setInvoiceOrder(order)}', 'onClick={() => openInvoiceOrder(order)}');
s = s.replaceAll('onClick={() => setInvoiceOrder(order) }', 'onClick={() => openInvoiceOrder(order)}');
s = s.replaceAll('onClick={() => setInvoiceOrder(order)}', 'onClick={() => openInvoiceOrder(order)}');

// Replace final invoice modal rendering with full detail modal.
s = s.replace(/\{invoiceOrder && \(\s*<InvoicePrintModal order=\{invoiceOrder\} shop=\{shop\} onClose=\{\(\) => setInvoiceOrder\(null\)\} onSave=\{saveInvoiceData\} \/>\s*\)\}/m,
`{invoiceOrder && (
        <FullInvoiceDetailModal order={invoiceOrder} shop={shop} onClose={() => setInvoiceOrder(null)} onSave={saveInvoiceData} />
      )}`);

write(sellerDashboard, s);
ok(`Patched ${path.relative(root, sellerDashboard)}`);

// Optional: write a checkout field guide to backend docs so deployment owners know what must be saved.
const docsDir = path.join(root, 'docs');
ensureDir(docsDir);
write(path.join(docsDir, 'checkout-order-fields-for-seller-map.md'), `# Checkout fields required for seller map/invoice detail

For seller invoice details to show pickup/delivery data, the order saved in MongoDB must keep at least these fields when checkout submits them:

- orderType: pickup | delivery | shipping | dine_in
- note / customerNote / checkoutNote
- pickupAt OR pickupDate + pickupTime
- address OR deliveryAddress OR shippingAddress
- deliveryLocation: { lat, lng, address } OR location: { lat, lng, address }

The v15 frontend reads many common aliases, but it cannot show map data if backend discards these fields during order creation.
`);
ok('Wrote docs/checkout-order-fields-for-seller-map.md');

console.log('\nDONE v15. Restart frontend. If map is still empty, check that checkout POST body is saved into order document.');
