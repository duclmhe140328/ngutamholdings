const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const patchRoot = __dirname;
const relativeTarget = path.join('frontend', 'src', 'components', 'MapPicker.jsx');
const source = path.join(patchRoot, 'patch-files', relativeTarget);
const target = path.join(projectRoot, relativeTarget);

const fail = (message) => {
  console.error(`\n[ERROR] ${message}\n`);
  process.exit(1);
};

if (!fs.existsSync(path.join(projectRoot, 'frontend'))) {
  fail('Hãy chạy installer tại thư mục gốc E:\\foodhub_v14_5_release\\ngutamholdings');
}
if (!fs.existsSync(source)) fail(`Thiếu file patch: ${source}`);
if (!fs.existsSync(target)) fail(`Không tìm thấy file cần sửa: ${target}`);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(projectRoot, 'patch-backups', `map-picker-high-accuracy-v41-${stamp}`);
const backupFile = path.join(backupDir, relativeTarget);

fs.mkdirSync(path.dirname(backupFile), { recursive: true });
fs.copyFileSync(target, backupFile);
fs.copyFileSync(source, target);

const installed = fs.readFileSync(target, 'utf8');
const checks = [
  'enableHighAccuracy: true',
  'maximumAge: 0',
  'watchPosition',
  'coords.accuracy',
  'Hệ thống chưa tự lưu điểm này',
];
for (const check of checks) {
  if (!installed.includes(check)) fail(`File sau khi cài thiếu đoạn kiểm tra: ${check}`);
}

console.log('\n[DONE] Cài xong v41 – GPS độ chính xác cao cho MapPicker.');
console.log(`[BACKUP] ${backupFile}`);
console.log('\nTiếp theo chạy:');
console.log('  cd frontend');
console.log('  npm run dev');
console.log('\nKhông cần sửa backend, MongoDB hoặc Environment Variables.\n');
