const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patchRoot = __dirname;
const sellerPath = path.join(root, 'frontend', 'src', 'pages', 'SellerDashboard.jsx');
const invoicePath = path.join(root, 'frontend', 'src', 'components', 'InvoicePrintModal.jsx');
const replacementInvoice = path.join(patchRoot, 'InvoicePrintModal.jsx');
const backupDir = path.join(root, 'patch-backups', `invoice-map-cash-v21-${Date.now()}`);

function fail(msg) {
  console.error('[ERROR]', msg);
  process.exit(1);
}
function ensure(file) { if (!fs.existsSync(file)) fail(`Missing file: ${file}`); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, content) { fs.writeFileSync(file, content, 'utf8'); }
function backup(file) {
  fs.mkdirSync(backupDir, { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
}
function insertAfter(content, anchor, insert) {
  if (content.includes(insert.trim().split('\n')[0])) return content;
  const idx = content.indexOf(anchor);
  if (idx === -1) return content;
  return content.slice(0, idx + anchor.length) + '\n' + insert + content.slice(idx + anchor.length);
}

ensure(sellerPath);
ensure(invoicePath);
ensure(replacementInvoice);
backup(sellerPath);
backup(invoicePath);

let seller = read(sellerPath);

// Remove old standalone fulfillment modal import. The invoice modal now owns fulfillment/map UI.
seller = seller.replace(/import\s+OrderFulfillmentPanel\s+from\s+['"]\.\.\/components\/OrderFulfillmentPanel\.jsx['"];?\r?\n/g, '');

// Add helpers for cash/pickup/delivery invoice printing.
const helper = `
const cashInvoiceMethods = ['cash', 'cod', 'cash_on_delivery', 'pay_later', 'tien_mat', 'thanh_toan_khi_nhan_hang'];
const invoiceAllowedTypes = ['delivery', 'shipping', 'pickup', 'takeaway', 'take_away', 'self_pickup'];
const canPrintInvoice = (order = {}) => {
  const paymentStatus = String(order.paymentStatus || '').toLowerCase();
  const paymentMethod = String(order.paymentMethod || order.paymentType || '').toLowerCase();
  const orderType = String(order.orderType || order.type || '').toLowerCase();
  const status = String(order.status || '').toLowerCase();
  if (['cancelled', 'canceled', 'cancel', 'huy', 'hủy'].includes(status)) return false;
  return paymentStatus === 'paid'
    || cashInvoiceMethods.includes(paymentMethod)
    || (invoiceAllowedTypes.includes(orderType) && (!paymentMethod || cashInvoiceMethods.includes(paymentMethod)));
};
`;
seller = insertAfter(seller, "const toParams = (filters, page, limit = 12) => Object.fromEntries(Object.entries({ ...filters, page, limit }).filter(([, value]) => value !== '' && value !== null && value !== undefined && value !== false));", helper);

// Fetch more orders for invoices, not only paid orders. Then filter with canPrintInvoice.
seller = seller.replace(
  /api\.get\('\/orders\/my-shop',\s*\{\s*params:\s*\{\s*paymentStatus:\s*'paid',\s*page:\s*1,\s*limit:\s*200\s*\}\s*\}\)/g,
  "api.get('/orders/my-shop', { params: { page: 1, limit: 500 } })"
);
seller = seller.replace(
  /const regularOrders = \(orderRes\.data\.orders \|\| \[\]\)\.filter\(\(item\) => item\.orderType !== 'dine_in'\);/g,
  "const regularOrders = (orderRes.data.orders || []).filter((item) => item.orderType !== 'dine_in' && canPrintInvoice(item));"
);

// If updatePayment adds invoices only when paid, let cash-printable orders also stay in invoice list.
seller = seller.replace(
  /setInvoiceOrders\(\(current\) => paymentStatus === 'paid'\s*\? affected\.reduce\(\(list, item\) => upsertFirst\(list, item, 20\), current\)\s*:\s*current\.filter\(\(item\) => !affected\.some\(\(changed\) => changed\._id === item\._id\)\)\);/g,
  "setInvoiceOrders((current) => affected.some(canPrintInvoice) ? affected.filter(canPrintInvoice).reduce((list, item) => upsertFirst(list, item, 20), current) : current.filter((item) => !affected.some((changed) => changed._id === item._id)));"
);

// Allow invoice button for paid OR cash/pickup/delivery invoices.
seller = seller.replace(/\{order\.paymentStatus === 'paid' && \(/g, '{canPrintInvoice(order) && (');

// Stop card clicks from being triggered by invoice buttons.
seller = seller.replace(/onClick=\{\(\) => setInvoiceOrder\(order\)\}/g, "onClick={(e) => { e.stopPropagation(); setInvoiceOrder(order); }}");

// Clean the broken two-modal leftover if it exists.
seller = seller.replace(/\{invoiceOrder && \(\s*<>\s*<InvoicePrintModal\s+order=\{invoiceOrder\}\s+shop=\{shop\}\s+onClose=\{\(\) => setInvoiceOrder\(null\)\}\s+onSave=\{saveInvoiceData\}\s*\/>\s*<OrderFulfillmentPanel\s+order=\{invoiceOrder\}\s*\/>\s*<\/?>\s*\)\}/gs,
`{invoiceOrder && (
        <InvoicePrintModal
          order={invoiceOrder}
          shop={shop}
          onClose={() => setInvoiceOrder(null)}
          onSave={saveInvoiceData}
        />
      )}`);

// Defensive cleanup for any raw component line left behind.
seller = seller.replace(/\s*<OrderFulfillmentPanel\s+order=\{invoiceOrder\}\s*\/>/g, '');

write(sellerPath, seller);
fs.copyFileSync(replacementInvoice, invoicePath);

console.log('[OK] Updated SellerDashboard.jsx: cash/pickup/delivery invoices can print before paid/completed.');
console.log('[OK] Replaced InvoicePrintModal.jsx with pinned-map extractor and fulfillment info inside one modal.');
console.log('[BACKUP]', backupDir);
console.log('[DONE] Restart frontend. If pinned map still says no coordinates, backend checkout is not saving lat/lng into the order document.');
