const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const patchRoot = path.join(__dirname, 'patch-files');
const backend = path.join(root, 'backend');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(root, 'patch-backups', `real-otp-twilio-v35-${stamp}`);

const fail = (message) => {
  console.error(`\n[ERROR] ${message}`);
  process.exit(1);
};

if (!fs.existsSync(path.join(backend, 'package.json'))) {
  fail('Không tìm thấy backend/package.json. Hãy chạy từ thư mục gốc ngutamholdings.');
}
if (!fs.existsSync(path.join(backend, 'services', 'otpService.js'))) {
  fail('Không tìm thấy backend/services/otpService.js. Hãy cài patch quên mật khẩu v33 trước.');
}

const copyWithBackup = (relative) => {
  const source = path.join(patchRoot, relative);
  const target = path.join(root, relative);
  if (fs.existsSync(target)) {
    const backupTarget = path.join(backup, relative);
    fs.mkdirSync(path.dirname(backupTarget), { recursive: true });
    fs.copyFileSync(target, backupTarget);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`[OK] Cập nhật ${relative}`);
};

copyWithBackup(path.join('backend', 'services', 'otpService.js'));
copyWithBackup(path.join('backend', 'scripts', 'testTwilioOtp.js'));

for (const file of ['package.json', 'package-lock.json', '.env.example']) {
  const target = path.join(backend, file);
  if (fs.existsSync(target)) {
    const backupTarget = path.join(backup, 'backend', file);
    fs.mkdirSync(path.dirname(backupTarget), { recursive: true });
    fs.copyFileSync(target, backupTarget);
  }
}

const envExample = path.join(backend, '.env.example');
let envText = fs.existsSync(envExample) ? fs.readFileSync(envExample, 'utf8') : '';
if (!envText.includes('TWILIO_VERIFY_SERVICE_SID')) {
  envText += `\n# REAL OTP - TWILIO VERIFY V35\nNODE_ENV=production\nOTP_PROVIDER=twilio\nOTP_DEV_MODE=false\nOTP_APP_NAME=Ngu Tam\nOTP_HASH_SECRET=replace_with_a_long_random_secret\nTWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\nTWILIO_AUTH_TOKEN=your_auth_token\nTWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n# Tùy chọn; để trống cho Twilio tự chọn ngôn ngữ theo quốc gia\nTWILIO_VERIFY_LOCALE=\nTWILIO_VERIFY_CHANNEL=sms\n`;
  fs.writeFileSync(envExample, envText, 'utf8');
  console.log('[OK] Bổ sung biến môi trường mẫu vào backend/.env.example');
}

console.log('\n[INSTALL] Đang cài thư viện twilio vào backend...');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const install = spawnSync(npmCommand, ['install', 'twilio', '--save'], {
  cwd: backend,
  stdio: 'inherit',
  shell: false
});
if (install.status !== 0) {
  fail('npm install twilio thất bại. Chạy thủ công: cd backend && npm install twilio --save');
}

const check = spawnSync(process.execPath, ['--check', path.join(backend, 'services', 'otpService.js')], {
  cwd: root,
  stdio: 'inherit'
});
if (check.status !== 0) fail('otpService.js không qua kiểm tra cú pháp.');

console.log(`\n[DONE] Đã cài OTP thật bằng Twilio Verify.`);
console.log(`[BACKUP] ${backup}`);
console.log('\nBước tiếp theo: thêm biến TWILIO_* vào backend/.env và Render Environment theo README.md.');
