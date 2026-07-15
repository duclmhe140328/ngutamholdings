const fs = require('fs');
const path = require('path');

const MARKER_START = '/* FH_V39_LOYALTY_COUPON_MOBILE_SCROLL_START */';
const MARKER_END = '/* FH_V39_LOYALTY_COUPON_MOBILE_SCROLL_END */';

function fail(message) {
  console.error(`\n[ERROR] ${message}`);
  process.exit(1);
}

function findRoot(start) {
  let current = path.resolve(start);
  for (let i = 0; i < 8; i += 1) {
    const styles = path.join(current, 'frontend', 'src', 'styles.css');
    const widget = path.join(current, 'frontend', 'src', 'components', 'LoyaltyWidget.jsx');
    if (fs.existsSync(styles) && fs.existsSync(widget)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

const root = findRoot(process.cwd());
if (!root) fail('Không tìm thấy project có frontend/src/styles.css và LoyaltyWidget.jsx. Hãy chạy lệnh từ thư mục gốc ngutamholdings.');

const stylesPath = path.join(root, 'frontend', 'src', 'styles.css');
const widgetPath = path.join(root, 'frontend', 'src', 'components', 'LoyaltyWidget.jsx');
const widget = fs.readFileSync(widgetPath, 'utf8');

if (!widget.includes('public-coupon-section') || !widget.includes('Ưu đãi công khai')) {
  fail('LoyaltyWidget.jsx không có phần "Ưu đãi công khai". Dừng để tránh sửa nhầm phiên bản.');
}

let styles = fs.readFileSync(stylesPath, 'utf8');
if (!styles.includes('.loyalty-panel') || !styles.includes('.public-coupon-section')) {
  fail('styles.css không có CSS ví xu/ưu đãi cần sửa.');
}

const blockRegex = new RegExp(`${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g');
styles = styles.replace(blockRegex, '').trimEnd();

const cssBlock = `

${MARKER_START}
/*
 * Mobile: phần "MÃ ĐANG ÁP DỤNG / Ưu đãi công khai" không còn bị khóa
 * ở đáy panel. Toàn bộ nội dung ví xu cuộn chung, header vẫn đứng trên.
 */
@media (max-width: 768px) {
  .loyalty-panel {
    display: flex !important;
    flex-direction: column !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 0 !important;
  }

  .loyalty-panel > header {
    position: sticky !important;
    top: 0;
    z-index: 6;
    flex: 0 0 auto;
    padding-top: calc(18px + env(safe-area-inset-top, 0px)) !important;
  }

  .loyalty-panel-body,
  .loyalty-login {
    flex: 0 0 auto;
    min-height: auto !important;
    overflow: visible !important;
  }

  .public-coupon-section {
    position: static !important;
    inset: auto !important;
    flex: 0 0 auto;
    width: 100%;
    margin: 0 !important;
    padding-bottom: calc(150px + env(safe-area-inset-bottom, 0px)) !important;
    border-top: 1px solid #eadfce;
    border-bottom: 0;
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
}
${MARKER_END}
`;

const backupDir = path.join(root, 'patch-backups', `loyalty-coupon-scroll-v39-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(stylesPath, path.join(backupDir, 'styles.css'));
fs.writeFileSync(stylesPath, styles + cssBlock, 'utf8');

const updated = fs.readFileSync(stylesPath, 'utf8');
if (!updated.includes(MARKER_START) || !updated.includes('overflow-y: auto !important')) {
  fail('Đã ghi file nhưng kiểm tra sau cài đặt không đạt.');
}

console.log(`[BACKUP] ${path.relative(root, backupDir)}`);
console.log('[OK] Ưu đãi công khai trên mobile đã chuyển sang cuộn cùng toàn bộ panel.');
console.log('[OK] Chừa khoảng trống dưới để không bị giỏ hàng, nút xu hoặc chat che.');
console.log('\n[DONE] Cài xong v39. Khởi động lại frontend để kiểm tra.');
