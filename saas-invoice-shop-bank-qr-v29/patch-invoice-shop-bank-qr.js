const fs = require('fs');
const path = require('path');

const root = process.cwd();
const file = path.join(root, 'frontend', 'src', 'components', 'InvoicePrintModal.jsx');
if (!fs.existsSync(file)) {
  console.error('[ERR] Cannot find:', file);
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');
const backupDir = path.join(root, 'patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(path.join(backupDir, `InvoicePrintModal.before-shop-bank-qr-v29.${stamp}.jsx`), src, 'utf8');

const MARK = 'FH_SHOP_BANK_QR_V29';
if (src.includes(MARK)) {
  console.log('[SKIP] InvoicePrintModal.jsx already contains shop bank QR patch v29.');
  process.exit(0);
}

function insertAfterEscapeHtml(code) {
  const helper = `

// ${MARK}: QR thanh toán ngân hàng của chủ shop, đúng tổng tiền hóa đơn.
const normalizeBankCode = (value = '') => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9]/g, '');

const buildShopBankQrUrl = ({ shop = {}, amount = 0, order = {} }) => {
  const bankCode = normalizeBankCode(shop.bankId || shop.bankCode || shop.bankName || shop.bankShortName || '');
  const accountNumber = normalizeBankCode(shop.bankAccountNumber || '');
  if (!bankCode || !accountNumber) return '';

  const transferContent = String(order.paymentReference || order.orderCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-_]/g, '');

  const params = new URLSearchParams({
    amount: String(Math.max(0, Math.round(Number(amount || 0)))),
    addInfo: transferContent,
    accountName: String(shop.bankAccountName || shop.legalName || shop.name || '').trim()
  });

  return ` + "`https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?${params.toString()}`" + `;
};
`;

  const marker = "const units = ['", idx = code.indexOf(marker);
  if (idx === -1) throw new Error('Cannot find insertion point after escapeHtml / before number helpers.');
  return code.slice(0, idx) + helper + '\n' + code.slice(idx);
}

function insertBuildVars(code) {
  const needle = "    const roundHistory = (order.orders || []).map((round) =>\n      `<p><b>Lượt ${Number(round.orderRound || 1)} · ${escapeHtml(round.customerName || 'Khách tại bàn')}</b> · ${dateTime(round.createdAt)}<br/><span>${escapeHtml((round.products || []).map((item) => `${item.name} ×${item.quantity}`).join(', '))}</span></p>`\n    ).join('');\n\n    return `";
  if (code.includes(needle)) {
    return code.replace(needle, "    const roundHistory = (order.orders || []).map((round) =>\n      `<p><b>Lượt ${Number(round.orderRound || 1)} · ${escapeHtml(round.customerName || 'Khách tại bàn')}</b> · ${dateTime(round.createdAt)}<br/><span>${escapeHtml((round.products || []).map((item) => `${item.name} ×${item.quantity}`).join(', '))}</span></p>`\n    ).join('');\n\n    const shopBankQrUrl = buildShopBankQrUrl({ shop, amount: totals.total, order });\n    const shopBankTransferContent = escapeHtml(String(order.paymentReference || order.orderCode || '').trim().toUpperCase());\n\n    return `");
  }

  const ret = '    return `<!doctype html><html lang="vi"';
  const idx = code.indexOf(ret);
  if (idx === -1) throw new Error('Cannot find buildPrintHtml return template.');
  const addition = "    const shopBankQrUrl = buildShopBankQrUrl({ shop, amount: totals.total, order });\n    const shopBankTransferContent = escapeHtml(String(order.paymentReference || order.orderCode || '').trim().toUpperCase());\n\n";
  return code.slice(0, idx) + addition + code.slice(idx);
}

function insertCss(code) {
  if (code.includes('.shop-bank-qr-section')) return code;
  const css = `
      .shop-bank-qr-section{margin-top:18px;padding:14px;border:2px solid #1d1710;border-radius:14px;background:#fffdf8;display:grid;grid-template-columns:${'${isThermal ? \'1fr\' : \'120px 1fr\'}'};gap:14px;align-items:center;break-inside:avoid}.shop-bank-qr-section img{width:${'${isThermal ? \'92px\' : \'112px\'}'};height:${'${isThermal ? \'92px\' : \'112px\'}'};object-fit:contain;margin:auto}.shop-bank-qr-section h3{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8b612a}.shop-bank-qr-section p{margin:3px 0}.shop-bank-qr-section .amount{font-size:${'${isThermal ? \'16px\' : \'20px\'}'};font-weight:900;color:#111827}.shop-bank-qr-section .bank-note{font-size:10px;color:#6b6258;margin-top:7px;line-height:1.35}
`;
  const idx = code.indexOf('      @media print');
  if (idx !== -1) return code.slice(0, idx) + css + code.slice(idx);
  const idx2 = code.indexOf('    </style>');
  if (idx2 === -1) throw new Error('Cannot find style closing tag.');
  return code.slice(0, idx2) + css + code.slice(idx2);
}

function insertHtml(code) {
  if (code.includes('Quét QR để thanh toán cho chủ shop')) return code;
  const block = `
      ${'${shopBankQrUrl ? `'}<section class="shop-bank-qr-section">
        <img src="${'${escapeHtml(shopBankQrUrl)}'}" alt="QR thanh toán chủ shop"/>
        <div>
          <h3>Quét QR để thanh toán cho chủ shop</h3>
          <p><b>Ngân hàng:</b> ${'${escapeHtml(shop.bankName || shop.bankCode || shop.bankId || \'—\')}'}</p>
          <p><b>Số tài khoản:</b> ${'${escapeHtml(shop.bankAccountNumber || \'—\')}'}</p>
          <p><b>Chủ tài khoản:</b> ${'${escapeHtml(shop.bankAccountName || shop.legalName || shop.name || \'—\')}'}</p>
          <p><b>Nội dung:</b> ${'${shopBankTransferContent || escapeHtml(order.orderCode || \'—\')}'}</p>
          <p class="amount">Số tiền: ${'${money(totals.total)}'}</p>
          <p class="bank-note">QR được tạo theo đúng tổng tiền trên hóa đơn. Khách chỉ cần quét mã, kiểm tra số tiền và nội dung chuyển khoản trước khi xác nhận.</p>
        </div>
      </section>${'` : \'\'}'}
`;

  const needle = '      <div class="warning">';
  const idx = code.indexOf(needle);
  if (idx !== -1) return code.slice(0, idx) + block + code.slice(idx);

  const needle2 = '      <footer class="footer">';
  const idx2 = code.indexOf(needle2);
  if (idx2 !== -1) return code.slice(0, idx2) + block + code.slice(idx2);

  throw new Error('Cannot find invoice footer/warning insertion point.');
}

src = insertAfterEscapeHtml(src);
src = insertBuildVars(src);
src = insertCss(src);
src = insertHtml(src);

fs.writeFileSync(file, src, 'utf8');
console.log('[OK] Patched frontend/src/components/InvoicePrintModal.jsx');
console.log('[OK] Backup saved in patch-backups/');
