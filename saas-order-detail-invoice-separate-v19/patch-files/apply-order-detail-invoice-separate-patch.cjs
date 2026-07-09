const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patchDir = __dirname;
const sellerPath = path.join(root, 'frontend', 'src', 'pages', 'SellerDashboard.jsx');
const componentsDir = path.join(root, 'frontend', 'src', 'components');
const panelTarget = path.join(componentsDir, 'OrderFulfillmentPanel.jsx');
const panelSource = path.join(patchDir, 'OrderFulfillmentPanel.jsx');

function fail(msg) {
  console.error('[ERROR]', msg);
  process.exit(1);
}
function backup(file) {
  if (!fs.existsSync(file)) return;
  const dir = path.join(root, 'patch-backups');
  fs.mkdirSync(dir, { recursive: true });
  const name = path.basename(file).replace(/\W+/g, '_');
  fs.copyFileSync(file, path.join(dir, `${Date.now()}_${name}`));
}
function replaceAll(text, search, replacement) {
  return text.split(search).join(replacement);
}

if (!fs.existsSync(sellerPath)) fail(`Cannot find ${sellerPath}`);
if (!fs.existsSync(panelSource)) fail(`Cannot find ${panelSource}`);
fs.mkdirSync(componentsDir, { recursive: true });
backup(sellerPath);
backup(panelTarget);
fs.copyFileSync(panelSource, panelTarget);

let c = fs.readFileSync(sellerPath, 'utf8');

// Clean duplicate or old import, then add exactly once near InvoicePrintModal.
c = c.replace(/import\s+OrderFulfillmentPanel\s+from\s+['"][^'"]*OrderFulfillmentPanel\.jsx['"];\r?\n/g, '');
const invoiceImport = "import InvoicePrintModal from '../components/InvoicePrintModal.jsx';";
if (!c.includes(invoiceImport)) fail('Cannot find InvoicePrintModal import.');
c = c.replace(invoiceImport, `${invoiceImport}\nimport OrderFulfillmentPanel from '../components/OrderFulfillmentPanel.jsx';`);

// Add detail state.
const invoiceState = "const [invoiceOrder, setInvoiceOrder] = useState(null);";
if (!c.includes(invoiceState)) fail('Cannot find invoiceOrder state.');
if (!c.includes('const [detailOrder, setDetailOrder] = useState(null);')) {
  c = c.replace(invoiceState, `${invoiceState}\n  const [detailOrder, setDetailOrder] = useState(null);`);
}

// Add open detail helper.
const helperAnchor = "const updateInvoiceFilter = (field, value) => { setInvoicePage(1); setInvoiceFilters((current) => ({ ...current, [field]: value })); };";
if (!c.includes(helperAnchor)) fail('Cannot find updateInvoiceFilter anchor.');
if (!c.includes('const openOrderDetail = async (order) =>')) {
  const helper = `${helperAnchor}\n  const openOrderDetail = async (order) => {\n    if (!order) return;\n    let fullOrder = order;\n    const id = order._id || order.id;\n    if (id && !order.isDiningSessionInvoice) {\n      const detailUrls = [\`/orders/\${id}\`, \`/orders/my-shop/\${id}\`, \`/orders/detail/\${id}\`];\n      for (const url of detailUrls) {\n        try {\n          const res = await api.get(url);\n          const candidate = res.data?.order || res.data?.data || res.data;\n          if (candidate && typeof candidate === 'object') { fullOrder = { ...order, ...candidate }; break; }\n        } catch { }\n      }\n    }\n    setDetailOrder(fullOrder);\n  };`;
  c = c.replace(helperAnchor, helper);
}

// Make order cards clickable for delivery/detail modal.
const orderArticleOld = `<article key={order._id} className="fh-card fh-order-card" style={{display:'flex', alignItems:'center', padding:'20px 24px', gap:'24px'}}>`;
const orderArticleNew = `<article key={order._id} className="fh-card fh-order-card" style={{display:'flex', alignItems:'center', padding:'20px 24px', gap:'24px', cursor:'pointer'}} onClick={() => openOrderDetail(order)} role="button" tabIndex={0}>`;
if (c.includes(orderArticleOld)) c = c.replace(orderArticleOld, orderArticleNew);

const invoiceArticleOld = `<article key={order._id} className="fh-card" style={{display:'flex', alignItems:'center', padding:'20px 24px', gap:'24px', flexWrap:'wrap'}}>`;
const invoiceArticleNew = `<article key={order._id} className="fh-card" style={{display:'flex', alignItems:'center', padding:'20px 24px', gap:'24px', flexWrap:'wrap', cursor:'pointer'}} onClick={() => openOrderDetail(order)} role="button" tabIndex={0}>`;
if (c.includes(invoiceArticleOld)) c = c.replace(invoiceArticleOld, invoiceArticleNew);

// Stop card click when using status/payment controls.
const controlsOld = `<div className="fh-order-selects" style={{flex:1, display:'flex', flexDirection:'column', gap:'8px'}}>`;
const controlsNew = `<div className="fh-order-selects" style={{flex:1, display:'flex', flexDirection:'column', gap:'8px'}} onClick={(e) => e.stopPropagation()}>`;
if (c.includes(controlsOld)) c = c.replace(controlsOld, controlsNew);

// Invoice buttons should only open invoice, not detail panel.
c = replaceAll(c, `onClick={() => setInvoiceOrder(order)}><Printer size={14}/> In hóa đơn</button>`, `onClick={(e) => { e.stopPropagation(); setInvoiceOrder(order); }}><Printer size={14}/> In hóa đơn</button>`);
c = replaceAll(c, `onClick={() => setInvoiceOrder(order)}>\n                        <Printer size={16}/> Mở hóa đơn`, `onClick={(e) => { e.stopPropagation(); setInvoiceOrder(order); }}>\n                        <Printer size={16}/> Mở hóa đơn`);

// Replace bottom modal block by finding the invoice modal marker and the closing section after it.
const marker = `      {/* MODAL IN HÓA ĐƠN */}`;
const start = c.indexOf(marker);
if (start === -1) fail('Cannot find modal marker.');
const end = c.indexOf('    </section>', start);
if (end === -1) fail('Cannot find closing </section> after modal marker.');
const newModalBlock = `      {/* MODAL IN HÓA ĐƠN */}\n      {invoiceOrder && (\n        <InvoicePrintModal\n          order={invoiceOrder}\n          shop={shop}\n          onClose={() => setInvoiceOrder(null)}\n          onSave={saveInvoiceData}\n        />\n      )}\n\n      {/* MODAL CHI TIẾT NHẬN / GIAO HÀNG */}\n      {detailOrder && (\n        <OrderFulfillmentPanel\n          order={detailOrder}\n          onClose={() => setDetailOrder(null)}\n        />\n      )}\n`;
c = c.slice(0, start) + newModalBlock + c.slice(end);

fs.writeFileSync(sellerPath, c, 'utf8');
console.log('[OK] Updated SellerDashboard.jsx');
console.log('[OK] Wrote components/OrderFulfillmentPanel.jsx');
console.log('[DONE] Invoice button opens only invoice. Card click opens delivery/pickup detail.');
