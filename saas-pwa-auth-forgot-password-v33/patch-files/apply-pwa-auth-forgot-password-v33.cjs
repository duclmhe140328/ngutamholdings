const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patchRoot = __dirname;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(root, 'patch-backups', `pwa-auth-forgot-v33-${stamp}`);

const target = (relative) => path.join(root, relative);
const patchFile = (relative) => path.join(patchRoot, relative);

const read = (relative) => fs.readFileSync(target(relative), 'utf8');
const backup = (relative) => {
  const source = target(relative);
  if (!fs.existsSync(source)) return;
  const destination = path.join(backupDir, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};
const write = (relative, content) => {
  const destination = target(relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  backup(relative);
  fs.writeFileSync(destination, content, 'utf8');
  console.log('[OK] Wrote', relative);
};
const copy = (relative) => write(relative, fs.readFileSync(patchFile(relative), 'utf8'));
const replaceRequired = (content, search, replacement, label) => {
  if (!content.includes(search)) throw new Error(`Không tìm thấy đoạn cần sửa: ${label}`);
  return content.replace(search, replacement);
};

if (!fs.existsSync(target('backend/server.js')) || !fs.existsSync(target('frontend/src/App.jsx'))) {
  throw new Error('Hãy giải nén patch vào đúng thư mục gốc project có backend và frontend.');
}

[
  'backend/models/User.js',
  'backend/models/PhoneOtp.js',
  'backend/services/otpService.js',
  'backend/controllers/authController.js',
  'backend/routes/authRoutes.js',
  'backend/middleware/authMiddleware.js',
  'frontend/src/api/axios.js',
  'frontend/src/context/AuthContext.jsx',
  'frontend/src/pages/ForgotPassword.jsx',
  'frontend/src/pages/PwaStatus.jsx',
  'frontend/src/pwa/registerServiceWorker.js',
  'frontend/src/components/PwaInstallPrompt.jsx',
  'frontend/public/manifest.webmanifest',
  'frontend/public/sw.js'
].forEach(copy);

// App.jsx: thêm trang quên mật khẩu, trang chẩn đoán PWA và retry backend khi cold-start.
{
  const file = 'frontend/src/App.jsx';
  let source = read(file);

  if (!source.includes("./pages/ForgotPassword.jsx")) {
    source = source.replace(
      "import Login from './pages/Login.jsx';",
      "import Login from './pages/Login.jsx';\nimport ForgotPassword from './pages/ForgotPassword.jsx';\nimport PwaStatus from './pages/PwaStatus.jsx';"
    );
  }

  if (!source.includes('path="/forgot-password"')) {
    source = source.replace(
      '<Route path="/login" element={<Login />} />',
      '<Route path="/login" element={<Login />} />\n          <Route path="/forgot-password" element={<ForgotPassword />} />\n          <Route path="/pwa-status" element={<PwaStatus />} />'
    );
  }

  if (!source.includes('FH_PWA_DOMAIN_RETRY_V33')) {
    const effectPattern = /  useEffect\(\(\) => \{\s*let alive = true;[\s\S]*?\n  \}, \[\]\);/;
    if (!effectPattern.test(source)) throw new Error('Không tìm thấy useEffect kiểm tra domain trong App.jsx');
    const replacement = `  // FH_PWA_DOMAIN_RETRY_V33: không kết luận sai domain chỉ vì backend đang cold-start.\n  useEffect(() => {\n    let alive = true;\n    let retryTimer = null;\n\n    const checkDomain = async (attempt = 0) => {\n      try {\n        const timeouts = [7000, 11000, 15000];\n        const res = await api.get('/shops/domain/current', {\n          timeout: timeouts[Math.min(attempt, timeouts.length - 1)],\n          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }\n        });\n        if (!alive) return;\n        setDomainShop(res.data.shop || null);\n        setApiOffline(false);\n        setDomainChecked(true);\n      } catch {\n        if (!alive) return;\n        if (attempt < 2 && navigator.onLine) {\n          retryTimer = window.setTimeout(() => checkDomain(attempt + 1), [1200, 2600, 5000][attempt]);\n          return;\n        }\n        setDomainShop(null);\n        setApiOffline(true);\n        setDomainChecked(true);\n      }\n    };\n\n    checkDomain();\n    const onOnline = () => checkDomain(0);\n    window.addEventListener('online', onOnline);\n\n    return () => {\n      alive = false;\n      if (retryTimer) window.clearTimeout(retryTimer);\n      window.removeEventListener('online', onOnline);\n    };\n  }, []);`;
    source = source.replace(effectPattern, replacement);
  }

  write(file, source);
}

// Login.jsx: chuẩn hóa autocomplete, báo đổi mật khẩu thành công và thêm link quên mật khẩu.
{
  const file = 'frontend/src/pages/Login.jsx';
  let source = read(file);

  if (!source.includes('resetSuccess')) {
    source = source.replace(
      '  const navigate = useNavigate();',
      "  const navigate = useNavigate();\n  const resetSuccess = new URLSearchParams(window.location.search).get('reset') === 'success';"
    );
  }

  if (!source.includes('.alert-success')) {
    source = source.replace(
      '        .form-group {',
      `        .alert-success {\n          background:#ecfdf3;color:#18794e;border:1px solid #bde7ce;padding:12px 16px;border-radius:8px;font-size:14px;font-weight:600;margin-bottom:20px;\n        }\n        .forgot-password-row { display:flex; justify-content:flex-end; margin-top:-8px; margin-bottom:8px; }\n        .forgot-password-row a { color:var(--primary-gold-hover); font-size:13px; font-weight:700; text-decoration:none; }\n        .forgot-password-row a:hover { text-decoration:underline; }\n\n        .form-group {`
    );
  }

  if (!source.includes('Mật khẩu đã được đổi thành công')) {
    const errorBlock = `          {error && (\n            <div className="alert-error">\n              <AlertCircle size={18} />\n              <span>{error}</span>\n            </div>\n          )}`;
    source = replaceRequired(
      source,
      errorBlock,
      `${errorBlock}\n\n          {resetSuccess && !error && <div className="alert-success">Mật khẩu đã được đổi thành công. Hãy đăng nhập lại.</div>}`,
      'khối báo lỗi Login'
    );
  }

  if (!source.includes('autoComplete="username"')) {
    source = source.replace(
      '                  type="email" ',
      '                  type="email"\n                  autoComplete="username"\n                  autoCapitalize="none"\n                  autoCorrect="off"\n                  spellCheck="false" '
    );
  }
  if (!source.includes('autoComplete="current-password"')) {
    source = source.replace(
      '                  type="password" ',
      '                  type="password"\n                  autoComplete="current-password" '
    );
  }

  if (!source.includes('to="/forgot-password"')) {
    source = source.replace(
      '            </div>\n\n            <button type="submit" className="btn-submit"',
      '            </div>\n\n            <div className="forgot-password-row"><Link to="/forgot-password">Quên mật khẩu?</Link></div>\n\n            <button type="submit" className="btn-submit"'
    );
  }

  write(file, source);
}

// Register.jsx: số điện thoại bắt buộc để có thể khôi phục mật khẩu bằng OTP.
{
  const file = 'frontend/src/pages/Register.jsx';
  let source = read(file);
  source = source.replace(
    '<input name="phone" value={form.phone}',
    '<input required type="tel" inputMode="tel" autoComplete="tel" name="phone" value={form.phone}'
  );
  source = source.replace(
    '<input required type="email" value={form.email}',
    '<input required type="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck="false" value={form.email}'
  );
  source = source.replace(
    '<input required type="password" minLength="6" value={form.password}',
    '<input required type="password" autoComplete="new-password" minLength="6" value={form.password}'
  );
  write(file, source);
}

// server.js: auth và các file PWA không được cache cứng; asset hash vẫn cache dài.
{
  const file = 'backend/server.js';
  let source = read(file);

  if (!source.includes('FH_AUTH_NO_STORE_V33')) {
    source = source.replace(
      "app.use('/api/auth', authRoutes);",
      `// FH_AUTH_NO_STORE_V33: tránh proxy/PWA giữ phản hồi đăng nhập cũ.\napp.use('/api/auth', (req, res, next) => {\n  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');\n  res.setHeader('Pragma', 'no-cache');\n  res.setHeader('Expires', '0');\n  next();\n}, authRoutes);`
    );
  }

  if (!source.includes('FH_PWA_CACHE_HEADERS_V33')) {
    const staticPattern = /  app\.use\(express\.static\(frontendDist, \{[\s\S]*?\n  \}\)\);/;
    if (!staticPattern.test(source)) throw new Error('Không tìm thấy cấu hình express.static trong backend/server.js');
    const replacement = `  // FH_PWA_CACHE_HEADERS_V33\n  app.use(express.static(frontendDist, {\n    index: false,\n    setHeaders: (res, filePath) => {\n      const fileName = path.basename(filePath);\n      if (['sw.js', 'manifest.webmanifest', 'index.html'].includes(fileName)) {\n        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');\n        res.setHeader('Pragma', 'no-cache');\n        res.setHeader('Expires', '0');\n        return;\n      }\n      if (filePath.includes(\`${path.sep}assets${path.sep}\`)) {\n        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');\n        return;\n      }\n      res.setHeader('Cache-Control', 'public, max-age=3600');\n    }\n  }));`;
    source = source.replace(staticPattern, replacement);
  }

  write(file, source);
}

// Thêm ghi chú cấu hình OTP cho quên mật khẩu.
{
  const file = 'backend/.env.example';
  if (fs.existsSync(target(file))) {
    let source = read(file);
    if (!source.includes('FORGOT_PASSWORD_V33')) {
      source += `\n# FORGOT_PASSWORD_V33\n# Quên mật khẩu dùng chung nhà cung cấp SMS OTP hiện tại.\n# SMS_OTP_WEBHOOK_URL=https://...\n# SMS_OTP_WEBHOOK_TOKEN=...\n# OTP_DEV_MODE=true chỉ dùng local/test; production phải để false.\n`;
      write(file, source);
    }
  }
}

console.log('\n[DONE] v33 đã sửa PWA đa thiết bị, không tự logout khi backend chậm, hỗ trợ đăng nhập nhiều máy và thêm quên mật khẩu bằng OTP.');
console.log('[BACKUP]', backupDir);
