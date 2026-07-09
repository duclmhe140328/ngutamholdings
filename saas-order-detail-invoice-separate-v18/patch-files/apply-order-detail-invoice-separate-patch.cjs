const fs = require('fs');
const path = require('path');

const root = process.cwd();
const pagePath = path.join(root, 'frontend', 'src', 'pages', 'SellerDashboard.jsx');
const componentDir = path.join(root, 'frontend', 'src', 'components');
const componentPath = path.join(componentDir, 'OrderFulfillmentPanel.jsx');
const componentSource = path.join(root, 'patch-files', 'OrderFulfillmentPanel.jsx');

function fail(msg) { console.error('[FAIL]', msg); process.exit(1); }
function ok(msg) { console.log('[OK]', msg); }
function backup(file) {
  const dir = path.join(root, 'patch-backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(file, path.join(dir, `${path.basename(file)}.${stamp}.bak`));
}

if (!fs.existsSync(pagePath)) fail(`Cannot find ${pagePath}. Run this from project root.`);
if (!fs.existsSync(componentSource)) fail(`Cannot find ${componentSource}. Zip may be extracted incorrectly.`);
fs.mkdirSync(componentDir, { recursive: true });
backup(pagePath);
fs.copyFileSync(componentSource, componentPath);
ok('Wrote frontend/src/components/OrderFulfillmentPanel.jsx');

let c = fs.readFileSync(pagePath, 'utf8');

// Ensure import exists exactly once
c = c.replace(/import OrderFulfillmentPanel from ['"]\.\.\/components\/OrderFulfillmentPanel\.jsx['"];\r?\n/g, '');
c = c.replace(/(import InvoicePrintModal from ['"]\.\.\/components\/InvoicePrintModal\.jsx['"];\r?\n)/, `$1import OrderFulfillmentPanel from '../components/OrderFulfillmentPanel.jsx';\n`);
if (!c.includes("OrderFulfillmentPanel from '../components/OrderFulfillmentPanel.jsx'")) {
  fail('Could not insert OrderFulfillmentPanel import.');
}

// Ensure fulfillmentOrder state exists
if (!c.includes('const [fulfillmentOrder, setFulfillmentOrder] = useState(null);')) {
  c = c.replace(
    /const \[invoiceOrder, setInvoiceOrder\] = useState\(null\);/,
    `const [invoiceOrder, setInvoiceOrder] = useState(null);\n  const [fulfillmentOrder, setFulfillmentOrder] = useState(null);`
  );
}

// Insert helper function to open fulfillment detail, fetching full order when possible.
if (!c.includes('const openFulfillmentDetail = async (order) => {')) {
  const helper = `\n  const openFulfillmentDetail = async (order) => {\n    if (!order) return;\n    setInvoiceOrder(null);\n    setFulfillmentOrder(order);\n    const id = order._id || order.id;\n    if (!id || order.isDiningSessionInvoice) return;\n    const endpoints = [\`/orders/\${id}\`, \`/orders/my-shop/\${id}\`, \`/orders/detail/\${id}\`];\n    for (const endpoint of endpoints) {\n      try {\n        const res = await api.get(endpoint);\n        const fullOrder = res.data.order || res.data.data || res.data;\n        if (fullOrder && typeof fullOrder === 'object' && (fullOrder._id || fullOrder.id || fullOrder.orderCode)) {\n          setFulfillmentOrder({ ...order, ...fullOrder });\n          return;\n        }\n      } catch { }\n    }\n  };\n`;
  c = c.replace(/\n  const updateInvoiceFilter = \(field, value\) => \{/, `${helper}\n  const updateInvoiceFilter = (field, value) => {`);
}

// Remove old broken double-modal under invoiceOrder
c = c.replace(
  /\{invoiceOrder && \(\s*<>\s*<InvoicePrintModal\s+order=\{invoiceOrder\}\s+shop=\{shop\}\s+onClose=\{\(\) => setInvoiceOrder\(null\)\}\s+onSave=\{saveInvoiceData\}\s*\/?>\s*<OrderFulfillmentPanel\s+order=\{invoiceOrder\}\s*\/?>\s*<\/>
?\s*\)\}/g,
  `{invoiceOrder && (\n        <InvoicePrintModal order={invoiceOrder} shop={shop} onClose={() => setInvoiceOrder(null)} onSave={saveInvoiceData} />\n      )}`
);
// Also handle exact line-by-line variant.
c = c.replace(
  /\{invoiceOrder && \(\s*<>\s*<InvoicePrintModal order=\{invoiceOrder\} shop=\{shop\} onClose=\{\(\) => setInvoiceOrder\(null\)\} onSave=\{saveInvoiceData\} \/>\s*<OrderFulfillmentPanel order=\{invoiceOrder\} \/>\s*<\/>
?\s*\)\}/g,
  `{invoiceOrder && (\n        <InvoicePrintModal order={invoiceOrder} shop={shop} onClose={() => setInvoiceOrder(null)} onSave={saveInvoiceData} />\n      )}`
);
// Remove accidental OrderFulfillmentPanel immediately after InvoicePrintModal without fragment.
c = c.replace(
  /(<InvoicePrintModal order=\{invoiceOrder\} shop=\{shop\} onClose=\{\(\) => setInvoiceOrder\(null\)\} onSave=\{saveInvoiceData\} \/>)[\r\n\s]*<OrderFulfillmentPanel order=\{invoiceOrder\} \/>/g,
  '$1'
);

// Add fulfillment modal render near invoice modal if missing.
if (!c.includes('order={fulfillmentOrder} onClose={() => setFulfillmentOrder(null)}')) {
  c = c.replace(
    /\{invoiceOrder && \(\s*<InvoicePrintModal order=\{invoiceOrder\} shop=\{shop\} onClose=\{\(\) => setInvoiceOrder\(null\)\} onSave=\{saveInvoiceData\} \/>\s*\)\}/,
    `{invoiceOrder && (\n        <InvoicePrintModal order={invoiceOrder} shop={shop} onClose={() => setInvoiceOrder(null)} onSave={saveInvoiceData} />\n      )}\n\n      {fulfillmentOrder && (\n        <OrderFulfillmentPanel order={fulfillmentOrder} onClose={() => setFulfillmentOrder(null)} />\n      )}`
  );
}

// Ensure invoice open buttons stop propagation and do NOT open fulfillment modal.
c = c.replace(
  /onClick=\{\(\) => setInvoiceOrder\(order\)\}/g,
  `onClick={(event) => { event.stopPropagation(); setFulfillmentOrder(null); setInvoiceOrder(order); }}`
);

// Make order ticket cards clickable for fulfillment detail if not already.
c = c.replace(
  /<article key=\{order\._id\} className=\{`fh-ticket \$\{order\.paymentStatus === 'paid' \? 'is-paid' : ''\}`\}>/g,
  `<article key={order._id} className={\`fh-ticket \${order.paymentStatus === 'paid' ? 'is-paid' : ''}\`} onClick={() => openFulfillmentDetail(order)} style={{ cursor: 'pointer' }}>`
);

// Make invoice list cards clickable for fulfillment detail, while button opens invoice only.
c = c.replace(
  /<article key=\{order\._id\} className="fh-card" style=\{\{display:'flex', alignItems:'center', padding:'20px 24px', gap:'24px', flexWrap:'wrap'\}\}>/g,
  `<article key={order._id} className="fh-card" onClick={() => openFulfillmentDetail(order)} style={{display:'flex', alignItems:'center', padding:'20px 24px', gap:'24px', flexWrap:'wrap', cursor:'pointer'}}> `
);

// Prevent selects inside clickable order card from opening fulfillment detail.
c = c.replace(
  /<select style=\{\{padding:'6px 10px', borderRadius:'6px', border:'1px solid #e2e8f0', fontSize:'13px'\}\} value=\{order\.status\}/g,
  `<select onClick={(event) => event.stopPropagation()} style={{padding:'6px 10px', borderRadius:'6px', border:'1px solid #e2e8f0', fontSize:'13px'}} value={order.status}`
);
c = c.replace(
  /<select style=\{\{padding:'6px 10px', borderRadius:'6px', border:'1px solid #e2e8f0', fontSize:'13px', backgroundColor: order\.paymentStatus==='paid'\?'#dcfce7':'#fee2e2'\}\} value=\{order\.paymentStatus\}/g,
  `<select onClick={(event) => event.stopPropagation()} style={{padding:'6px 10px', borderRadius:'6px', border:'1px solid #e2e8f0', fontSize:'13px', backgroundColor: order.paymentStatus==='paid'?'#dcfce7':'#fee2e2'}} value={order.paymentStatus}`
);

fs.writeFileSync(pagePath, c, 'utf8');
ok('Patched SellerDashboard.jsx');
ok('Behavior: click order card = fulfillment/map detail. Click In hoa don/Mo hoa don = invoice only.');
