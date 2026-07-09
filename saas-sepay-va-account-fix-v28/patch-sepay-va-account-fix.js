
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const file = path.join(root, 'backend', 'controllers', 'paymentController.js');

if (!fs.existsSync(file)) {
  console.error('[ERR] Không tìm thấy file:', file);
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');
const backupDir = path.join(root, 'patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
const backup = path.join(backupDir, `paymentController.v28.${Date.now()}.js`);
fs.writeFileSync(backup, src, 'utf8');
console.log('[OK] Backup:', backup);

function replaceOnce(label, from, to) {
  if (!src.includes(from)) {
    console.error(`[ERR] Không tìm thấy đoạn cần sửa: ${label}`);
    process.exit(1);
  }
  src = src.replace(from, to);
  console.log('[OK] Patched:', label);
}

// 1) Duplicate logic: trước đây transactionId đã từng lưu là return luôn.
// Nếu lần đầu bị account mismatch -> matched=false, SePay retry cùng id sẽ vẫn bị bỏ qua.
replaceOnce(
  'allow retry for unmatched SepayTransaction',
`    const existed = await SepayTransaction.findOne({ transactionId });
    if (existed) return res.status(200).json({ success: true, duplicated: true });`,
`    let transaction = await SepayTransaction.findOne({ transactionId });
    if (transaction?.matched) {
      return res.status(200).json({ success: true, duplicated: true, matched: true });
    }`
);

// 2) Account matching: mặc định không chặn vì SePay có thể trả về TK chính còn QR/shop dùng VA.
replaceOnce(
  'relax account matching for VA/main account',
`    const accountMatches = !shop || !shop.bankAccountNumber ||
      normalizeAccount(payload.accountNumber) === normalizeAccount(shop.bankAccountNumber);`,
`    const receivedAccount = normalizeAccount(payload.accountNumber);
    const shopAccount = normalizeAccount(shop?.bankAccountNumber);
    const primaryAccount = normalizeAccount(process.env.BANK_ACCOUNT_NUMBER || process.env.SEPAY_PRIMARY_ACCOUNT_NUMBER || '');
    const allowedAccounts = [shopAccount, primaryAccount].filter(Boolean);

    // Mặc định SaaS đối soát bằng mã đơn/paymentReference trong nội dung CK.
    // SePay/VA có thể báo accountNumber là tài khoản chính thay vì VA của shop,
    // nên nếu khóa cứng theo shop.bankAccountNumber thì tiền vào rồi nhưng đơn không paid.
    // Chỉ bật strict nếu thật sự muốn bắt đúng accountNumber.
    const strictAccountCheck = String(process.env.SEPAY_STRICT_ACCOUNT_CHECK || '').toLowerCase() === 'true';
    const accountMatches = !strictAccountCheck || !receivedAccount || !allowedAccounts.length || allowedAccounts.includes(receivedAccount);`
);

// 3) Transaction create -> create or reuse unmatched duplicate.
replaceOnce(
  'reuse unmatched SePay transaction instead of failing duplicate',
`    const transaction = await SepayTransaction.create({
      transactionId,
      orderId: order?._id || null,
      shopId: shop?._id || null,
      gateway: String(payload.gateway || ''),
      accountNumber: String(payload.accountNumber || ''),
      transferType: String(payload.transferType || ''),
      transferAmount,
      transactionDate: payload.transactionDate ? new Date(String(payload.transactionDate).replace(' ', 'T') + '+07:00') : new Date(),
      content: String(payload.content || ''),
      code: String(payload.code || ''),
      referenceCode: String(payload.referenceCode || ''),
      matched: Boolean(order && incoming && accountMatches),
      rawPayload: payload
    });`,
`    if (!transaction) {
      transaction = await SepayTransaction.create({
        transactionId,
        orderId: order?._id || null,
        shopId: shop?._id || null,
        gateway: String(payload.gateway || ''),
        accountNumber: String(payload.accountNumber || ''),
        transferType: String(payload.transferType || ''),
        transferAmount,
        transactionDate: payload.transactionDate ? new Date(String(payload.transactionDate).replace(' ', 'T') + '+07:00') : new Date(),
        content: String(payload.content || ''),
        code: String(payload.code || ''),
        referenceCode: String(payload.referenceCode || ''),
        matched: Boolean(order && incoming && accountMatches),
        rawPayload: { ...payload, receivedAccount, allowedAccounts, strictAccountCheck }
      });
    } else {
      transaction.orderId = order?._id || transaction.orderId || null;
      transaction.shopId = shop?._id || transaction.shopId || null;
      transaction.gateway = String(payload.gateway || transaction.gateway || '');
      transaction.accountNumber = String(payload.accountNumber || transaction.accountNumber || '');
      transaction.transferType = String(payload.transferType || transaction.transferType || '');
      transaction.transferAmount = transferAmount || transaction.transferAmount || 0;
      transaction.transactionDate = payload.transactionDate ? new Date(String(payload.transactionDate).replace(' ', 'T') + '+07:00') : (transaction.transactionDate || new Date());
      transaction.content = String(payload.content || transaction.content || '');
      transaction.code = String(payload.code || transaction.code || '');
      transaction.referenceCode = String(payload.referenceCode || transaction.referenceCode || '');
      transaction.matched = Boolean(order && incoming && accountMatches);
      transaction.rawPayload = { ...payload, receivedAccount, allowedAccounts, strictAccountCheck, retriedAfterUnmatched: true };
      await transaction.save();
    }`
);

// 4) Message rõ hơn khi strict bật. Nếu strict tắt thì block này sẽ không chạy.
replaceOnce(
  'clear strict account mismatch response',
`    if (!accountMatches) {
      transaction.matched = false;
      await transaction.save();
      return res.status(200).json({ success: true, matched: false, message: 'Sai tài khoản nhận tiền' });
    }`,
`    if (!accountMatches) {
      transaction.matched = false;
      transaction.rawPayload = { ...(transaction.rawPayload || payload), receivedAccount, allowedAccounts, strictAccountCheck, rejectReason: 'account_mismatch' };
      await transaction.save();
      return res.status(200).json({
        success: true,
        matched: false,
        message: 'Sai tài khoản nhận tiền do SEPAY_STRICT_ACCOUNT_CHECK=true',
        receivedAccount,
        allowedAccounts
      });
    }`
);

fs.writeFileSync(file, src, 'utf8');
console.log('[DONE] Updated backend/controllers/paymentController.js');
console.log('[NEXT] Restart backend and test one new bank transfer order.');
