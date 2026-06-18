const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';
const processes = [];

function ensureEnv(folder) {
  const envPath = path.join(root, folder, '.env');
  const examplePath = path.join(root, folder, '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log(`Đã tự tạo ${folder}/.env từ .env.example`);
  }
}

ensureEnv('backend');
ensureEnv('frontend');

function run(prefix, label) {
  const child = spawn(npm, ['run', 'dev', '--prefix', prefix], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, FORCE_COLOR: '1' }
  });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`${label} dừng với mã ${code}`);
  });
  processes.push(child);
}

console.log('FoodHub local: http://localhost:5173');
console.log('API kiểm tra: http://localhost:5000/api/health');
run('backend', 'Backend');
run('frontend', 'Frontend');

const stop = () => {
  for (const child of processes) {
    if (!child.killed) child.kill(isWin ? undefined : 'SIGTERM');
  }
  setTimeout(() => process.exit(0), 250);
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
