const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const patchRoot = path.join(__dirname, 'patch-files');
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(root, 'patch-backups', `gmail-email-otp-loyalty-v36-${stamp}`);

const fail = (message) => {
  console.error(`\n[ERROR] ${message}`);
  console.error(`[BACKUP] ${backupDir}`);
  process.exit(1);
};

if (!fs.existsSync(path.join(backend, 'package.json'))) {
  fail('Không tìm thấy backend/package.json. Hãy chạy từ thư mục gốc project có backend và frontend.');
}
if (!fs.existsSync(path.join(backend, 'controllers', 'authController.js'))) {
  fail('Không tìm thấy backend/controllers/authController.js. Hãy cài patch quên mật khẩu v33 trước.');
}
if (!fs.existsSync(path.join(backend, 'controllers', 'loyaltyController.js'))) {
  fail('Không tìm thấy backend/controllers/loyaltyController.js.');
}
if (!fs.existsSync(path.join(frontend, 'src', 'components', 'PhoneOtpPanel.jsx'))) {
  fail('Không tìm thấy frontend/src/components/PhoneOtpPanel.jsx.');
}

const backup = (relative) => {
  const source = path.join(root, relative);
  if (!fs.existsSync(source)) return;
  const destination = path.join(backupDir, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};

const copy = (relative) => {
  const source = path.join(patchRoot, relative);
  const destination = path.join(root, relative);
  if (!fs.existsSync(source)) fail(`Thiếu file trong patch: ${relative}`);
  backup(relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  console.log(`[OK] Cập nhật ${relative}`);
};

[
  'backend/models/EmailOtp.js',
  'backend/models/LoyaltyEmailBinding.js',
  'backend/services/emailOtpService.js',
  'backend/services/otpService.js',
  'backend/controllers/authController.js',
  'backend/scripts/testGmailOtp.js',
  'frontend/src/pages/ForgotPassword.jsx',
  'frontend/src/components/PhoneOtpPanel.jsx'
].forEach(copy);

// Sửa đúng phần request/verify OTP trong loyaltyController nhưng giữ nguyên toàn bộ
// vòng quay, xu hệ thống, coupon và các patch cũ khác.
{
  const relative = 'backend/controllers/loyaltyController.js';
  const file = path.join(root, relative);
  backup(relative);
  let source = fs.readFileSync(file, 'utf8');

  if (!source.includes("const LoyaltyEmailBinding = require('../models/LoyaltyEmailBinding');")) {
    const anchor = "const LoyaltyTransaction = require('../models/LoyaltyTransaction');";
    if (!source.includes(anchor)) fail('Không tìm thấy vị trí import LoyaltyTransaction trong loyaltyController.js');
    source = source.replace(anchor, `${anchor}\nconst LoyaltyEmailBinding = require('../models/LoyaltyEmailBinding');`);
  }

  if (!source.includes("require('../services/emailOtpService')")) {
    const anchor = "const { requestOtp, verifyOtp } = require('../services/otpService');";
    if (!source.includes(anchor)) fail('Không tìm thấy import otpService trong loyaltyController.js');
    source = source.replace(
      anchor,
      `${anchor}\nconst { requestEmailOtp, verifyEmailOtp, maskEmail, normalizeEmail } = require('../services/emailOtpService');`
    );
  }

  const block = fs.readFileSync(path.join(patchRoot, 'loyaltyOtpBlock.js.txt'), 'utf8').trim();

  const markerRegex = /\/\/ GMAIL_LOYALTY_OTP_V36_START[\s\S]*?\/\/ GMAIL_LOYALTY_OTP_V36_END/;
  if (markerRegex.test(source)) {
    source = source.replace(markerRegex, block);
  } else {
    const oldOtpRegex = /exports\.requestOtp\s*=\s*async[\s\S]*?exports\.verifyOtp\s*=\s*async[\s\S]*?\n\};(?=\n\nexports\.getWallet)/;
    if (!oldOtpRegex.test(source)) {
      fail('Không tìm thấy khối requestOtp/verifyOtp trong loyaltyController.js');
    }
    source = source.replace(oldOtpRegex, block);
  }

  fs.writeFileSync(file, source, 'utf8');
  console.log('[OK] Thêm lựa chọn OTP Email/SMS vào loyaltyController.js');
}

// Cập nhật lời dẫn ở ví xu và vòng quay hệ thống để không còn ghi bắt buộc SMS.
for (const relative of [
  'frontend/src/components/LoyaltyWidget.jsx',
  'frontend/src/components/PlatformMarketingHome.jsx'
]) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) continue;
  backup(relative);
  let source = fs.readFileSync(file, 'utf8');
  source = source
    .replace('Xác thực số điện thoại</h3><p>Mỗi số điện thoại có một ví xu riêng tại <b>{shop.name}</b>. Production cần OTP SMS thật để bảo vệ điểm thưởng.', 'Xác thực ví xu</h3><p>Mỗi số điện thoại có một ví xu riêng tại <b>{shop.name}</b>. Có thể nhận OTP miễn phí qua email hoặc dùng SMS khi hệ thống đã cấu hình.')
    .replace('Xác thực số điện thoại trước khi quay để cộng xu vào ví hệ thống.', 'Xác thực ví xu trước khi quay để cộng xu vào tài khoản hệ thống.');
  fs.writeFileSync(file, source, 'utf8');
  console.log(`[OK] Cập nhật nội dung ${relative}`);
}

