const fs = require('fs');
const path = require('path');

const root = process.cwd();
const srcHtml = path.join(root, 'patch-files', 'admin-revenue.html');

function exists(p) { return fs.existsSync(p); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  if (exists(dest)) {
    const backupDir = path.join(root, 'patch-backups', 'revenue-mobile-v10-' + new Date().toISOString().replace(/[:.]/g, '-'));
    ensureDir(backupDir);
    fs.copyFileSync(dest, path.join(backupDir, path.basename(dest)));
    console.log('[BACKUP]', dest, '->', backupDir);
  }
  fs.copyFileSync(src, dest);
  console.log('[OK] wrote', dest);
}

function walkDirs(start, depth = 0, maxDepth = 4, result = []) {
  if (depth > maxDepth) return result;
  let entries = [];
  try { entries = fs.readdirSync(start, { withFileTypes: true }); } catch { return result; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(e.name)) continue;
    const full = path.join(start, e.name);
    result.push(full);
    walkDirs(full, depth + 1, maxDepth, result);
  }
  return result;
}

const candidates = new Set();
for (const d of [root, ...walkDirs(root)]) {
  if (path.basename(d).toLowerCase() === 'public') candidates.add(d);
}

if (candidates.size === 0) {
  candidates.add(path.join(root, 'public'));
}

console.log('Project root:', root);
console.log('Public targets:');
for (const d of candidates) console.log(' -', d);

for (const publicDir of candidates) {
  copyFile(srcHtml, path.join(publicDir, 'admin-revenue.html'));
}

console.log('');
console.log('Open one of these URLs:');
console.log(' - http://localhost:5000/admin-revenue.html');
console.log(' - http://localhost:5173/admin-revenue.html');
console.log('Production note: on same domain it calls /api/revenue automatically. Local Vite 5173 calls http://localhost:5000 unless localStorage.REVENUE_API_BASE is set.');
