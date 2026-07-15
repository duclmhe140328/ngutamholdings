const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const patchRoot = path.join(__dirname, 'patch-files');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join(root, 'patch-backups', `seller-pos-bill-v38-${stamp}`);

function file(rel) { return path.join(root, rel); }
function read(rel) {
  if (!fs.existsSync(file(rel))) throw new Error(`Không tìm thấy ${rel}`);
  return fs.readFileSync(file(rel), 'utf8');
}
function backup(rel) {
  const src = file(rel);
  if (!fs.existsSync(src)) return;
  const dst = path.join(backupRoot, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
function write(rel, content) {
  backup(rel);
  fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
  fs.writeFileSync(file(rel), content, 'utf8');
  console.log(`[OK] ${rel}`);
}
function copy(rel) {
  const src = path.join(patchRoot, rel);
  if (!fs.existsSync(src)) throw new Error(`Patch thiếu ${rel}`);
  write(rel, fs.readFileSync(src, 'utf8'));
}
function replaceRegex(text, regex, replacement, label, required = true) {
  if (!regex.test(text)) {
    if (required) throw new Error(`Không tìm thấy vùng sửa: ${label}`);
    console.log(`[SKIP] ${label}`);
    return text;
  }
  return text.replace(regex, replacement);
}
function replaceOnce(text, search, replacement, label, required = true) {
  if (!text.includes(search)) {
    if (required) throw new Error(`Không tìm thấy vị trí sửa: ${label}`);
    console.log(`[SKIP] ${label}`);
    return text;
  }
  return text.replace(search, replacement);
}

const groupedOrdersFunction = fs.readFileSync(path.join(patchRoot, 'fragments/getMyShopOrders.js'), 'utf8') + '\n\n';
const updateStatusFunction = fs.readFileSync(path.join(patchRoot, 'fragments/updateOrderStatus.js'), 'utf8') + '\n\n';
const getMySessionsFunction = fs.readFileSync(path.join(patchRoot, 'fragments/getMySessions.js'), 'utf8') + '\n\n';


function cleanupV37CustomerCheckout() {
  const rel = 'frontend/src/pages/Checkout.jsx';
  let text = read(rel);
  if (!text.includes('FH_V37_TABLE_CART_EDITOR')) return;

  text = text.replace(/,\n  Search,\n  Plus,\n  Minus,\n  Trash2,\n  LockKeyhole,\n  UnlockKeyhole\n} from 'lucide-react';/, "\n} from 'lucide-react';");
  text = text.replace(/\n  \/\/ FH_V37_TABLE_CART_EDITOR[\s\S]*?const \[editProductSearch, setEditProductSearch\] = useState\(''\);/, '');
  text = text.replace(/\n  const persistCart = \(next\) => \{[\s\S]*?\n  \};\n\n  const loadWallet/, '\n\n  const loadWallet');
  text = text.replace(",\n      tableToken ? api.get(`/products/shop/${slug}`) : Promise.resolve({ data: { products: [] } })", '');
  text = text.replace(']).then(([shopRes, tableRes, productRes]) => {', ']).then(([shopRes, tableRes]) => {');
  text = text.replace(/\n      setShopProducts\(productRes\.data\.products \|\| \[\]\);/, '');
  text = text.replace("      const endpoint = table && tableEditToken ? '/orders/table-session/rebuild' : '/orders';\n      const res = await api.post(endpoint, {", "      const res = await api.post('/orders', {");
  text = text.replace(/\n        tableEditUsed: Boolean\(tableEditToken\),\n        tableEditToken,/, '');
  text = text.replace(/\n            \{table && \(\n              <section className="fhc-card fhc-edit-card">[\s\S]*?\n            \)\}\n\n            \{\/\* THẺ 2: THÔNG TIN KHÁCH HÀNG \*\//, '\n            {/* THẺ 2: THÔNG TIN KHÁCH HÀNG */');
  text = text.replace(/\n  \.fhc-edit-help\{[^\n]*/, '');
  text = text.replace(/\n    \.fhc-unlock-row\{[^\n]*/, '');
  write(rel, text);
}

try {
  fs.mkdirSync(backupRoot, { recursive: true });

  copy('backend/services/sellerDiningBillService.js');
  copy('backend/controllers/sellerDiningBillController.js');
  copy('frontend/src/components/DiningBillEditorModal.jsx');
  copy('frontend/src/pages/ProductDetail.jsx');

  // Route seller quản lý hóa đơn bàn.
  {
    const rel = 'backend/routes/diningSessionRoutes.js';
    let text = read(rel);
    if (!text.includes("sellerDiningBillController")) {
      text = text.replace(
        "const controller = require('../controllers/diningSessionController');",
        "const controller = require('../controllers/diningSessionController');\nconst sellerBillController = require('../controllers/sellerDiningBillController');"
      );
    }
    if (!text.includes("/:id/bill-editor")) {
      text = text.replace(
        "router.get('/my-shop', protect, requireSellerOrAdmin, controller.getMySessions);",
        "router.get('/my-shop', protect, requireSellerOrAdmin, controller.getMySessions);\nrouter.get('/:id/bill-editor', protect, requireSellerOrAdmin, sellerBillController.getEditor);\nrouter.post('/:id/bill-preview', protect, requireSellerOrAdmin, sellerBillController.preview);\nrouter.post('/:id/settle-bill', protect, requireSellerOrAdmin, sellerBillController.settle);"
      );
    }
    // Gỡ endpoint v37 cho khách nhập MongoDB ID ở checkout.
    text = text.replace(/\nrouter\.post\('\/public\/:slug\/:tableToken\/unlock-checkout-edit',[^\n]*\);/, '');
    write(rel, text);
  }

  // Không trả phiên bàn 0đ cho seller POS.
  {
    const rel = 'backend/controllers/diningSessionController.js';
    let text = read(rel);
    if (!text.includes('FH_V38_NO_GHOST_TABLES')) {
      text = replaceRegex(
        text,
        /exports\.getMySessions = async \(req, res, next\) => \{[\s\S]*?\n\};\n+(?=exports\.closeSession)/,
        getMySessionsFunction,
        'diningSessionController.getMySessions'
      );
    }
    write(rel, text);
  }

  // Tab Đơn hàng gộp theo phiên + cập nhật trạng thái theo phiên.
  {
    const rel = 'backend/controllers/orderController.js';
    let text = read(rel);
    if (!text.includes('FH_V38_GROUPED_ORDERS')) {
      text = replaceRegex(
        text,
        /exports\.getMyShopOrders = async \(req, res, next\) => \{[\s\S]*?\n\};\n+(?=exports\.updateOrderStatus)/,
        groupedOrdersFunction,
        'orderController.getMyShopOrders'
      );
    }
    if (!text.includes('FH_V38_SESSION_STATUS')) {
      text = replaceRegex(
        text,
        /exports\.updateOrderStatus = async \(req, res, next\) => \{[\s\S]*?\n\};\n+(?=exports\.updatePaymentStatus)/,
        updateStatusFunction,
        'orderController.updateOrderStatus'
      );
    }
    write(rel, text);
  }

  // Gỡ route rebuild checkout công khai của v37 nếu đã cài.
  {
    const rel = 'backend/routes/orderRoutes.js';
    let text = read(rel);
    text = text.replace(/\nrouter\.post\('\/table-session\/rebuild',[^\n]*\);/, '');
    write(rel, text);
  }

  cleanupV37CustomerCheckout();

  // SellerDashboard: modal chỉnh bill nằm đúng POS/seller, không nằm checkout khách.
  {
    const rel = 'frontend/src/pages/SellerDashboard.jsx';
    let text = read(rel);
    if (!text.includes("DiningBillEditorModal")) {
      text = text.replace(
        "import InvoicePrintModal from '../components/InvoicePrintModal.jsx';",
        "import InvoicePrintModal from '../components/InvoicePrintModal.jsx';\nimport DiningBillEditorModal from '../components/DiningBillEditorModal.jsx';"
      );
    }
    if (!text.includes('FH_V38_BILL_EDITOR_STATE')) {
      text = text.replace(
        "  const [posFilters, setPosFilters] = useState({ search: '', status: 'active', paymentStatus: '' });",
        "  const [posFilters, setPosFilters] = useState({ search: '', status: 'active', paymentStatus: '' });\n  // FH_V38_BILL_EDITOR_STATE\n  const [billEditor, setBillEditor] = useState(null);"
      );
    }

    // Luôn xin order thô cho POS; Orders tab vẫn dùng API gộp.
    text = text.replace(
      "api.get('/orders/my-shop', { params: { orderType: 'dine_in', page: 1, limit: 100 } })",
      "api.get('/orders/my-shop', { params: { orderType: 'dine_in', rawDining: 1, page: 1, limit: 100 } })"
    );

    // Thay hàm updateStatus, giữ updatePayment cũ cho đơn giao hàng.
    if (!text.includes('FH_V38_SELLER_GROUPED')) {
    const v38UpdateStatus = `  // FH_V38_SELLER_GROUPED\n  const updateStatus = async (id, status) => {\n    try {\n      const source = orders.find((item) => item._id === id || item.representativeOrderId === id);\n      const apiId = source?.representativeOrderId || id;\n      const res = await api.put(\`/orders/\${apiId}/status\`, { status });\n      if (source?.isDiningSessionInvoice || source?.diningSessionId) {\n        await Promise.all([fetchOrders(orderPage, orderFilters), fetchPosOrders()]);\n      } else {\n        setOrders((current) => mergeById(current, res.data.order));\n      }\n    } catch (err) { showError(err); }\n  };`;
    const oneLineUpdateStatus = `  const updateStatus = async (id, status) => { try { const res = await api.put(\`/orders/\${id}/status\`, { status }); setOrders((current) => mergeById(current, res.data.order)); setPosOrders((current) => mergeById(current, res.data.order)); } catch (err) { showError(err); } };`;
    if (text.includes(oneLineUpdateStatus)) {
      text = text.replace(oneLineUpdateStatus, v38UpdateStatus);
    } else {
      text = replaceRegex(
        text,
        /  (?:\/\/ FH_V37_SELLER_GROUPED\n  )?const updateStatus = async \(id, status\) => \{[\s\S]*?\n  \};(?=\n  const updatePayment)/,
        v38UpdateStatus,
        'SellerDashboard.updateStatus'
      );
    }
    }

    if (!text.includes('const openDiningBillEditor')) {
      text = text.replace(
        "  const updateInvoiceFilter = (field, value) => { setInvoicePage(1); setInvoiceFilters((current) => ({ ...current, [field]: value })); };",
        `  const openDiningBillEditor = (bill, mode = 'pay') => {\n    if (!bill?.sessionId && !bill?.diningSessionId) return setError('Không xác định được phiên bàn');\n    setBillEditor({ sessionId: bill.sessionId || bill.diningSessionId, mode });\n  };\n  const onDiningBillDone = async (result) => {\n    setToast(result?.message || 'Đã cập nhật hóa đơn bàn');\n    if (result?.invoice && result?.action?.includes('close')) setInvoiceOrder(result.invoice);\n    await Promise.all([fetchPosOrders(), fetchOrders(orderPage, orderFilters), fetchInvoiceOrders(1, invoiceFilters)]);\n  };\n  const requestPaymentChange = (order, paymentStatus) => {\n    if ((order?.isDiningSessionInvoice || order?.diningSessionId) && paymentStatus === 'paid') {\n      openDiningBillEditor(order, 'pay');\n      return;\n    }\n    updatePayment(order?.representativeOrderId || order?._id, paymentStatus);\n  };\n  const updateInvoiceFilter = (field, value) => { setInvoicePage(1); setInvoiceFilters((current) => ({ ...current, [field]: value })); };`
      );
    }

    // Realtime: đơn QR mới phải refresh hóa đơn gộp, không chèn raw order vào tab Đơn hàng.
    text = text.replace(
      `    const onNewOrder = ({ order }) => {\n      setOrders((current) => upsertFirst(current, order, 12));\n      if (order.orderType === 'dine_in') { setPosOrders((current) => upsertFirst(current, order, 100)); fetchPosOrders(); }\n      setOrderSummary((current) => ({ ...current, totalOrders: Number(current.totalOrders || 0) + 1, pending: Number(current.pending || 0) + 1, unpaid: Number(current.unpaid || 0) + (order.paymentStatus === 'paid' ? 0 : 1), dineIn: Number(current.dineIn || 0) + (order.orderType === 'dine_in' ? 1 : 0) }));`,
      `    const onNewOrder = ({ order }) => {\n      if (order.orderType === 'dine_in') {\n        fetchPosOrders();\n        fetchOrders(orderPage, orderFilters);\n      } else {\n        setOrders((current) => upsertFirst(current, order, 12));\n        setOrderSummary((current) => ({ ...current, totalOrders: Number(current.totalOrders || 0) + 1, pending: Number(current.pending || 0) + 1, unpaid: Number(current.unpaid || 0) + (order.paymentStatus === 'paid' ? 0 : 1), dineIn: Number(current.dineIn || 0) }));\n      }`
    );
    text = text.replace(
      `    const onOrderUpdated = ({ order }) => {\n      setOrders((current) => mergeById(current, order));\n      setInvoiceOrders((current) => order.paymentStatus === 'paid' ? mergeById(current, order) : current.filter((item) => item._id !== order._id));\n      if (order.orderType === 'dine_in') { setPosOrders((current) => mergeById(current, order)); fetchPosOrders(); }\n    };`,
      `    const onOrderUpdated = ({ order }) => {\n      if (order.orderType === 'dine_in') {\n        fetchPosOrders();\n        fetchOrders(orderPage, orderFilters);\n        fetchInvoiceOrders(1, invoiceFilters);\n      } else {\n        setOrders((current) => mergeById(current, order));\n        setInvoiceOrders((current) => order.paymentStatus === 'paid' ? mergeById(current, order) : current.filter((item) => item._id !== order._id));\n      }\n    };`
    );

    // Không hiển thị bất kỳ thẻ POS 0đ / chưa có order, kể cả backend cũ còn trả về.
    text = text.replace(
      "    return [...sessionRows, ...legacyRows].filter((bill) => {\n      const text =",
      "    return [...sessionRows, ...legacyRows].filter((bill) => {\n      if (Number(bill.orderCount || 0) <= 0 || Number(bill.totalAmount || 0) <= 0) return false;\n      const text ="
    );

    text = text.replace(
      `                    const canClose = Boolean(bill.sessionId) && (bill.orderCount === 0 || bill.paymentStatus === 'paid');`,
      `                    const canClose = Boolean(bill.sessionId) && Number(bill.orderCount || 0) > 0;`
    );

    // Nút POS mở modal seller.
    text = text.replace(
      `<button className="fh-btn-gold" style={{flex: '1 1 100%'}} onClick={() => updatePayment(representative._id,'paid')}>Xác nhận thu tiền</button>`,
      `<><button className="fh-btn-outline" style={{flex: '1 1 calc(50% - 6px)'}} onClick={() => openDiningBillEditor(bill,'pay')}>Sửa hóa đơn / Voucher</button><button className="fh-btn-gold" style={{flex: '1 1 calc(50% - 6px)'}} onClick={() => openDiningBillEditor(bill,'pay')}>Xác nhận thu tiền</button></>`
    );
    text = text.replace(
      `<button className="fh-btn-outline" style={{flex: '1 1 100%', borderColor:'#ef4444', color:'#ef4444'}} onClick={() => closeTableSession(bill.sessionId)}>Đóng bàn / Kết thúc</button>`,
      `<button className="fh-btn-outline" style={{flex: '1 1 100%', borderColor:'#ef4444', color:'#ef4444'}} onClick={() => openDiningBillEditor(bill,'close')}>{bill.paymentStatus === 'paid' ? 'Đóng bàn / Kết thúc' : 'Thanh toán & đóng bàn'}</button>`
    );

    // Orders tab dùng representative order ID và mở modal khi thanh toán dine-in.
    text = text.replace(
      `value={order.status} onChange={(e) => updateStatus(order._id,e.target.value)}`,
      `value={order.status} onChange={(e) => updateStatus(order.representativeOrderId || order._id,e.target.value)}`
    );
    text = text.replace(
      `value={order.paymentStatus} onChange={(e) => updatePayment(order._id,e.target.value)}`,
      `value={order.paymentStatus} onChange={(e) => requestPaymentChange(order,e.target.value)}`
    );

    if (!text.includes('{billEditor && <DiningBillEditorModal')) {
      text = text.replace(
        `      {/* MODAL IN HÓA ĐƠN */}`,
        `      {billEditor && <DiningBillEditorModal sessionId={billEditor.sessionId} mode={billEditor.mode} onClose={() => setBillEditor(null)} onDone={onDiningBillDone} />}\n\n      {/* MODAL IN HÓA ĐƠN */}`
      );
    }
    write(rel, text);
  }

  console.log(`\n[DONE] v38 đã sửa đúng luồng seller POS. Backup: ${backupRoot}`);
  console.log('Kiểm tra backend: node --check backend/controllers/sellerDiningBillController.js');
} catch (error) {
  console.error(`\n[ERROR] ${error.message}`);
  console.error(`[BACKUP] ${backupRoot}`);
  process.exit(1);
}