// Bổ sung biến môi trường mẫu, không sửa file backend/.env thật của người dùng.
{
  const relative = 'backend/.env.example';
  const file = path.join(root, relative);
  backup(relative);
  let source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const start = '# GMAIL_EMAIL_OTP_V36_START';
  const end = '# GMAIL_EMAIL_OTP_V36_END';
  const block = `${start}\n# Gmail OTP cho quên mật khẩu và khách hàng tích xu.\nOTP_DEV_MODE=false\nOTP_HASH_SECRET=replace_with_a_long_random_secret\nOTP_RESEND_SECONDS=60\nGMAIL_USER=youraccount@gmail.com\nGMAIL_APP_PASSWORD=your_16_character_google_app_password\nGMAIL_FROM_NAME=Ngu Tam\n# GMAIL_REPLY_TO=youraccount@gmail.com\n# SMS vẫn là tùy chọn nếu có webhook riêng:\n# SMS_OTP_WEBHOOK_URL=https://...\n# SMS_OTP_WEBHOOK_TOKEN=...\n${end}`;
  const regex = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  source = regex.test(source) ? source.replace(regex, block) : `${source.trimEnd()}\n\n${block}\n`;
  fs.writeFileSync(file, source, 'utf8');
  console.log('[OK] Bổ sung cấu hình Gmail vào backend/.env.example');
}

// Xóa script test Twilio cũ để tránh người dùng tiếp tục chạy nhầm.
{
  const relative = 'backend/scripts/testTwilioOtp.js';
  const file = path.join(root, relative);
  if (fs.existsSync(file)) {
    backup(relative);
    fs.unlinkSync(file);
    console.log('[OK] Xóa script test Twilio cũ');
  }
}

for (const relative of ['backend/package.json', 'backend/package-lock.json']) backup(relative);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log('\n[INSTALL] Đang cài nodemailer...');
const install = spawnSync(npmCommand, ['install', 'nodemailer', '--save'], {
  cwd: backend,
  stdio: 'inherit',
  shell: false
});
if (install.status !== 0) fail('npm install nodemailer thất bại. Chạy thủ công: cd backend && npm install nodemailer --save');

console.log('\n[REMOVE] Đang gỡ Twilio vì v36 không còn dùng...');
const uninstall = spawnSync(npmCommand, ['uninstall', 'twilio', '--save'], {
  cwd: backend,
  stdio: 'inherit',
  shell: false
});
if (uninstall.status !== 0) {
  console.warn('[WARN] Không gỡ được twilio tự động. Có thể chạy sau: cd backend && npm uninstall twilio --save');
}

const syntaxFiles = [
  'backend/models/EmailOtp.js',
  'backend/models/LoyaltyEmailBinding.js',
  'backend/services/emailOtpService.js',
  'backend/services/otpService.js',
  'backend/controllers/authController.js',
  'backend/controllers/loyaltyController.js',
  'backend/scripts/testGmailOtp.js'
];
for (const relative of syntaxFiles) {
  const check = spawnSync(process.execPath, ['--check', path.join(root, relative)], {
    cwd: root,
    stdio: 'inherit',
    shell: false
  });
  if (check.status !== 0) fail(`${relative} không qua kiểm tra cú pháp.`);
}

console.log('\n[DONE] v36 đã chuyển quên mật khẩu sang Gmail và thêm lựa chọn Email cho OTP tích xu.');
console.log('[BACKUP]', backupDir);
console.log('\nTiếp theo: tạo Google App Password, thêm GMAIL_USER/GMAIL_APP_PASSWORD vào backend/.env và Render Environment.');
