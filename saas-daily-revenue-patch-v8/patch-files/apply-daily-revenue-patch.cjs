/* SaaS Daily Revenue Patch v8 - no PowerShell code generation */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(root, 'patch-backups', 'daily-revenue-v8-' + stamp);

function log(msg) { console.log('[daily-revenue-v8] ' + msg); }
function fail(msg) { console.error('\n[daily-revenue-v8][ERROR] ' + msg); process.exit(1); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function exists(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, c) { ensureDir(path.dirname(p)); fs.writeFileSync(p, c, 'utf8'); }
function backup(p) {
  if (!exists(p)) return;
  ensureDir(backupDir);
  const rel = path.relative(root, p).replace(/[\\/]/g, '__');
  fs.copyFileSync(p, path.join(backupDir, rel));
}

function findServerFile() {
  const candidates = [
    'server.js',
    'index.js',
    'app.js',
    'backend/server.js',
    'backend/index.js',
    'server/server.js',
    'server/index.js',
    'src/server.js',
    'src/index.js'
  ].map(x => path.join(root, x));
  for (const p of candidates) {
    if (exists(p)) {
      const c = read(p);
      if (/express\s*\(/.test(c) || /require\(['"]express['"]\)/.test(c) || /from ['"]express['"]/.test(c)) return p;
    }
  }
  if (exists(path.join(root, 'server.js'))) return path.join(root, 'server.js');
  return null;
}

const serverFile = findServerFile();
if (!serverFile) fail('Cannot find backend entry file. Expected server.js in project root.');
log('Backend file: ' + path.relative(root, serverFile));

const routesDir = path.join(root, 'routes');
const servicesDir = path.join(root, 'services');
const publicDir = exists(path.join(root, 'public')) ? path.join(root, 'public') : root;
ensureDir(routesDir);
ensureDir(servicesDir);
ensureDir(publicDir);

const serviceFile = path.join(servicesDir, 'dailyRevenueService.js');
const routeFile = path.join(routesDir, 'revenueRoutes.js');
const adminFile = path.join(publicDir, 'admin-revenue.html');
backup(serverFile);
backup(serviceFile);
backup(routeFile);
backup(adminFile);

const serviceCode = `const mongoose = require('mongoose');

function pad(n) { return String(n).padStart(2, '0'); }
function toDateOnly(d) {
  const dt = new Date(d);
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}
function startOfDay(input) {
  const d = input ? new Date(input + 'T00:00:00.000+07:00') : new Date();
  return d;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function getNumber(obj, keys) {
  for (const k of keys) {
    const v = k.split('.').reduce((a, key) => (a && a[key] !== undefined ? a[key] : undefined), obj);
    const num = Number(v);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
}
function isCancelled(order) {
  const s = String(order.status || order.orderStatus || order.paymentStatus || '').toLowerCase();
  return ['cancel', 'cancelled', 'canceled', 'huy', 'hủy', 'da huy', 'đã hủy', 'failed'].some(x => s.includes(x));
}
function isPaidOnline(order) {
  const p = String(order.paymentMethod || order.method || '').toLowerCase();
  const ps = String(order.paymentStatus || '').toLowerCase();
  return p.includes('vnpay') || p.includes('momo') || p.includes('bank') || p.includes('online') || ps.includes('paid') || ps.includes('success');
}
function matchShop(order, shopId) {
  if (!shopId || shopId === 'global' || shopId === 'all') return true;
  const ids = [
    order.shopId, order.storeId, order.tenantId,
    order.shop && order.shop._id, order.store && order.store._id,
    order.shop, order.store, order.tenant
  ].filter(Boolean).map(String);
  return ids.includes(String(shopId));
}
async function getOrderModel() {
  const names = mongoose.modelNames();
  for (const n of ['Order', 'Orders', 'order', 'orders']) {
    if (names.includes(n)) return mongoose.model(n);
  }
  const schema = new mongoose.Schema({}, { strict: false, collection: process.env.ORDER_COLLECTION || 'orders' });
  return mongoose.models.DailyRevenueOrder || mongoose.model('DailyRevenueOrder', schema);
}
async function getDailyRevenue({ from, to, shopId }) {
  const Order = await getOrderModel();
  const fromDate = startOfDay(from || toDateOnly(new Date()));
  const toDate = addDays(startOfDay(to || from || toDateOnly(new Date())), 1);
  const query = {
    $or: [
      { createdAt: { $gte: fromDate, $lt: toDate } },
      { created_at: { $gte: fromDate, $lt: toDate } },
      { date: { $gte: fromDate, $lt: toDate } }
    ]
  };
  const orders = await Order.find(query).lean();
  const map = new Map();
  for (const order of orders) {
    if (!matchShop(order, shopId)) continue;
    const created = order.createdAt || order.created_at || order.date || order.updatedAt || new Date();
    const day = toDateOnly(created);
    if (!map.has(day)) {
      map.set(day, { date: day, revenue: 0, orders: 0, codRevenue: 0, onlineRevenue: 0, cancelledOrders: 0, averageOrderValue: 0 });
    }
    const row = map.get(day);
    const amount = getNumber(order, ['totalAmount', 'total', 'amount', 'grandTotal', 'finalTotal', 'totalPrice']);
    row.orders += 1;
    if (isCancelled(order)) {
      row.cancelledOrders += 1;
      continue;
    }
    row.revenue += amount;
    if (isPaidOnline(order)) row.onlineRevenue += amount;
    else row.codRevenue += amount;
  }
  const days = [];
  for (let d = new Date(fromDate); d < toDate; d = addDays(d, 1)) {
    const key = toDateOnly(d);
    const row = map.get(key) || { date: key, revenue: 0, orders: 0, codRevenue: 0, onlineRevenue: 0, cancelledOrders: 0, averageOrderValue: 0 };
    row.averageOrderValue = row.orders ? Math.round(row.revenue / row.orders) : 0;
    days.push(row);
  }
  const summary = days.reduce((a, r) => {
    a.revenue += r.revenue;
    a.orders += r.orders;
    a.codRevenue += r.codRevenue;
    a.onlineRevenue += r.onlineRevenue;
    a.cancelledOrders += r.cancelledOrders;
    return a;
  }, { revenue: 0, orders: 0, codRevenue: 0, onlineRevenue: 0, cancelledOrders: 0, averageOrderValue: 0 });
  summary.averageOrderValue = summary.orders ? Math.round(summary.revenue / summary.orders) : 0;
  return { ok: true, shopId: shopId || 'global', from: toDateOnly(fromDate), to: toDateOnly(addDays(toDate, -1)), summary, days };
}
module.exports = { getDailyRevenue };
`;

const routeCode = `const express = require('express');
const router = express.Router();
const { getDailyRevenue } = require('../services/dailyRevenueService');

router.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Revenue API is working', route: '/api/revenue' });
});

router.get('/daily', async (req, res) => {
  try {
    const data = await getDailyRevenue({
      from: req.query.from,
      to: req.query.to,
      shopId: req.query.shopId || 'global'
    });
    res.json(data);
  } catch (error) {
    console.error('[revenue daily error]', error);
    res.status(500).json({ ok: false, message: error.message || 'Revenue API error' });
  }
});

router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = await getDailyRevenue({ from: today, to: today, shopId: req.query.shopId || 'global' });
    res.json(data);
  } catch (error) {
    console.error('[revenue today error]', error);
    res.status(500).json({ ok: false, message: error.message || 'Revenue API error' });
  }
});

module.exports = router;
`;

const adminHtml = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Doanh thu theo ngay</title>
  <style>
    *{box-sizing:border-box} body{margin:0;font-family:Arial,sans-serif;background:#101522;color:#f8fafc} .wrap{max-width:1180px;margin:auto;padding:24px} h1{margin:0 0 16px;font-size:30px} .panel{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:18px;margin-bottom:16px;box-shadow:0 20px 60px rgba(0,0,0,.25)} .filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px} label{font-size:13px;color:#cbd5e1} input{width:100%;margin-top:6px;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#0f172a;color:#fff} button{border:0;border-radius:12px;padding:12px 16px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;font-weight:700;cursor:pointer;margin-top:21px}.cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.card{background:linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px}.k{color:#94a3b8;font-size:13px}.v{font-size:22px;font-weight:800;margin-top:8px} table{width:100%;border-collapse:collapse;overflow:hidden;border-radius:14px} th,td{padding:12px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left} th{color:#cbd5e1;background:rgba(255,255,255,.06)} .err{color:#fecaca;background:#7f1d1d;border-radius:12px;padding:12px;display:none;margin-top:12px}.ok{color:#bbf7d0}.bar{height:10px;background:#334155;border-radius:99px;overflow:hidden}.bar span{display:block;height:100%;background:linear-gradient(90deg,#f59e0b,#ef4444);width:0}@media(max-width:900px){.filters,.cards{grid-template-columns:1fr 1fr}}@media(max-width:560px){.filters,.cards{grid-template-columns:1fr}.wrap{padding:14px}}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>📊 Doanh thu theo ngay</h1>
    <div class="panel">
      <div class="filters">
        <div><label>Tu ngay<input id="from" type="date"></label></div>
        <div><label>Den ngay<input id="to" type="date"></label></div>
        <div><label>Shop ID<input id="shopId" value="global" placeholder="global hoac shopId"></label></div>
        <div><button onclick="loadRevenue()">Xem doanh thu</button></div>
      </div>
      <div id="err" class="err"></div>
    </div>
    <div class="cards" id="cards"></div>
    <div class="panel">
      <table>
        <thead><tr><th>Ngay</th><th>Doanh thu</th><th>Don</th><th>TB/don</th><th>COD</th><th>Online</th><th>Huy</th><th>Bieu do</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </div>
<script>
const money = n => Number(n||0).toLocaleString('vi-VN') + ' đ';
const today = new Date();
const first = new Date(today.getFullYear(), today.getMonth(), 1);
const fmt = d => d.toISOString().slice(0,10);
document.getElementById('from').value = fmt(first);
document.getElementById('to').value = fmt(today);
async function loadRevenue(){
  const err = document.getElementById('err'); err.style.display='none'; err.textContent='';
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const shopId = document.getElementById('shopId').value || 'global';
  try{
    const res = await fetch('/api/revenue/daily?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to)+'&shopId='+encodeURIComponent(shopId));
    if(res.status===404) throw new Error('Khong tim thay API /api/revenue. Backend chua mount route hoac chua restart.');
    const data = await res.json();
    if(!res.ok || data.ok===false) throw new Error(data.message || 'Revenue API error');
    render(data);
  }catch(e){err.textContent='Loi: '+e.message; err.style.display='block';}
}
function render(data){
  const s = data.summary || {};
  document.getElementById('cards').innerHTML = [
    ['Tong doanh thu', money(s.revenue)], ['Tong don', s.orders||0], ['TB/don', money(s.averageOrderValue)], ['COD', money(s.codRevenue)], ['Online', money(s.onlineRevenue)]
  ].map(x=>'<div class="card"><div class="k">'+x[0]+'</div><div class="v">'+x[1]+'</div></div>').join('');
  const max = Math.max(...(data.days||[]).map(x=>x.revenue||0),1);
  document.getElementById('rows').innerHTML = (data.days||[]).map(r=>'<tr><td>'+r.date+'</td><td><b>'+money(r.revenue)+'</b></td><td>'+r.orders+'</td><td>'+money(r.averageOrderValue)+'</td><td>'+money(r.codRevenue)+'</td><td>'+money(r.onlineRevenue)+'</td><td>'+r.cancelledOrders+'</td><td><div class="bar"><span style="width:'+Math.round((r.revenue||0)*100/max)+'%"></span></div></td></tr>').join('');
}
loadRevenue();
</script>
</body>
</html>
`;

write(serviceFile, serviceCode);
write(routeFile, routeCode);
write(adminFile, adminHtml);
log('Wrote routes/revenueRoutes.js');
log('Wrote services/dailyRevenueService.js');
log('Wrote ' + path.relative(root, adminFile));

let server = read(serverFile);
const relRouteRequire = './routes/revenueRoutes';
if (!server.includes("revenueRoutes") && !server.includes("/api/revenue")) {
  const requireLine = "const revenueRoutes = require('./routes/revenueRoutes');";
  const lastRequire = [...server.matchAll(/^const\s+.+?=\s+require\(.+?\);\s*$/gm)].pop();
  if (lastRequire) {
    const pos = lastRequire.index + lastRequire[0].length;
    server = server.slice(0, pos) + "\n" + requireLine + server.slice(pos);
  } else {
    server = requireLine + "\n" + server;
  }
}

const mountLine = "app.use('/api/revenue', revenueRoutes);";
if (!server.includes("/api/revenue")) {
  const api404Patterns = [
    /app\.use\(\s*['"]\/api['"]\s*,/,
    /app\.all\(\s*['"]\/api\*/,
    /app\.use\(\s*['"]\*['"]\s*,/,
    /app\.get\(\s*['"]\*['"]\s*,/
  ];
  let inserted = false;
  for (const pat of api404Patterns) {
    const m = server.match(pat);
    if (m && m.index >= 0) {
      server = server.slice(0, m.index) + mountLine + "\n" + server.slice(m.index);
      inserted = true;
      log('Mounted revenue route before fallback/404 handler.');
      break;
    }
  }
  if (!inserted) {
    const expressStatic = server.match(/app\.use\(\s*express\.static/);
    if (expressStatic && expressStatic.index >= 0) {
      server = server.slice(0, expressStatic.index) + mountLine + "\n" + server.slice(expressStatic.index);
      inserted = true;
      log('Mounted revenue route before static handler.');
    }
  }
  if (!inserted) {
    const listen = server.match(/app\.listen\s*\(/);
    if (listen && listen.index >= 0) {
      server = server.slice(0, listen.index) + mountLine + "\n" + server.slice(listen.index);
      log('Mounted revenue route before app.listen.');
    } else {
      server += "\n" + mountLine + "\n";
      log('Mounted revenue route at end of server file.');
    }
  }
}

write(serverFile, server);
log('Patched ' + path.relative(root, serverFile));
log('Backup folder: ' + path.relative(root, backupDir));
log('DONE. Restart backend on port 5000, then open: http://localhost:5000/api/revenue/health');
