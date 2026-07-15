const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const patchRoot = path.join(__dirname, 'patch-files');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join(root, 'patch-backups', `storefront-session-v37-${stamp}`);

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(`Không tìm thấy ${rel}`);
  return fs.readFileSync(file, 'utf8');
}

function backup(rel) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) return;
  const dst = path.join(backupRoot, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function write(rel, content) {
  const file = path.join(root, rel);
  backup(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  console.log(`[OK] ${rel}`);
}

function copy(rel) {
  const src = path.join(patchRoot, rel);
  if (!fs.existsSync(src)) throw new Error(`Patch thiếu ${rel}`);
  write(rel, fs.readFileSync(src, 'utf8'));
}

function replaceOnce(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`Không tìm thấy vị trí sửa: ${label}`);
  return text.replace(search, replacement);
}

function replaceRegex(text, regex, replacement, label) {
  if (!regex.test(text)) throw new Error(`Không tìm thấy vùng sửa: ${label}`);
  return text.replace(regex, replacement);
}

try {
  fs.mkdirSync(backupRoot, { recursive: true });

  // 1) Trang chi tiết sản phẩm được thay toàn bộ để giao diện gọn và ảnh luôn contain.
  copy('frontend/src/pages/ProductDetail.jsx');
  copy('backend/services/tableCheckoutEditService.js');

  // 2) Storefront: banner đủ tỉ lệ, không lặp tên, SĐT + bản đồ và ảnh sản phẩm contain.
  {
    let text = read('frontend/src/pages/ShopPage.jsx');
    if (!text.includes('FH_V37_STOREFRONT')) {
      text = replaceOnce(
        text,
        `  const productPath = (id) => {\n    if (customDomainMode) return tableToken ? \`/table/\${tableToken}/product/\${id}\` : \`/product/\${id}\`;\n    return tableToken ? \`/shop/\${slug}/table/\${tableToken}/product/\${id}\` : \`/shop/\${slug}/product/\${id}\`;\n  };`,
        `  const productPath = (id) => {\n    if (customDomainMode) return tableToken ? \`/table/\${tableToken}/product/\${id}\` : \`/product/\${id}\`;\n    return tableToken ? \`/shop/\${slug}/table/\${tableToken}/product/\${id}\` : \`/shop/\${slug}/product/\${id}\`;\n  };\n\n  // FH_V37_STOREFRONT: mở đúng địa chỉ cửa hàng bằng tọa độ hoặc địa chỉ đã lưu.\n  const hasShopPoint = shop?.storeLatitude !== '' && shop?.storeLatitude != null\n    && shop?.storeLongitude !== '' && shop?.storeLongitude != null\n    && Number.isFinite(Number(shop.storeLatitude)) && Number.isFinite(Number(shop.storeLongitude));\n  const shopMapQuery = hasShopPoint\n    ? \`\${shop.storeLatitude},\${shop.storeLongitude}\`\n    : String(shop?.storeMapLabel || shop?.address || '').trim();\n  const shopMapUrl = shopMapQuery\n    ? \`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(shopMapQuery)}\`\n    : '';\n  const shopAddressLabel = String(shop?.storeMapLabel || shop?.address || 'Xem vị trí cửa hàng').trim();`,
        'ShopPage productPath'
      );

      text = replaceOnce(
        text,
        `<span><b>{shop.name}</b><small>{shop.businessType === 'restaurant' ? 'Nhà hàng & giao món' : 'Cửa hàng trực tuyến'}</small></span>`,
        `<span><b>Cửa hàng chính thức</b><small>{shop.phone || (shop.businessType === 'restaurant' ? 'Nhà hàng & giao món' : 'Cửa hàng trực tuyến')}</small></span>`,
        'xóa tên shop lặp ở header'
      );

      text = replaceOnce(
        text,
        `{backgrounds.map((image, index) => <div key={\`${'${image}-${index}'}\`} className={index === bgIndex ? 'active' : ''} style={{ backgroundImage: \`url(${'${image}'})\` }} />)}`,
        `{backgrounds.map((image, index) => <div key={\`${'${image}-${index}'}\`} className={index === bgIndex ? 'active' : ''} style={{ '--food-slide-image': \`url(\${JSON.stringify(image)})\` }} />)}`,
        'banner slide contain'
      );

      text = replaceOnce(
        text,
        `<div className="food-store-meta">\n                <span><b>★ {shop.rating || 4.8}</b><small>Đánh giá</small></span>\n                <span><b>{shop.deliveryTime || '25–40 phút'}</b><small>Chuẩn bị</small></span>\n                <span><b>{Number(shop.deliveryFee || 0) ? money(shop.deliveryFee) : 'Miễn phí'}</b><small>Phí giao</small></span>\n                <span><b>{products.length}</b><small>Lựa chọn</small></span>\n              </div>`,
        `<div className="food-store-meta">\n                <span><b>★ {shop.rating || 4.8}</b><small>Đánh giá</small></span>\n                <span><b>{shop.deliveryTime || '25–40 phút'}</b><small>Chuẩn bị</small></span>\n                {shop.phone ? <a href={\`tel:\${shop.phone}\`}><b>{shop.phone}</b><small>Số điện thoại</small></a> : <span><b>Đang cập nhật</b><small>Số điện thoại</small></span>}\n                {shopMapUrl ? <a href={shopMapUrl} target="_blank" rel="noreferrer" title={shopAddressLabel}><b>{shopAddressLabel}</b><small>Địa chỉ · Mở bản đồ</small></a> : <span><b>{shopAddressLabel}</b><small>Địa chỉ cửa hàng</small></span>}\n              </div>`,
        '4 thông tin hero'
      );
      write('frontend/src/pages/ShopPage.jsx', text);
    } else {
      console.log('[SKIP] ShopPage đã có v37');
    }

    let css = read('frontend/src/styles.css');
    if (!css.includes('FH_V37_STOREFRONT_STYLE')) {
      css += `\n\n/* FH_V37_STOREFRONT_STYLE: ảnh không crop, banner giữ đủ tỉ lệ */\n.food-store-slides>div{background-image:none!important;overflow:hidden;transform:none!important}\n.food-store-slides>div::before{content:"";position:absolute;inset:-34px;background-image:var(--food-slide-image);background-position:center;background-size:cover;filter:blur(25px);opacity:.48;transform:scale(1.1)}\n.food-store-slides>div::after{content:"";position:absolute;inset:0;background-image:var(--food-slide-image);background-position:center;background-size:contain;background-repeat:no-repeat}\n.food-store-slides>span{z-index:2;pointer-events:none}\n.food-store-hero-content{position:relative;z-index:3}\n.food-store-meta>a{min-width:102px;max-width:230px;padding:10px 13px;border-radius:11px;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(8px);color:#fff;text-decoration:none;overflow:hidden}\n.food-store-meta>a b,.food-store-meta>a small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.food-store-meta>a b{font-size:13px}.food-store-meta>a small{margin-top:3px;color:rgba(255,255,255,.7);font-size:9px}\n.food-store-meta>a:hover{background:rgba(255,255,255,.2);transform:translateY(-1px)}\n.food-product-image{background:linear-gradient(145deg,#faf8f4,#eee9e1)}\n.food-product-image img{object-fit:contain!important;object-position:center!important;padding:6px;transform:none!important}\n.food-product-card:hover .food-product-image img{transform:none!important}\n.food-cart-line img{object-fit:contain!important;object-position:center!important;background:#f5f2ed;padding:3px}\n.food-store-logo img,.food-store-identity>img{object-fit:contain!important;background:#fff}\n@media(max-width:680px){.food-store-slides>div::before{inset:-20px;filter:blur(18px)}.food-product-image img{padding:4px}.food-store-meta>a{min-width:0;max-width:none;padding:9px}}\n`;
      write('frontend/src/styles.css', css);
    }
  }

  // 3) Endpoint xác nhận đúng MongoDB shop ID, trả token chỉnh giỏ trong 15 phút.
  {
    let text = read('backend/controllers/diningSessionController.js');
    if (!text.includes('unlockCheckoutEdit')) {
      text = replaceOnce(
        text,
        `const { rewardDiningSessionCoins } = require('../services/loyaltyService');`,
        `const { rewardDiningSessionCoins } = require('../services/loyaltyService');\nconst { createTableCheckoutEditToken } = require('../services/tableCheckoutEditService');`,
        'import tableCheckoutEditService'
      );
      text = replaceOnce(
        text,
        `exports.getMySessions = async (req, res, next) => {`,
        `exports.unlockCheckoutEdit = async (req, res, next) => {\n  try {\n    const { slug, tableToken } = req.params;\n    const submittedShopId = String(req.body.shopId || '').trim();\n    if (!/^[a-f\\d]{24}$/i.test(submittedShopId)) {\n      return res.status(403).json({ message: 'Mã ID cửa hàng không chính xác' });\n    }\n\n    const shop = await Shop.findOne({ slug, isActive: true });\n    if (!shop || !isApproved(shop)) return res.status(404).json({ message: 'Cửa hàng chưa khả dụng' });\n    if (String(shop._id) !== submittedShopId) {\n      return res.status(403).json({ message: 'Mã ID cửa hàng không chính xác' });\n    }\n\n    const table = await DiningTable.findOne({ shopId: shop._id, qrToken: tableToken, isActive: true });\n    if (!table) return res.status(404).json({ message: 'QR bàn không hợp lệ hoặc bàn đã bị khóa' });\n    const { session } = await findOrCreateOpenDiningSession({ shop, table });\n    const token = createTableCheckoutEditToken({ shopId: shop._id, tableId: table._id, diningSessionId: session._id });\n    const currentBill = await buildCurrentBill(session);\n    return res.json({ token, currentBill, expiresIn: 900, message: 'Đã mở quyền thêm, sửa, xóa món tại bước thanh toán trong 15 phút' });\n  } catch (error) {\n    return next(error);\n  }\n};\n\nexports.getMySessions = async (req, res, next) => {`,
        'thêm unlockCheckoutEdit'
      );
      write('backend/controllers/diningSessionController.js', text);
    }

    text = read('backend/routes/diningSessionRoutes.js');
    if (!text.includes('unlock-checkout-edit')) {
      text = replaceOnce(
        text,
        `router.post('/public/:slug/:tableToken/open', controller.openOrResume);`,
        `router.post('/public/:slug/:tableToken/open', controller.openOrResume);\nrouter.post('/public/:slug/:tableToken/unlock-checkout-edit', controller.unlockCheckoutEdit);`,
        'route unlock checkout'
      );
      write('backend/routes/diningSessionRoutes.js', text);
    }

    text = read('backend/routes/orderRoutes.js');
    if (!text.includes('table-session/rebuild')) {
      text = replaceOnce(
        text,
        `router.post('/', orderController.createOrder);`,
        `router.post('/', orderController.createOrder);
router.post('/table-session/rebuild', orderController.rebuildDiningSessionBill);`,
        'route rebuild dining bill'
      );
      write('backend/routes/orderRoutes.js', text);
    }
  }

  // 4) Backend: mỗi phiên bàn hiển thị thành một hóa đơn tổng trong tab Đơn hàng.
  {
    let text = read('backend/services/diningSessionService.js');
    if (!text.includes('orderCount: bill.orderCount')) {
      text = replaceOnce(
        text,
        `    finalizedAt: session.finalizedAt,\n    orders: bill.orders`,
        `    finalizedAt: session.finalizedAt,\n    orderCount: bill.orderCount,\n    invoiceStatus: representative.invoiceStatus || 'not_issued',\n    invoiceNumber: representative.invoiceNumber || '',\n    orders: bill.orders`,
        'session invoice orderCount'
      );
      write('backend/services/diningSessionService.js', text);
    }

    text = read('backend/controllers/orderController.js');
    if (!text.includes('verifyTableCheckoutEditToken')) {
      text = replaceOnce(
        text,
        `  buildCurrentBill\n} = require('../services/diningSessionService');`,
        `  buildCurrentBill,\n  buildSessionInvoice\n} = require('../services/diningSessionService');\nconst { verifyTableCheckoutEditToken } = require('../services/tableCheckoutEditService');`,
        'order imports'
      );
      text = replaceOnce(
        text,
        `      guestId, guestSessionToken, diningSessionId\n    } = req.body;`,
        `      guestId, guestSessionToken, diningSessionId, tableEditToken, tableEditUsed\n    } = req.body;`,
        'order destructure table edit'
      );
      text = replaceOnce(
        text,
        `      if (diningSessionId && String(diningSessionId) !== String(diningSession._id)) {\n        return res.status(409).json({ message: 'Phiên bàn trên thiết bị đã cũ. Vui lòng tải lại QR bàn.' });\n      }\n\n      guestSession = await resolveGuestFromToken`,
        `      if (diningSessionId && String(diningSessionId) !== String(diningSession._id)) {\n        return res.status(409).json({ message: 'Phiên bàn trên thiết bị đã cũ. Vui lòng tải lại QR bàn.' });\n      }\n      if (tableEditUsed) {\n        const editPayload = verifyTableCheckoutEditToken(tableEditToken);\n        const validEditToken = editPayload\n          && String(editPayload.shopId) === String(shop._id)\n          && String(editPayload.tableId) === String(table._id)\n          && String(editPayload.diningSessionId) === String(diningSession._id);\n        if (!validEditToken) return res.status(403).json({ message: 'Quyền sửa món đã hết hạn. Hãy nhập lại mã ID cửa hàng.' });\n      }\n\n      guestSession = await resolveGuestFromToken`,
        'validate edit token'
      );
    }

    if (!text.includes('exports.rebuildDiningSessionBill')) {
      const fragment = fs.readFileSync(path.join(patchRoot, 'backend/rebuildDiningSessionBill.fragment.js'), 'utf8');
      text = replaceOnce(
        text,
        `exports.getMyShopOrders = async (req, res, next) => {`,
        `${fragment}exports.getMyShopOrders = async (req, res, next) => {`,
        'rebuild dining bill controller'
      );
    }

    const groupedFunction = `exports.getMyShopOrders = async (req, res, next) => {\n  try {\n    const shop = await Shop.findOne({ ownerId: req.user._id });\n    if (!shop) return res.status(400).json({ message: 'Bạn chưa tạo cửa hàng' });\n\n    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 100 });\n\n    // POS và màn in hóa đơn vẫn có thể xin các lượt gọi món thô để vận hành bếp.\n    if (String(req.query.rawDining || '') === '1') {\n      const query = { shopId: shop._id };\n      const search = String(req.query.search || '').trim();\n      if (search) {\n        const regex = new RegExp(escapeRegex(search), 'i');\n        query.$or = [{ orderCode: regex }, { customerName: regex }, { phone: regex }, { address: regex }];\n      }\n      if (req.query.status) query.status = req.query.status;\n      if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;\n      if (req.query.orderType) query.orderType = req.query.orderType;\n      if (req.query.paymentMethod) query.paymentMethod = req.query.paymentMethod;\n      if (req.query.invoiceStatus) query.invoiceStatus = req.query.invoiceStatus === 'not_issued' ? { $in: ['not_issued', null] } : req.query.invoiceStatus;\n      Object.assign(query, parseDateRange(req.query));\n      const [orders, total] = await Promise.all([\n        Order.find(query).populate('tableId').populate('diningSessionId').sort({ createdAt: -1 }).skip(skip).limit(limit),\n        Order.countDocuments(query)\n      ]);\n      return res.json({ shop, orders, summary: null, pagination: buildPagination({ page, limit, total }) });\n    }\n\n    const [regularOrders, sessions] = await Promise.all([\n      Order.find({ shopId: shop._id, orderType: { $ne: 'dine_in' } }).populate('tableId').sort({ createdAt: -1 }),\n      DiningSession.find({ shopId: shop._id }).populate('tableId').sort({ openedAt: -1 })\n    ]);\n    const sessionInvoices = (await Promise.all(sessions.map((session) => buildSessionInvoice(session))))\n      .filter((item) => Number(item.orderCount || 0) > 0);\n    const allRows = [...sessionInvoices, ...regularOrders.map((item) => item.toObject())];\n\n    const summary = allRows.reduce((acc, item) => {\n      acc.totalOrders += 1;\n      if (item.paymentStatus === 'paid') acc.revenue += Number(item.totalAmount || 0);\n      if (['pending', 'confirmed', 'preparing', 'ready', 'serving', 'shipping'].includes(item.status)) acc.pending += 1;\n      if (item.paymentStatus !== 'paid' && item.status !== 'cancelled') acc.unpaid += 1;\n      if (item.orderType === 'dine_in') acc.dineIn += 1;\n      return acc;\n    }, { totalOrders: 0, revenue: 0, pending: 0, unpaid: 0, dineIn: 0 });\n\n    const search = String(req.query.search || '').trim().toLowerCase();\n    const from = req.query.dateFrom ? new Date(\`${'${req.query.dateFrom}'}T00:00:00\`) : null;\n    const to = req.query.dateTo ? new Date(\`${'${req.query.dateTo}'}T23:59:59.999\`) : null;\n    const filtered = allRows.filter((item) => {\n      const text = [item.orderCode, item.customerName, item.phone, item.address, ...(item.customerNames || []), ...(item.products || []).map((p) => p.name)].join(' ').toLowerCase();\n      const date = new Date(item.createdAt || item.openedAt || 0);\n      return (!search || text.includes(search))\n        && (!req.query.status || item.status === req.query.status)\n        && (!req.query.paymentStatus || item.paymentStatus === req.query.paymentStatus)\n        && (!req.query.orderType || item.orderType === req.query.orderType)\n        && (!req.query.paymentMethod || item.paymentMethod === req.query.paymentMethod)\n        && (!req.query.invoiceStatus || (item.invoiceStatus || 'not_issued') === req.query.invoiceStatus)\n        && (!from || date >= from)\n        && (!to || date <= to);\n    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));\n\n    const total = filtered.length;\n    const orders = filtered.slice(skip, skip + limit);\n    return res.json({ shop, orders, summary, pagination: buildPagination({ page, limit, total }) });\n  } catch (error) {\n    return next(error);\n  }\n};\n\n`;

    text = replaceRegex(
      text,
      /exports\.getMyShopOrders = async \(req, res, next\) => \{[\s\S]*?\n\};\n\n(?=exports\.updateOrderStatus)/,
      groupedFunction,
      'getMyShopOrders grouped'
    );

    if (!text.includes('FH_V37_SESSION_STATUS')) {
      text = replaceOnce(
        text,
        `    order.status = req.body.status;\n    await order.save();\n    if (req.body.status === 'cancelled' && order.paymentStatus !== 'paid') await releaseOrderBenefits(order, shop, 'Hoàn ưu đãi do đơn bị hủy');`,
        `    // FH_V37_SESSION_STATUS: đổi trạng thái một hóa đơn tổng sẽ áp dụng cho toàn bộ lượt gọi trong phiên.\n    if (order.diningSessionId) {\n      const sessionOrders = await Order.find({ diningSessionId: order.diningSessionId, status: { $ne: 'cancelled' } });\n      for (const item of sessionOrders) {\n        item.status = req.body.status;\n        await item.save();\n        if (req.body.status === 'cancelled' && item.paymentStatus !== 'paid') {\n          await releaseOrderBenefits(item, shop, 'Hoàn ưu đãi do hóa đơn bàn bị hủy');\n        }\n      }\n      order.status = req.body.status;\n    } else {\n      order.status = req.body.status;\n      await order.save();\n      if (req.body.status === 'cancelled' && order.paymentStatus !== 'paid') await releaseOrderBenefits(order, shop, 'Hoàn ưu đãi do đơn bị hủy');\n    }`,
        'update session status'
      );
    }
    write('backend/controllers/orderController.js', text);
  }

  // 5) Checkout: nhập Mongo ID để mở thêm/sửa/xóa món trước khi gửi; coupon giữ nguyên.
  {
    let text = read('frontend/src/pages/Checkout.jsx');
    if (!text.includes('FH_V37_TABLE_CART_EDITOR')) {
      text = replaceOnce(
        text,
        `  Award\n} from 'lucide-react';`,
        `  Award,\n  Search,\n  Plus,\n  Minus,\n  Trash2,\n  LockKeyhole,\n  UnlockKeyhole\n} from 'lucide-react';`,
        'Checkout lucide imports'
      );
      text = replaceOnce(
        text,
        `  const [cart, setCart] = useState([]);`,
        `  const [cart, setCart] = useState([]);\n  // FH_V37_TABLE_CART_EDITOR\n  const [shopProducts, setShopProducts] = useState([]);\n  const [shopIdUnlock, setShopIdUnlock] = useState('');\n  const [tableEditToken, setTableEditToken] = useState('');\n  const [editUnlocking, setEditUnlocking] = useState(false);\n  const [editProductSearch, setEditProductSearch] = useState('');`,
        'Checkout editor states'
      );
      text = replaceOnce(
        text,
        `      api.get(\`/shops/\${slug}\`),\n      tableToken ? api.get(\`/tables/public/\${slug}/\${tableToken}\`) : Promise.resolve({ data: { table: null } })\n    ]).then(([shopRes, tableRes]) => {`,
        `      api.get(\`/shops/\${slug}\`),\n      tableToken ? api.get(\`/tables/public/\${slug}/\${tableToken}\`) : Promise.resolve({ data: { table: null } }),\n      tableToken ? api.get(\`/products/shop/\${slug}\`) : Promise.resolve({ data: { products: [] } })\n    ]).then(([shopRes, tableRes, productRes]) => {`,
        'Checkout load products'
      );
      text = replaceOnce(
        text,
        `      setTable(currentTable);\n      setVnpayConfigured`,
        `      setTable(currentTable);\n      setShopProducts(productRes.data.products || []);\n      setVnpayConfigured`,
        'set shop products'
      );
      text = replaceOnce(
        text,
        `  const storePath = tableToken\n    ? (customDomainMode ? \`/table/\${tableToken}\` : \`/shop/\${slug}/table/\${tableToken}\`)\n    : (customDomainMode ? '/' : \`/shop/\${slug}\`);`,
        `  const storePath = tableToken\n    ? (customDomainMode ? \`/table/\${tableToken}\` : \`/shop/\${slug}/table/\${tableToken}\`)\n    : (customDomainMode ? '/' : \`/shop/\${slug}\`);\n\n  const persistCart = (next) => {\n    setCart(next);\n    localStorage.setItem(cartKey(slug, tableToken), JSON.stringify(next));\n  };\n  const changeCheckoutQty = (productId, quantity) => {\n    const next = cart\n      .map((item) => item.productId === productId ? { ...item, quantity: Math.max(0, Number(quantity || 0)) } : item)\n      .filter((item) => item.quantity > 0);\n    persistCart(next);\n  };\n  const addCheckoutProduct = (product) => {\n    const price = Number(product.salePrice > 0 ? product.salePrice : product.price);\n    const found = cart.find((item) => item.productId === product._id);\n    persistCart(found\n      ? cart.map((item) => item.productId === product._id ? { ...item, quantity: Number(item.quantity || 0) + 1 } : item)\n      : [...cart, { productId: product._id, name: product.name, image: product.images?.[0] || '', price, quantity: 1 }]);\n  };\n  const filteredEditProducts = shopProducts.filter((product) => {\n    const query = editProductSearch.trim().toLowerCase();\n    return product.isActive !== false && (!query || \`\${product.name} \${product.category || ''}\`.toLowerCase().includes(query));\n  }).slice(0, 8);\n  const unlockTableEditor = async () => {\n    if (!shopIdUnlock.trim()) return setError('Hãy nhập mã ID cửa hàng trong MongoDB');\n    setEditUnlocking(true);\n    setError('');\n    try {\n      const res = await api.post(\`/dining-sessions/public/\${slug}/\${tableToken}/unlock-checkout-edit\`, { shopId: shopIdUnlock.trim() });\n      setTableEditToken(res.data.token);\n      const combined = new Map();\n      [...(res.data.currentBill?.products || diningContext?.currentBill?.products || []), ...cart].forEach((item) => {\n        const productId = String(item.productId || item._id || '');\n        if (!productId) return;\n        const current = combined.get(productId);\n        combined.set(productId, current\n          ? { ...current, quantity: Number(current.quantity || 0) + Number(item.quantity || 0) }\n          : { productId, name: item.name, image: item.image || '', price: Number(item.price || 0), quantity: Number(item.quantity || 0) });\n      });\n      persistCart([...combined.values()].filter((item) => item.quantity > 0));\n    } catch (err) { setError(err.message); } finally { setEditUnlocking(false); }\n  };`,
        'Checkout editor helpers'
      );
      text = replaceOnce(
        text,
        `  }, [shop?._id, form.orderType, form.customerLatitude, form.customerLongitude, form.coinsToUse, cart.length]);`,
        `  }, [shop?._id, form.orderType, form.customerLatitude, form.customerLongitude, form.coinsToUse, form.couponCode, cart.map((item) => \`\${item.productId}:\${item.quantity}\`).join('|')]);`,
        'quote dependency cart quantities'
      );
      text = replaceOnce(
        text,
        `      const res = await api.post('/orders', {\n        shopSlug: slug,`,
        `      const endpoint = table && tableEditToken ? '/orders/table-session/rebuild' : '/orders';\n      const res = await api.post(endpoint, {\n        shopSlug: slug,`,
        'submit rebuild endpoint'
      );
      text = replaceOnce(
        text,
        `        loyaltyToken: identity?.token,\n        items: cart.map`,
        `        loyaltyToken: identity?.token,\n        tableEditUsed: Boolean(tableEditToken),\n        tableEditToken,\n        items: cart.map`,
        'submit edit token'
      );
      text = replaceOnce(
        text,
        `            {/* THẺ 2: THÔNG TIN KHÁCH HÀNG */}`,
        `            {table && (\n              <section className="fhc-card fhc-edit-card">\n                <div className="fhc-card-title">{tableEditToken ? <UnlockKeyhole size={20} /> : <LockKeyhole size={20} />} Sửa món trước khi gửi</div>\n                {!tableEditToken ? (\n                  <>\n                    <p className="fhc-edit-help">Nhập đúng <b>MongoDB _id của cửa hàng</b> để mở quyền thêm, đổi số lượng hoặc xóa món ngay tại bước thanh toán.</p>\n                    <div className="fhc-unlock-row"><input value={shopIdUnlock} onChange={(event) => setShopIdUnlock(event.target.value)} placeholder="Ví dụ: 665f... (24 ký tự)" /><button type="button" onClick={unlockTableEditor} disabled={editUnlocking}>{editUnlocking ? 'Đang kiểm tra...' : 'Mở quyền sửa'}</button></div>\n                  </>\n                ) : (\n                  <>\n                    <div className="fhc-edit-ok"><CheckCircle2 size={16} /> Đã mở quyền sửa trong 15 phút. Các món đã gọi trong phiên và món mới sẽ được gộp thành một hóa đơn tổng trước khi thanh toán.</div>\n                    <div className="fhc-edit-lines">\n                      {cart.map((item) => <article key={item.productId}><img src={item.image || 'https://placehold.co/100'} alt="" /><div><b>{item.name}</b><small>{money(item.price)}</small></div><div className="fhc-edit-qty"><button type="button" onClick={() => changeCheckoutQty(item.productId,item.quantity-1)}><Minus size={15}/></button><span>{item.quantity}</span><button type="button" onClick={() => changeCheckoutQty(item.productId,item.quantity+1)}><Plus size={15}/></button></div><button type="button" className="remove" onClick={() => changeCheckoutQty(item.productId,0)} title="Xóa món"><Trash2 size={17}/></button></article>)}\n                    </div>\n                    <div className="fhc-product-search"><Search size={16}/><input value={editProductSearch} onChange={(event) => setEditProductSearch(event.target.value)} placeholder="Tìm món để thêm..." /></div>\n                    <div className="fhc-edit-products">{filteredEditProducts.map((product) => <button type="button" key={product._id} onClick={() => addCheckoutProduct(product)}><img src={product.images?.[0] || 'https://placehold.co/100'} alt=""/><span><b>{product.name}</b><small>{money(product.salePrice > 0 ? product.salePrice : product.price)}</small></span><Plus size={17}/></button>)}</div>\n                  </>\n                )}\n              </section>\n            )}\n\n            {/* THẺ 2: THÔNG TIN KHÁCH HÀNG */}`,
        'Checkout editor UI'
      );
      text = replaceOnce(
        text,
        `  .fhc-summary-item img { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; background: #f1f5f9; border: 1px solid #e2e8f0;}`,
        `  .fhc-summary-item img { width: 56px; height: 56px; border-radius: 10px; object-fit: contain; padding:3px; background: #f1f5f9; border: 1px solid #e2e8f0;}\n  .fhc-edit-help{margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.55}.fhc-unlock-row{display:grid;grid-template-columns:1fr auto;gap:10px}.fhc-unlock-row input,.fhc-product-search input{min-width:0;border:1px solid #dbe2ea;border-radius:11px;padding:12px 13px;outline:0}.fhc-unlock-row button{border:0;border-radius:11px;padding:0 16px;background:#172f29;color:#fff;font-weight:800}.fhc-edit-ok{display:flex;align-items:center;gap:7px;margin-bottom:12px;padding:10px 12px;border-radius:11px;background:#e8f7ef;color:#216b4b;font-size:12px;font-weight:800}.fhc-edit-lines{display:flex;flex-direction:column;gap:8px}.fhc-edit-lines article{display:grid;grid-template-columns:46px minmax(0,1fr) auto 36px;align-items:center;gap:9px;padding:9px;border:1px solid #e8edf1;border-radius:12px;background:#fff}.fhc-edit-lines img,.fhc-edit-products img{width:46px;height:46px;object-fit:contain;padding:2px;border-radius:9px;background:#f5f3ef}.fhc-edit-lines b,.fhc-edit-lines small{display:block}.fhc-edit-lines b{font-size:12px}.fhc-edit-lines small{margin-top:3px;color:#9b6a28;font-size:10px}.fhc-edit-qty{display:grid;grid-template-columns:30px 28px 30px;align-items:center;text-align:center}.fhc-edit-qty button,.fhc-edit-lines .remove{height:30px;display:grid;place-items:center;border:1px solid #dfe5ea;border-radius:8px;background:#fff}.fhc-edit-lines .remove{color:#b44239}.fhc-product-search{display:flex;align-items:center;gap:8px;margin:14px 0 8px}.fhc-product-search input{flex:1}.fhc-edit-products{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fhc-edit-products>button{display:grid;grid-template-columns:46px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px;border:1px solid #e5e9ed;border-radius:11px;background:#fafbfb;text-align:left}.fhc-edit-products span b,.fhc-edit-products span small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fhc-edit-products span b{font-size:11px}.fhc-edit-products span small{margin-top:3px;color:#9b6a28;font-size:10px}`,
        'Checkout editor CSS'
      );
      text = replaceOnce(
        text,
        `    .fhc-chip-grid { grid-template-columns: 1fr; }`,
        `    .fhc-chip-grid { grid-template-columns: 1fr; }\n    .fhc-unlock-row{grid-template-columns:1fr}.fhc-unlock-row button{min-height:44px}.fhc-edit-products{grid-template-columns:1fr}.fhc-edit-lines article{grid-template-columns:42px minmax(0,1fr) auto 34px}`,
        'Checkout editor mobile CSS'
      );
      write('frontend/src/pages/Checkout.jsx', text);
    } else {
      console.log('[SKIP] Checkout đã có v37');
    }
  }

  // 6) Seller dashboard dùng dữ liệu thô riêng cho POS/invoice, còn tab Orders dùng hóa đơn gộp.
  {
    let text = read('frontend/src/pages/SellerDashboard.jsx');
    if (text.includes('FH_V37_SELLER_GROUPED')) {
      console.log('[SKIP] SellerDashboard đã có v37');
    } else {
    if (!text.includes('rawDining: 1')) {
      text = replaceOnce(
        text,
        `api.get('/orders/my-shop', { params: { paymentStatus: 'paid', page: 1, limit: 200 } })`,
        `api.get('/orders/my-shop', { params: { paymentStatus: 'paid', rawDining: 1, page: 1, limit: 200 } })`,
        'invoice rawDining'
      );
      text = replaceOnce(
        text,
        `api.get('/orders/my-shop', { params: { orderType: 'dine_in', page: 1, limit: 100 } })`,
        `api.get('/orders/my-shop', { params: { orderType: 'dine_in', rawDining: 1, page: 1, limit: 100 } })`,
        'POS rawDining'
      );
    }
    text = replaceOnce(
      text,
      `  const updateStatus = async (id, status) => { try { const res = await api.put(\`/orders/\${id}/status\`, { status }); setOrders((current) => mergeById(current, res.data.order)); setPosOrders((current) => mergeById(current, res.data.order)); } catch (err) { showError(err); } };`,
      `  // FH_V37_SELLER_GROUPED\n  const updateStatus = async (id, status) => {\n    try {\n      const source = orders.find((item) => item._id === id);\n      const res = await api.put(\`/orders/\${id}/status\`, { status });\n      if (source?.isDiningSessionInvoice) await fetchOrders(orderPage, orderFilters);\n      else setOrders((current) => mergeById(current, res.data.order));\n      setPosOrders((current) => mergeById(current, res.data.order));\n    } catch (err) { showError(err); }\n  };`,
      'Seller updateStatus grouped'
    );
    text = replaceOnce(
      text,
      `    try {\n      let loyaltyPhone = '';`,
      `    try {\n      const source = [...orders, ...posOrders].find((item) => item._id === id);\n      let loyaltyPhone = '';`,
      'Seller payment source'
    );
    text = replaceOnce(
      text,
      `        const source = [...orders, ...posOrders].find((item) => item._id === id);\n        const suggested = source?.loyaltyPhone || source?.phone || '';`,
      `        const suggested = source?.loyaltyPhone || source?.phone || '';`,
      'remove duplicate source'
    );
    text = replaceOnce(
      text,
      `      setOrders((current) => affected.reduce((list, item) => mergeById(list, item), current));`,
      `      if (source?.isDiningSessionInvoice) await fetchOrders(orderPage, orderFilters);\n      else setOrders((current) => affected.reduce((list, item) => mergeById(list, item), current));`,
      'refresh grouped orders after payment'
    );
    text = replaceOnce(
      text,
      `<p style={{margin:0, fontSize:'13px', color:'#64748b'}}>{orderTypeLabels[order.orderType]} · {order.phone || 'Không SĐT'} · {new Date(order.createdAt).toLocaleString('vi-VN')} · {new Date(order.paidAt).toLocaleString('vi-VN')}</p>`,
      `<p style={{margin:0, fontSize:'13px', color:'#64748b'}}>{order.isDiningSessionInvoice ? \`Hóa đơn tổng · \${order.orderCount || order.orders?.length || 0} lượt gọi\` : orderTypeLabels[order.orderType]} · {order.phone || 'Không SĐT'} · {formatDateTime(order.createdAt)}{order.paidAt ? \` · Thanh toán \${formatDateTime(order.paidAt)}\` : ''}</p>`,
      'Orders merged label/date'
    );
    write('frontend/src/pages/SellerDashboard.jsx', text);
    }
  }

  console.log(`\n[DONE] Cài xong v37. Backup: ${backupRoot}`);
  console.log('Chạy kiểm tra: node --check backend/controllers/orderController.js');
} catch (error) {
  console.error(`\n[ERROR] ${error.message}`);
  console.error(`[BACKUP] ${backupRoot}`);
  process.exit(1);
}
