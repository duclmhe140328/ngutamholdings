const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patchRoot = path.resolve(__dirname);
const srcInvoice = path.join(patchRoot, 'InvoicePrintModal.jsx');
const destInvoice = path.join(root, 'frontend', 'src', 'components', 'InvoicePrintModal.jsx');
const sellerDashboard = path.join(root, 'frontend', 'src', 'pages', 'SellerDashboard.jsx');
const backupDir = path.join(root, 'patch-backups', `invoice-map-v20-${Date.now()}`);

function ensureFile(file) {
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
}
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function backup(file) {
  if (!fs.existsSync(file)) return;
  ensureDir(backupDir);
  fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
}
function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, 'utf8');
}

ensureFile(srcInvoice);
ensureFile(destInvoice);

backup(destInvoice);
fs.copyFileSync(srcInvoice, destInvoice);
console.log('[OK] Replaced frontend/src/components/InvoicePrintModal.jsx');

if (fs.existsSync(sellerDashboard)) {
  backup(sellerDashboard);
  let code = fs.readFileSync(sellerDashboard, 'utf8');
  code = code.replace(/import\s+OrderFulfillmentPanel\s+from\s+['"]\.\.\/components\/OrderFulfillmentPanel\.jsx['"];?\r?\n/g, '');
  code = code.replace(/\r?\n\s*<OrderFulfillmentPanel\s+order=\{invoiceOrder\}\s*\/>/g, '');
  code = code.replace(/onClick=\{\(\) => setInvoiceOrder\(order\)\}/g, 'onClick={(e) => { e.stopPropagation(); setInvoiceOrder(order); }}');
  write(sellerDashboard, code);
  console.log('[OK] Cleaned leftover OrderFulfillmentPanel in SellerDashboard.jsx');
}

console.log('[DONE] Invoice modal now contains checkout delivery/pickup info and pinned map inside one modal.');
console.log(`[BACKUP] ${backupDir}`);
