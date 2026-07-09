const fs = require('fs');
const path = require('path');

const root = process.cwd();
const target = path.join(root, 'frontend', 'src', 'pages', 'SellerDashboard.jsx');

if (!fs.existsSync(target)) {
  throw new Error(`Cannot find ${target}. Run this installer from the project root.`);
}

let src = fs.readFileSync(target, 'utf8');

const backupDir = path.join(root, 'patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(path.join(backupDir, `SellerDashboard.before-revenue-v25.${stamp}.jsx`), src);

function insertAfter(needle, addition, label) {
  if (src.includes(addition.trim().split('\n')[0])) return;
  const index = src.indexOf(needle);
  if (index === -1) throw new Error(`Missing anchor: ${label}`);
  src = src.slice(0, index + needle.length) + addition + src.slice(index + needle.length);
}

function insertBefore(needle, addition, label) {
  if (src.includes(addition.trim().split('\n')[0])) return;
  const index = src.indexOf(needle);
  if (index === -1) throw new Error(`Missing anchor: ${label}`);
  src = src.slice(0, index) + addition + src.slice(index);
}

// 1) State for the new revenue tab.
insertAfter(
  `  const [invoiceOrder, setInvoiceOrder] = useState(null);`,
  `
  const [revenueReportOrders, setRevenueReportOrders] = useState([]);
  const [revenueOrders, setRevenueOrders] = useState([]);
  const [revenuePagination, setRevenuePagination] = useState(emptyPagination);
  const [revenuePage, setRevenuePage] = useState(1);
  const [revenueFilters, setRevenueFilters] = useState({ search: '', status: '', paymentStatus: '', orderType: '', dateFrom: '', dateTo: '' });
  const [revenueLoading, setRevenueLoading] = useState(false);`,
  'invoice state'
);

// 2) Fetcher for revenue report. Uses existing /orders/my-shop API so backend does not need changes.
insertBefore(
  `  const fetchPosOrders = async () => {`,
  `  const fetchRevenueReport = async (page = revenuePage, filters = revenueFilters) => {
    setRevenueLoading(true);
    try {
      const res = await api.get('/orders/my-shop', { params: toParams(filters, 1, 1000) });
      const query = String(filters.search || '').trim().toLowerCase();
      const from = filters.dateFrom ? new Date(String(filters.dateFrom) + 'T00:00:00') : null;
      const to = filters.dateTo ? new Date(String(filters.dateTo) + 'T23:59:59.999') : null;

      const all = (res.data.orders || [])
        .filter((order) => {
          const text = [order.orderCode, order.customerName, order.phone, order.tableNumber].filter(Boolean).join(' ').toLowerCase();
          const date = new Date(order.paidAt || order.createdAt || 0);
          return (!query || text.includes(query))
            && (!filters.status || order.status === filters.status)
            && (!filters.paymentStatus || order.paymentStatus === filters.paymentStatus)
            && (!filters.orderType || order.orderType === filters.orderType)
            && (!from || date >= from)
            && (!to || date <= to);
        })
        .sort((a, b) => new Date(b.paidAt || b.createdAt || 0) - new Date(a.paidAt || a.createdAt || 0));

      const limit = 15;
      const total = all.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(Math.max(1, Number(page || 1)), totalPages);
      setRevenueReportOrders(all);
      setRevenueOrders(all.slice((safePage - 1) * limit, safePage * limit));
      setRevenuePagination({ page: safePage, limit, total, totalPages, hasNext: safePage < totalPages, hasPrev: safePage > 1 });
    } catch (err) { showError(err); } finally { setRevenueLoading(false); }
  };

`,
  'fetchPosOrders anchor'
);

// 3) Load tab on first boot.
if (!src.includes('fetchRevenueReport(1, revenueFilters)')) {
  src = src.replace(
    `Promise.all([loadShop(), fetchOrders(1, orderFilters), fetchInvoiceOrders(1, invoiceFilters), fetchProducts(1, productFilters), fetchCustomerChats(1), fetchAdminChat()])`,
    `Promise.all([loadShop(), fetchOrders(1, orderFilters), fetchInvoiceOrders(1, invoiceFilters), fetchRevenueReport(1, revenueFilters), fetchProducts(1, productFilters), fetchCustomerChats(1), fetchAdminChat()])`
  );
}

// 4) Refresh report when filters/page change.
insertAfter(
  `  useEffect(() => {
    const timer = window.setTimeout(() => fetchInvoiceOrders(invoicePage, invoiceFilters), 280);
    return () => window.clearTimeout(timer);
  }, [invoicePage, JSON.stringify(invoiceFilters)]);`,
  `

  useEffect(() => {
    const timer = window.setTimeout(() => fetchRevenueReport(revenuePage, revenueFilters), 280);
    return () => window.clearTimeout(timer);
  }, [revenuePage, JSON.stringify(revenueFilters)]);`,
  'invoice useEffect'
);

// 5) Keep realtime report fresh.
if (!src.includes('setRevenueReportOrders((current) => upsertFirst(current, order, 1000));')) {
  src = src.replace(
    `      setOrders((current) => upsertFirst(current, order, 12));`,
    `      setOrders((current) => upsertFirst(current, order, 12));
      setRevenueReportOrders((current) => upsertFirst(current, order, 1000));`
  );
}
if (!src.includes('setRevenueReportOrders((current) => mergeById(current, order));')) {
  src = src.replace(
    `      setOrders((current) => mergeById(current, order));`,
    `      setOrders((current) => mergeById(current, order));
      setRevenueReportOrders((current) => mergeById(current, order));`
  );
}

// 6) Filters and dashboard tab switch.
insertAfter(
  `  const updateOrderFilter = (field, value) => { setOrderPage(1); setOrderFilters((current) => ({ ...current, [field]: value })); };`,
  `
  const updateRevenueFilter = (field, value) => { setRevenuePage(1); setRevenueFilters((current) => ({ ...current, [field]: value })); };`,
  'updateOrderFilter'
);
if (!src.includes("if (value === 'revenue') fetchRevenueReport(1, revenueFilters);")) {
  src = src.replace(
    `    if (value === 'pos') fetchPosOrders();`,
    `    if (value === 'pos') fetchPosOrders();
    if (value === 'revenue') fetchRevenueReport(1, revenueFilters);`
  );
}

// 7) Revenue summary derived from the fetched orders.
insertAfter(
  `  const tablePagination = { page: safeTablePage, limit: tableLimit, total: filteredTables.length, totalPages: tableTotalPages, hasNext: safeTablePage < tableTotalPages, hasPrev: safeTablePage > 1 };`,
  `
  const revenueReport = useMemo(() => {
    const isCancelled = (order) => ['cancelled', 'canceled', 'cancel', 'huy', 'hủy'].includes(String(order.status || '').toLowerCase());
    const isPaid = (order) => String(order.paymentStatus || '').toLowerCase() === 'paid';
    const isCompleted = (order) => String(order.status || '').toLowerCase() === 'completed';
    const active = revenueReportOrders.filter((order) => !isCancelled(order));
    const completed = active.filter((order) => isCompleted(order) && isPaid(order));
    const outstanding = active.filter((order) => !(isCompleted(order) && isPaid(order)));
    const unpaid = active.filter((order) => !isPaid(order));
    const paidWaiting = active.filter((order) => isPaid(order) && !isCompleted(order));
    const sum = (list) => list.reduce((total, order) => total + Number(order.totalAmount || 0), 0);
    return {
      totalCount: active.length,
      completedCount: completed.length,
      completedRevenue: sum(completed),
      outstandingCount: outstanding.length,
      outstandingValue: sum(outstanding),
      unpaidCount: unpaid.length,
      paidWaitingCount: paidWaiting.length,
      cancelledCount: revenueReportOrders.length - active.length
    };
  }, [revenueReportOrders]);`,
  'tablePagination'
);

// 8) Navigation item.
if (!src.includes("['revenue', <Receipt size={20}/>, 'Doanh thu']")) {
  src = src.replace(
    `    ['invoices', <Receipt size={20}/>, 'In hóa đơn'], `,
    `    ['invoices', <Receipt size={20}/>, 'In hóa đơn'], 
    ['revenue', <Receipt size={20}/>, 'Doanh thu'], `
  );
}

// 9) CSS for the tab.
insertAfter(
  `        .fh-empty p { font-size: 14px; color: var(--fh-text-light); margin: 0; }`,
  `

        .fh-revenue-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
        .fh-revenue-card { background: #fff; border: 1px solid var(--fh-border); border-radius: 16px; padding: 18px; box-shadow: 0 2px 4px rgba(0,0,0,.02); }
        .fh-revenue-card span { display: block; color: var(--fh-text-light); font-size: 13px; font-weight: 700; margin-bottom: 8px; }
        .fh-revenue-card b { display: block; color: var(--fh-sidebar); font-size: 24px; line-height: 1; margin-bottom: 8px; }
        .fh-revenue-card small { color: #94a3b8; font-size: 12px; }
        .fh-revenue-card.success { border-top: 4px solid var(--fh-green); }
        .fh-revenue-card.warning { border-top: 4px solid var(--fh-gold); }
        .fh-revenue-card.danger { border-top: 4px solid var(--fh-red); }
        .fh-revenue-card.info { border-top: 4px solid #2563eb; }
        .fh-revenue-table-card { overflow-x: auto; }
        .fh-revenue-table { min-width: 900px; }
        .fh-revenue-row { display: grid; grid-template-columns: 1.2fr 1.3fr .85fr .85fr .9fr .75fr; gap: 14px; align-items: center; padding: 14px 18px; border-top: 1px solid var(--fh-border); }
        .fh-revenue-head { background: #f8fafc; color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; border-top: 0; }
        .fh-revenue-row strong, .fh-revenue-row b { color: var(--fh-sidebar); }
        .fh-revenue-row small { display: block; margin-top: 3px; color: #64748b; font-size: 12px; }
        .fh-revenue-row.is-outstanding { background: #fffaf0; }
        .fh-revenue-actions { display: flex; justify-content: flex-end; gap: 8px; }`,
  'empty css'
);

// Mobile CSS additions.
insertAfter(
  `          .fh-metric-card b { font-size: 20px; }`,
  `
          .fh-revenue-grid { grid-template-columns: 1fr; gap: 12px; }
          .fh-revenue-card { padding: 16px; }`,
  'mobile metric css'
);

// 10) Tab JSX.
const revenueTab = `

            {/* TAB: REVENUE REPORT */}
            {tab === 'revenue' && (
              <section>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'12px'}}>
                  <div>
                    <h2 style={{fontSize:'20px', fontWeight:700, margin:'0 0 4px 0', color:'#0f172a'}}>Hóa đơn tổng doanh thu</h2>
                    <p style={{color:'#64748b', margin:0, fontSize:'14px'}}>Báo cáo doanh thu đã hoàn tất và các đơn còn tồn của {shop.name}.</p>
                  </div>
                  <button className="fh-btn-outline" onClick={() => fetchRevenueReport(1, revenueFilters)}><RefreshCcw size={16}/> Làm mới</button>
                </div>

                <div className="fh-revenue-grid">
                  <article className="fh-revenue-card success"><span>Doanh thu hoàn tất</span><b>{money(revenueReport.completedRevenue)}</b><small>{revenueReport.completedCount} đơn hoàn tất đã thanh toán</small></article>
                  <article className="fh-revenue-card warning"><span>Giá trị đơn tồn</span><b>{money(revenueReport.outstandingValue)}</b><small>{revenueReport.outstandingCount} đơn chưa hoàn tất đủ điều kiện</small></article>
                  <article className="fh-revenue-card danger"><span>Đơn chưa thu tiền</span><b>{revenueReport.unpaidCount.toLocaleString('vi-VN')}</b><small>Cần đối soát hoặc xác nhận thanh toán</small></article>
                  <article className="fh-revenue-card info"><span>Đã thu nhưng chưa hoàn tất</span><b>{revenueReport.paidWaitingCount.toLocaleString('vi-VN')}</b><small>Cần hoàn tất trạng thái đơn</small></article>
                </div>

                <div className="fh-filter-panel">
                  <div className="fh-search-box">
                    <Search size={16} />
                    <input value={revenueFilters.search} onChange={(e) => updateRevenueFilter('search', e.target.value)} placeholder="Tìm mã đơn, tên khách, SĐT, số bàn..." />
                  </div>
                  <select value={revenueFilters.status} onChange={(e) => updateRevenueFilter('status', e.target.value)}>
                    <option value="">Mọi trạng thái</option>
                    {Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <select value={revenueFilters.paymentStatus} onChange={(e) => updateRevenueFilter('paymentStatus', e.target.value)}>
                    <option value="">Mọi thanh toán</option>
                    {Object.entries(paymentLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <select value={revenueFilters.orderType} onChange={(e) => updateRevenueFilter('orderType', e.target.value)}>
                    <option value="">Loại đơn</option>
                    {Object.entries(orderTypeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input type="date" value={revenueFilters.dateFrom} onChange={(e) => updateRevenueFilter('dateFrom', e.target.value)} title="Từ ngày" />
                  <input type="date" value={revenueFilters.dateTo} onChange={(e) => updateRevenueFilter('dateTo', e.target.value)} title="Đến ngày" />
                  <button className="fh-btn-outline" onClick={() => { setRevenueFilters({ search:'', status:'', paymentStatus:'', orderType:'', dateFrom:'', dateTo:'' }); setRevenuePage(1); }}>Xóa lọc</button>
                </div>

                <section className="fh-card fh-revenue-table-card">
                  <div className="fh-card-header">
                    <div>
                      <h2>Danh sách đơn của cửa hàng</h2>
                      <small style={{color:'#64748b'}}>Tổng {revenuePagination.total} đơn theo bộ lọc hiện tại · Đã hủy: {revenueReport.cancelledCount}</small>
                    </div>
                  </div>
                  <div className="fh-revenue-table">
                    <div className="fh-revenue-row fh-revenue-head"><span>Mã đơn</span><span>Khách / bàn</span><span>Trạng thái</span><span>Thanh toán</span><span>Giá trị</span><span></span></div>
                    {revenueLoading && <div style={{padding:'24px', textAlign:'center', color:'#64748b'}}>Đang tải báo cáo doanh thu...</div>}
                    {!revenueLoading && revenueOrders.map((order) => {
                      const completedPaid = String(order.status || '').toLowerCase() === 'completed' && String(order.paymentStatus || '').toLowerCase() === 'paid';
                      return (
                        <div key={order._id} className={'fh-revenue-row ' + (completedPaid ? '' : 'is-outstanding')}>
                          <div><strong>#{order.orderCode}</strong><small>{formatDateTime(order.paidAt || order.createdAt)} · {orderTypeLabels[order.orderType] || order.orderType || 'Đơn hàng'}</small></div>
                          <div><b>{order.tableNumber ? ('Bàn ' + order.tableNumber) : (order.customerName || 'Khách lẻ')}</b><small>{order.phone || order.loyaltyPhone || 'Không SĐT'}</small></div>
                          <div><span className={'fh-badge ' + (order.status || 'neutral')}>{statusLabels[order.status] || order.status || '—'}</span></div>
                          <div><span className={'fh-badge ' + (order.paymentStatus || 'neutral')}>{paymentLabels[order.paymentStatus] || order.paymentStatus || '—'}</span></div>
                          <div><b>{money(order.totalAmount)}</b><small>{completedPaid ? 'Đã tính doanh thu' : 'Đơn tồn/chưa hoàn tất'}</small></div>
                          <div className="fh-revenue-actions">{canPrintInvoice(order) && <button className="fh-btn-mini" onClick={() => openInvoiceOrder(order)}><Printer size={14}/> Hóa đơn</button>}</div>
                        </div>
                      );
                    })}
                    {!revenueLoading && !revenueOrders.length && <div className="fh-empty" style={{margin:'18px'}}><Receipt size={40}/><h3>Chưa có đơn theo bộ lọc</h3><p>Thử đổi ngày hoặc xóa bộ lọc để xem toàn bộ đơn.</p></div>}
                  </div>
                </section>
                <div style={{marginTop:'24px'}}><Pagination pagination={revenuePagination} onPageChange={setRevenuePage} /></div>
              </section>
            )}`;

insertBefore(
  `            {/* TAB: INVOICES (IN HÓA ĐƠN) */}`,
  revenueTab + `

`,
  'before invoice tab'
);

fs.writeFileSync(target, src, 'utf8');
console.log('[OK] Updated frontend/src/pages/SellerDashboard.jsx');
console.log('[DONE] Seller dashboard now has a Doanh thu tab with completed revenue, outstanding orders, and order list.');
