const fs = require('fs');
const path = require('path');

const root = process.cwd();
const backupDir = path.join(root, 'patch-backups', `customer-latlng-v22-${Date.now()}`);

function fail(msg) {
  console.error('[ERROR]', msg);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`Missing file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, path.relative(root, file));
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, fs.readFileSync(file));
  fs.writeFileSync(file, content, 'utf8');
  console.log('[OK] Updated', path.relative(root, file));
}

function replaceOnce(content, search, replacement, label) {
  if (content.includes(replacement)) {
    console.log(`[SKIP] ${label} already patched`);
    return content;
  }
  if (!content.includes(search)) {
    console.log(`[WARN] Pattern not found for ${label}`);
    return content;
  }
  return content.replace(search, replacement);
}

function regexReplaceOnce(content, regex, replacement, label) {
  if (regex.test(content)) {
    return content.replace(regex, replacement);
  }
  console.log(`[WARN] Regex pattern not found for ${label}`);
  return content;
}

const invoiceFile = path.join(root, 'frontend', 'src', 'components', 'InvoicePrintModal.jsx');
let invoice = read(invoiceFile);

// The order is saved with customerLatitude/customerLongitude, so the invoice map finder must read those exact names.
invoice = replaceOnce(
  invoice,
  "const lat = num(obj.lat ?? obj.latitude ?? obj.Latitude ?? obj.LAT ?? obj.y);",
  "const lat = num(obj.customerLatitude ?? obj.deliveryLatitude ?? obj.shippingLatitude ?? obj.lat ?? obj.latitude ?? obj.Latitude ?? obj.LAT ?? obj.y);",
  'InvoicePrintModal lat aliases'
);
invoice = replaceOnce(
  invoice,
  "const lng = num(obj.lng ?? obj.lon ?? obj.long ?? obj.longitude ?? obj.Longitude ?? obj.LNG ?? obj.x);",
  "const lng = num(obj.customerLongitude ?? obj.deliveryLongitude ?? obj.shippingLongitude ?? obj.lng ?? obj.lon ?? obj.long ?? obj.longitude ?? obj.Longitude ?? obj.LNG ?? obj.x);",
  'InvoicePrintModal lng aliases'
);

// If the exact one-line code was reformatted, patch more broadly.
if (!invoice.includes('obj.customerLatitude') && invoice.includes('function getDirectLatLng')) {
  invoice = regexReplaceOnce(
    invoice,
    /const lat = num\(([^;\n]*obj\.lat[^;\n]*obj\.y)\);/,
    "const lat = num(obj.customerLatitude ?? obj.deliveryLatitude ?? obj.shippingLatitude ?? $1);",
    'InvoicePrintModal lat aliases fallback'
  );
}
if (!invoice.includes('obj.customerLongitude') && invoice.includes('function getDirectLatLng')) {
  invoice = regexReplaceOnce(
    invoice,
    /const lng = num\(([^;\n]*obj\.lng[^;\n]*obj\.x)\);/,
    "const lng = num(obj.customerLongitude ?? obj.deliveryLongitude ?? obj.shippingLongitude ?? $1);",
    'InvoicePrintModal lng aliases fallback'
  );
}

write(invoiceFile, invoice);

const fulfillmentFile = path.join(root, 'frontend', 'src', 'components', 'OrderFulfillmentPanel.jsx');
if (fs.existsSync(fulfillmentFile)) {
  let fulfillment = read(fulfillmentFile);
  fulfillment = replaceOnce(
    fulfillment,
    "const lat = pick(order, ['deliveryLocation.lat', 'deliveryLocation.latitude', 'shippingLocation.lat', 'shippingLocation.latitude', 'location.lat', 'location.latitude', 'coordinates.lat', 'latitude', 'lat']);",
    "const lat = pick(order, ['customerLatitude', 'deliveryLatitude', 'shippingLatitude', 'deliveryLocation.lat', 'deliveryLocation.latitude', 'shippingLocation.lat', 'shippingLocation.latitude', 'location.lat', 'location.latitude', 'coordinates.lat', 'latitude', 'lat']);",
    'OrderFulfillmentPanel lat aliases'
  );
  fulfillment = replaceOnce(
    fulfillment,
    "const lng = pick(order, ['deliveryLocation.lng', 'deliveryLocation.longitude', 'shippingLocation.lng', 'shippingLocation.longitude', 'location.lng', 'location.longitude', 'coordinates.lng', 'longitude', 'lng']);",
    "const lng = pick(order, ['customerLongitude', 'deliveryLongitude', 'shippingLongitude', 'deliveryLocation.lng', 'deliveryLocation.longitude', 'shippingLocation.lng', 'shippingLocation.longitude', 'location.lng', 'location.longitude', 'coordinates.lng', 'longitude', 'lng']);",
    'OrderFulfillmentPanel lng aliases'
  );
  write(fulfillmentFile, fulfillment);
} else {
  console.log('[INFO] OrderFulfillmentPanel.jsx not found; skipped.');
}

console.log('[DONE] Invoice/detail map now reads saved order.customerLatitude + order.customerLongitude.');
console.log('[BACKUP]', backupDir);
