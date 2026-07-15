const fs = require('fs');
const path = require('path');

const V39_START = '/* FH_V39_LOYALTY_COUPON_MOBILE_SCROLL_START */';
const V39_END = '/* FH_V39_LOYALTY_COUPON_MOBILE_SCROLL_END */';
const V40_START = '/* FH_V40_LOYALTY_SCROLL_CLOSE_TABLE_BADGE_START */';
const V40_END = '/* FH_V40_LOYALTY_SCROLL_CLOSE_TABLE_BADGE_END */';

function fail(message) {
  console.error(`\n[ERROR] ${message}`);
  process.exit(1);
}

function findRoot(start) {
  let current = path.resolve(start);
  for (let i = 0; i < 8; i += 1) {
    const required = [
      path.join(current, 'frontend', 'src', 'components', 'LoyaltyWidget.jsx'),
      path.join(current, 'frontend', 'src', 'pages', 'ShopPage.jsx'),
      path.join(current, 'frontend', 'src', 'styles.css')
    ];
    if (required.every(fs.existsSync)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function removeMarkedBlock(text, startMarker, endMarker) {
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escape(startMarker)}[\\s\\S]*?${escape(endMarker)}\\s*`, 'g');
  return text.replace(regex, '');
}

function count(text, token) {
  return text.split(token).length - 1;
}

const root = findRoot(process.cwd());
if (!root) {
  fail('Không tìm thấy project ngutamholdings. Hãy chạy installer từ thư mục gốc project.');
}

const widgetPath = path.join(root, 'frontend', 'src', 'components', 'LoyaltyWidget.jsx');
const shopPagePath = path.join(root, 'frontend', 'src', 'pages', 'ShopPage.jsx');
const stylesPath = path.join(root, 'frontend', 'src', 'styles.css');

let widget = fs.readFileSync(widgetPath, 'utf8').replace(/\r\n/g, '\n');
const shopPage = fs.readFileSync(shopPagePath, 'utf8').replace(/\r\n/g, '\n');
let styles = fs.readFileSync(stylesPath, 'utf8').replace(/\r\n/g, '\n');

if (!widget.includes('MÃ ĐANG ÁP DỤNG') || !widget.includes('Ưu đãi công khai')) {
  fail('LoyaltyWidget.jsx không có phần MÃ ĐANG ÁP DỤNG / Ưu đãi công khai. Dừng để tránh sửa nhầm file.');
}
if (!widget.includes('className={`loyalty-panel ${open ? \'open\' : \'\'}`}')) {
  fail('Không tìm thấy loyalty-panel trong LoyaltyWidget.jsx.');
}
if (!shopPage.includes('food-table-badge') || !shopPage.includes('Đang gọi món tại')) {
  fail('ShopPage.jsx không có badge Đang gọi món tại.');
}
if (!styles.includes('.loyalty-panel') || !styles.includes('.public-coupon-section') || !styles.includes('.food-table-badge')) {
  fail('styles.css thiếu CSS loyalty hoặc badge bàn cần sửa.');
}

// 1) Chuẩn hóa nút X đóng panel: có class riêng + aria-label.
const oldClose = '<button type="button" onClick={() => setOpen(false)}>×</button>';
const newClose = '<button type="button" className="loyalty-panel-close" onClick={() => setOpen(false)} aria-label="Đóng ví xu">×</button>';
if (widget.includes(oldClose)) {
  widget = widget.replace(oldClose, newClose);
} else if (!widget.includes('className="loyalty-panel-close"')) {
  const headerRegex = /(<header><div><span>FOODHUB REWARDS<\/span><h2>Ví xu & ưu đãi<\/h2><\/div>)<button type="button"[^>]*onClick=\{\(\) => setOpen\(false\)\}[^>]*>×<\/button>(<\/header>)/;
  if (!headerRegex.test(widget)) fail('Không xác định được nút đóng panel ví xu.');
  widget = widget.replace(headerRegex, `$1${newClose}$2`);
}

// 2) Đưa body + ưu đãi công khai vào cùng một vùng cuộn.
if (!widget.includes('className="loyalty-panel-scroll"')) {
  const identityToken = '        {!identity ? (';
  if (!widget.includes(identityToken)) fail('Không tìm thấy khối đăng nhập/ví xu để tạo vùng cuộn.');
  widget = widget.replace(identityToken, '        <div className="loyalty-panel-scroll">\n' + identityToken);

  const publicStart = widget.indexOf('        <section className="public-coupon-section">');
  if (publicStart < 0) fail('Không tìm thấy public-coupon-section.');

  const tailRegex = /        <\/section>\n      <\/aside>/g;
  tailRegex.lastIndex = publicStart;
  const match = tailRegex.exec(widget);
  if (!match) fail('Không tìm thấy điểm kết thúc public-coupon-section.');
  widget = widget.slice(0, match.index)
    + '        </section>\n        </div>\n      </aside>'
    + widget.slice(match.index + match[0].length);
}

if (count(widget, 'className="loyalty-panel-scroll"') !== 1) {
  fail('Số lượng loyalty-panel-scroll không hợp lệ; dừng trước khi ghi file.');
}
if (count(widget, 'className="loyalty-panel-close"') !== 1) {
  fail('Số lượng nút X đóng ví xu không hợp lệ; dừng trước khi ghi file.');
}

// 3) Gỡ override v39 cũ rồi thêm CSS v40 mạnh hơn và áp dụng cả web/mobile.
styles = removeMarkedBlock(styles, V39_START, V39_END);
styles = removeMarkedBlock(styles, V40_START, V40_END).trimEnd();

const css = `

${V40_START}
/*
 * Ví xu: header và nút X luôn nhìn thấy; toàn bộ nội dung bên dưới cuộn chung.
 * "MÃ ĐANG ÁP DỤNG / Ưu đãi công khai" không còn là hàng cố định ở đáy.
 */
.loyalty-panel {
  display: flex !important;
  flex-direction: column !important;
  grid-template-rows: none !important;
  overflow: hidden !important;
}

.loyalty-panel > header {
  position: relative;
  z-index: 8;
  flex: 0 0 auto;
}

.loyalty-panel-close {
  display: grid !important;
  place-items: center;
  flex: 0 0 42px;
  cursor: pointer;
  line-height: 1;
}

.loyalty-panel-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable;
}

.loyalty-panel-scroll > .loyalty-panel-body,
.loyalty-panel-scroll > .loyalty-login {
  min-height: auto !important;
  overflow: visible !important;
}

.public-coupon-section {
  position: static !important;
  inset: auto !important;
  width: 100%;
  flex: 0 0 auto;
  margin: 0 !important;
  border-bottom: 0;
}

/* Dịch badge "Đang gọi món tại" xuống nhẹ trên màn hình web. */
.food-table-badge {
  margin-top: 14px !important;
  margin-bottom: 10px !important;
}

@media (max-width: 768px) {
  .loyalty-panel > header {
    padding-top: calc(18px + env(safe-area-inset-top, 0px)) !important;
  }

  .loyalty-panel-scroll {
    padding-bottom: calc(170px + env(safe-area-inset-bottom, 0px));
  }

  .public-coupon-section article {
    align-items: flex-start;
  }

  .public-coupon-section article > div {
    min-width: 0;
  }

  .public-coupon-section article p {
    overflow-wrap: anywhere;
  }

  /* Mobile cũng hạ badge xuống nhưng không chiếm quá nhiều chiều cao hero. */
  .food-table-badge {
    margin-top: 12px !important;
    margin-bottom: 9px !important;
  }
}
${V40_END}
`;

styles += css;

// Kiểm tra nội dung trong bộ nhớ trước khi ghi.
if (!widget.includes('<div className="loyalty-panel-scroll">')) fail('Không tạo được vùng cuộn loyalty-panel-scroll.');
if (!widget.includes('aria-label="Đóng ví xu"')) fail('Không tạo được nút X đóng ví xu.');
if (!styles.includes(V40_START) || !styles.includes('grid-template-rows: none !important')) fail('Không tạo được CSS v40.');

const backupDir = path.join(root, 'patch-backups', `loyalty-scroll-close-v40-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(widgetPath, path.join(backupDir, 'LoyaltyWidget.jsx'));
fs.copyFileSync(stylesPath, path.join(backupDir, 'styles.css'));

fs.writeFileSync(widgetPath, widget, 'utf8');
fs.writeFileSync(stylesPath, styles, 'utf8');

const writtenWidget = fs.readFileSync(widgetPath, 'utf8');
const writtenStyles = fs.readFileSync(stylesPath, 'utf8');
if (!writtenWidget.includes('loyalty-panel-scroll') || !writtenWidget.includes('loyalty-panel-close')) {
  fail('Kiểm tra LoyaltyWidget.jsx sau khi ghi không đạt.');
}
if (!writtenStyles.includes(V40_START) || !writtenStyles.includes('margin-top: 14px !important')) {
  fail('Kiểm tra styles.css sau khi ghi không đạt.');
}

console.log(`[BACKUP] ${path.relative(root, backupDir)}`);
console.log('[OK] MÃ ĐANG ÁP DỤNG / Ưu đãi công khai đã cuộn cùng toàn bộ nội dung, không còn fix cứng.');
console.log('[OK] Nút X đóng Ví xu luôn hiển thị ở header trên web và mobile.');
console.log('[OK] Badge Đang gọi món tại đã được dịch xuống nhẹ trên web và mobile.');
console.log('\n[DONE] Cài xong v40. Khởi động lại frontend để kiểm tra.');
