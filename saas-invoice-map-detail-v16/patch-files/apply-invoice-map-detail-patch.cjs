const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patchDir = __dirname;

function log(msg) { console.log(`[invoice-v16] ${msg}`); }
function fail(msg) { console.error(`[invoice-v16] ERROR: ${msg}`); process.exit(1); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, content) { fs.writeFileSync(file, content, 'utf8'); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function exists(file) { return fs.existsSync(file); }

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git', 'patch-files', 'patch-backups'].includes(item.name)) continue;
      walk(full, out);
    } else if (/\.(jsx|tsx|js)$/.test(item.name)) {
      out.push(full);
    }
  }
  return out;
}

function findSellerDashboard() {
  const preferred = [
    path.join(root, 'frontend', 'src', 'pages', 'SellerDashboard.jsx'),
    path.join(root, 'frontend', 'src', 'pages', 'SellerDashboard.js'),
    path.join(root, 'frontend', 'src', 'views', 'SellerDashboard.jsx'),
    path.join(root, 'src', 'pages', 'SellerDashboard.jsx')
  ];
  for (const file of preferred) if (exists(file)) return file;
  return walk(root).find((file) => {
    const content = read(file);
    return content.includes('SellerDashboard') && content.includes('InvoicePrintModal') && content.includes('setInvoiceOrder');
  });
}

const sellerFile = findSellerDashboard();
if (!sellerFile) fail('Cannot find SellerDashboard file. Send me the path of SellerDashboard.jsx.');
log(`SellerDashboard: ${path.relative(root, sellerFile)}`);

const sellerDir = path.dirname(sellerFile);
let componentsDir = path.resolve(sellerDir, '../components');
if (!exists(componentsDir)) componentsDir = path.join(root, 'frontend', 'src', 'components');
ensureDir(componentsDir);
const componentTarget = path.join(componentsDir, 'OrderFulfillmentPanel.jsx');
fs.copyFileSync(path.join(patchDir, 'OrderFulfillmentPanel.jsx'), componentTarget);
log(`Wrote ${path.relative(root, componentTarget)}`);

let content = read(sellerFile);
const backupDir = path.join(root, 'patch-backups');
ensureDir(backupDir);
const backupFile = path.join(backupDir, `SellerDashboard.invoice-v16.${Date.now()}.bak`);
write(backupFile, content);
log(`Backup: ${path.relative(root, backupFile)}`);

if (!content.includes('OrderFulfillmentPanel')) {
  const importLine = "import OrderFulfillmentPanel from '../components/OrderFulfillmentPanel.jsx';";
  if (content.includes("import InvoicePrintModal from '../components/InvoicePrintModal.jsx';")) {
    content = content.replace("import InvoicePrintModal from '../components/InvoicePrintModal.jsx';", "import InvoicePrintModal from '../components/InvoicePrintModal.jsx';\n" + importLine);
  } else {
    const lastImportMatch = [...content.matchAll(/^import .*?;$/gm)].pop();
    if (lastImportMatch) {
      const idx = lastImportMatch.index + lastImportMatch[0].length;
      content = content.slice(0, idx) + '\n' + importLine + content.slice(idx);
    } else {
      content = importLine + '\n' + content;
    }
  }
  log('Added OrderFulfillmentPanel import');
}

if (!content.includes('const openInvoiceOrder = async')) {
  const helper = `
  const openInvoiceOrder = async (order) => {
    if (!order) return;
    setInvoiceOrder(order);
    if (!order._id || order.isDiningSessionInvoice) return;

    const endpoints = [
      \`/orders/\${order._id}\`,
      \`/orders/my-shop/\${order._id}\`,
      \`/orders/detail/\${order._id}\`
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await api.get(endpoint);
        const fullOrder = res.data?.order || res.data?.data || res.data;
        if (fullOrder && (fullOrder._id || fullOrder.orderCode)) {
          setInvoiceOrder({ ...order, ...fullOrder });
          return;
        }
      } catch (error) {
        // Some projects do not expose all detail endpoints. Keep current order data.
      }
    }
  };
`;
  const marker = '\n  const markCustomerRead = async';
  if (content.includes(marker)) {
    content = content.replace(marker, helper + marker);
    log('Added openInvoiceOrder helper before markCustomerRead');
  } else {
    const marker2 = '\n  const submitProduct = async';
    if (content.includes(marker2)) {
      content = content.replace(marker2, helper + marker2);
      log('Added openInvoiceOrder helper before submitProduct');
    } else {
      fail('Cannot insert openInvoiceOrder helper automatically.');
    }
  }
}

content = content.replace(/onClick=\{\(\) => setInvoiceOrder\((?!null)([^)]+)\)\}/g, 'onClick={() => openInvoiceOrder($1)}');

if (content.includes('<InvoicePrintModal order={invoiceOrder} shop={shop} onClose={() => setInvoiceOrder(null)} onSave={saveInvoiceData} />') && !content.includes('<OrderFulfillmentPanel order={invoiceOrder} />')) {
  content = content.replace(
    '<InvoicePrintModal order={invoiceOrder} shop={shop} onClose={() => setInvoiceOrder(null)} onSave={saveInvoiceData} />',
    '<InvoicePrintModal order={invoiceOrder} shop={shop} onClose={() => setInvoiceOrder(null)} onSave={saveInvoiceData} />\n          <OrderFulfillmentPanel order={invoiceOrder} />'
  );
  log('Attached fulfillment panel next to invoice modal');
} else if (!content.includes('<OrderFulfillmentPanel order={invoiceOrder} />')) {
  const modalRegex = /(<InvoicePrintModal[^>]*order=\{invoiceOrder\}[^>]*\/>)/;
  if (modalRegex.test(content)) {
    content = content.replace(modalRegex, '$1\n          <OrderFulfillmentPanel order={invoiceOrder} />');
    log('Attached fulfillment panel by regex');
  } else {
    log('WARNING: Could not locate InvoicePrintModal render. Component was created, but panel not attached.');
  }
}

write(sellerFile, content);
log('DONE. Restart frontend. If order has address/location fields, seller will see map/details when opening invoice.');
