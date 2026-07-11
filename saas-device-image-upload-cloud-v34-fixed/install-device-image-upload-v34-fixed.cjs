const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const patchDir = __dirname;
const root = path.resolve(patchDir, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(root, 'patch-backups', `image-upload-v34-fixed-${stamp}`);

const paths = {
  server: 'backend/server.js',
  package: 'backend/package.json',
  seller: 'frontend/src/pages/SellerDashboard.jsx',
  createShop: 'frontend/src/pages/CreateShop.jsx'
};

for (const relative of [paths.server, paths.package, paths.seller]) {
  if (!fs.existsSync(path.join(root, relative))) {
    console.error(`[ERROR] Không tìm thấy ${relative}`);
    console.error(`[INFO] Giải nén thư mục ${path.basename(patchDir)} ngay trong thư mục gốc project.`);
    process.exit(1);
  }
}

fs.mkdirSync(backupDir, { recursive: true });

const backup = (relative) => {
  const source = path.join(root, relative);
  if (!fs.existsSync(source)) return;
  const target = path.join(backupDir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
};

const write = (relative, content) => {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
};

const copyPatchFile = (relative) => {
  const source = path.join(patchDir, 'files', relative);
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`[OK] Đồng bộ ${relative}`);
};

const insertImport = (source, importLine) => {
  if (source.includes(importLine)) return source;
  const imports = [...source.matchAll(/^import[^\n]+;\r?$/gm)];
  if (!imports.length) throw new Error('Không tìm thấy vùng import trong SellerDashboard.jsx');
  const last = imports[imports.length - 1];
  const position = last.index + last[0].length;
  return `${source.slice(0, position)}\n${importLine}${source.slice(position)}`;
};

const replaceFirstRegex = (source, regex, replacement, label, required = true) => {
  if (source.includes(replacement)) {
    console.log(`[SKIP] ${label} đã có`);
    return { source, changed: false };
  }
  if (!regex.test(source)) {
    if (required) throw new Error(`Không tìm thấy vị trí để sửa: ${label}`);
    console.log(`[WARN] Không tìm thấy vị trí tùy chọn: ${label}`);
    return { source, changed: false };
  }
  console.log(`[OK] ${label}`);
  return { source: source.replace(regex, replacement), changed: true };
};

try {
  [paths.server, paths.package, paths.seller, paths.createShop, 'backend/.env.example', '.gitignore'].forEach(backup);

  copyPatchFile('backend/middleware/imageUpload.js');
  copyPatchFile('backend/controllers/uploadController.js');
  copyPatchFile('backend/routes/uploadRoutes.js');
  copyPatchFile('frontend/src/components/ImageUploadField.jsx');

  // Backend: hoàn thiện phần mà bản v34 cũ dừng giữa chừng.
  {
    let source = fs.readFileSync(path.join(root, paths.server), 'utf8');

    if (!/const\s+path\s*=\s*require\(['"]path['"]\)/.test(source)) {
      source = source.replace(/require\(['"]dotenv['"]\)\.config\(\);?/, (match) => `${match}\nconst path = require('path');`);
      console.log('[OK] Thêm require path');
    }
    if (!/const\s+fs\s*=\s*require\(['"]fs['"]\)/.test(source)) {
      const pathRequire = /const\s+path\s*=\s*require\(['"]path['"]\);?/;
      if (!pathRequire.test(source)) throw new Error('Không tìm thấy require path để thêm require fs');
      source = source.replace(pathRequire, (match) => `${match}\nconst fs = require('fs');`);
      console.log('[OK] Thêm require fs');
    }

    if (!source.includes("require('./routes/uploadRoutes')")) {
      const routeRequires = [...source.matchAll(/^const\s+\w+Routes\s*=\s*require\(['"]\.\/routes\/[^'"]+['"]\);?\r?$/gm)];
      if (!routeRequires.length) throw new Error('Không tìm thấy vùng require routes trong backend/server.js');
      const last = routeRequires[routeRequires.length - 1];
      const pos = last.index + last[0].length;
      source = `${source.slice(0, pos)}\nconst uploadRoutes = require('./routes/uploadRoutes'); // FH_IMAGE_UPLOAD_V34${source.slice(pos)}`;
      console.log('[OK] Thêm uploadRoutes');
    }

    if (!source.includes('FH_IMAGE_UPLOAD_STATIC_V34')) {
      const staticBlock = `\n// FH_IMAGE_UPLOAD_STATIC_V34: fallback local khi chưa cấu hình Cloudinary.\nconst uploadsDir = path.resolve(__dirname, 'uploads');\nfs.mkdirSync(uploadsDir, { recursive: true });\napp.use('/uploads', express.static(uploadsDir, {\n  maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0\n}));\n`;

      const firstApiMount = source.search(/\napp\.use\(\s*['"]\/api\//);
      const apiFallback = source.search(/\napp\.use\(\s*['"]\/api['"]\s*,/);
      const frontendStatic = source.search(/\napp\.use\(\s*express\.static/);
      const candidates = [firstApiMount, apiFallback, frontendStatic].filter((value) => value >= 0);
      if (!candidates.length) throw new Error('Không tìm thấy vị trí an toàn để thêm static /uploads');
      const pos = Math.min(...candidates);
      source = `${source.slice(0, pos)}${staticBlock}${source.slice(pos)}`;
      console.log('[OK] Thêm static /uploads');
    }

    if (!source.includes("app.use('/api/uploads', uploadRoutes)")) {
      const mountLine = `\napp.use('/api/uploads', uploadRoutes); // FH_IMAGE_UPLOAD_V34\n`;
      const pushMount = /app\.use\(\s*['"]\/api\/push['"]\s*,\s*pushRoutes\s*\);?/;
      if (pushMount.test(source)) {
        source = source.replace(pushMount, (match) => `${match}${mountLine}`);
      } else {
        const apiFallback = source.search(/\napp\.use\(\s*['"]\/api['"]\s*,/);
        const frontendStatic = source.search(/\napp\.use\(\s*express\.static/);
        const candidates = [apiFallback, frontendStatic].filter((value) => value >= 0);
        if (!candidates.length) throw new Error('Không tìm thấy vị trí mount /api/uploads');
        const pos = Math.min(...candidates);
        source = `${source.slice(0, pos)}${mountLine}${source.slice(pos)}`;
      }
      console.log('[OK] Mount /api/uploads');
    }

    write(paths.server, source);
  }

  // SellerDashboard: thêm nút chọn ảnh cho sản phẩm, logo, banner và slider.
  {
    let source = fs.readFileSync(path.join(root, paths.seller), 'utf8');
    source = insertImport(source, "import ImageUploadField from '../components/ImageUploadField.jsx'; // FH_IMAGE_UPLOAD_V34");

    const productReplacement = `<ImageUploadField label="Ảnh sản phẩm (dán link hoặc chọn trong máy)" value={productForm.images} onChange={(images) => setProductForm({ ...productForm, images })} multiple maxFiles={8} kind="product" help="Tối đa 8 ảnh. Ảnh tải lên được giữ cùng các link đã nhập." />`;
    let result = replaceFirstRegex(
      source,
      /<label>\s*(?:Link ảnh[^<]*|Ảnh sản phẩm[^<]*)<\/label>\s*<textarea[\s\S]*?value=\{productForm\.images\}[\s\S]*?\/>/i,
      productReplacement,
      'Thêm nút chọn ảnh ở form sản phẩm'
    );
    source = result.source;

    const logoReplacement = `<ImageUploadField label="Logo cửa hàng (link hoặc ảnh trong máy)" value={shopForm.logoUrl || ''} onChange={(logoUrl) => setShopForm({ ...shopForm, logoUrl })} kind="shop-logo" />`;
    result = replaceFirstRegex(
      source,
      /<div(?:\s+className="fh-input-group")?>\s*<label>\s*(?:Link\s+)?Logo(?:\s*\(URL\)|\s+URL)?\s*<\/label>\s*<input[\s\S]*?value=\{shopForm\.logoUrl\s*\|\|\s*''\}[\s\S]*?\/>\s*<\/div>/i,
      logoReplacement,
      'Thêm nút chọn logo'
    );
    source = result.source;

    const bannerReplacement = `<ImageUploadField label="Banner ngang (link hoặc ảnh trong máy)" value={shopForm.bannerUrl || ''} onChange={(bannerUrl) => setShopForm({ ...shopForm, bannerUrl })} kind="shop-banner" />`;
    result = replaceFirstRegex(
      source,
      /<div(?:\s+className="fh-input-group")?>\s*<label>\s*(?:Link\s+)?Banner(?:\s+ngang)?(?:\s*\(URL\)|\s+URL)?\s*<\/label>\s*<input[\s\S]*?value=\{shopForm\.bannerUrl\s*\|\|\s*''\}[\s\S]*?\/>\s*<\/div>/i,
      bannerReplacement,
      'Thêm nút chọn banner'
    );
    source = result.source;

    const sliderReplacement = `<ImageUploadField key={number} label={\`Ảnh Slider \${number}\`} value={shopForm[\`backgroundImage\${number}\`] || ''} onChange={(imageUrl) => setShopForm({ ...shopForm, [\`backgroundImage\${number}\`]: imageUrl })} kind={\`shop-slider-\${number}\`} />`;
    result = replaceFirstRegex(
      source,
      /<div(?:\s+className="fh-input-group")?\s+key=\{number\}>\s*<label>\s*Ảnh\s+(?:nền|Slider)\s*\{number\}\s*<\/label>\s*<input[\s\S]*?backgroundImage[\s\S]*?\/>\s*<\/div>/i,
      sliderReplacement,
      'Thêm nút chọn 3 ảnh slider'
    );
    source = result.source;

    write(paths.seller, source);
  }

  // CreateShop là tùy chọn; không để lỗi ở đây làm dừng toàn bộ bộ cài.
  if (fs.existsSync(path.join(root, paths.createShop))) {
    let source = fs.readFileSync(path.join(root, paths.createShop), 'utf8');
    try {
      source = insertImport(source, "import ImageUploadField from '../components/ImageUploadField.jsx'; // FH_IMAGE_UPLOAD_V34");

      const logoReplacement = `<ImageUploadField label="Logo cửa hàng" value={form.logoUrl || ''} onChange={(logoUrl) => setForm({ ...form, logoUrl })} kind="shop-logo" />`;
      source = replaceFirstRegex(source, /<div>\s*<label>Logo URL<\/label>\s*<input[\s\S]*?value=\{form\.logoUrl\}[\s\S]*?\/>\s*<\/div>/i, logoReplacement, 'Upload logo khi tạo shop', false).source;

      const bannerReplacement = `<ImageUploadField label="Banner ngang" value={form.bannerUrl || ''} onChange={(bannerUrl) => setForm({ ...form, bannerUrl })} kind="shop-banner" />`;
      source = replaceFirstRegex(source, /<div>\s*<label>Banner URL<\/label>\s*<input[\s\S]*?value=\{form\.bannerUrl\}[\s\S]*?\/>\s*<\/div>/i, bannerReplacement, 'Upload banner khi tạo shop', false).source;

      write(paths.createShop, source);
    } catch (optionalError) {
      console.log(`[WARN] Không vá CreateShop.jsx: ${optionalError.message}`);
    }
  }

  // Cấu hình môi trường và thư mục local fallback.
  {
    const relative = 'backend/.env.example';
    const target = path.join(root, relative);
    let source = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (!source.includes('CLOUDINARY_CLOUD_NAME=')) {
      source += `${source.endsWith('\n') || !source ? '' : '\n'}\n# Lưu ảnh upload lâu dài trên Cloudinary\nCLOUDINARY_CLOUD_NAME=\nCLOUDINARY_API_KEY=\nCLOUDINARY_API_SECRET=\nCLOUDINARY_FOLDER=foodhub\n`;
      write(relative, source);
      console.log('[OK] Bổ sung Cloudinary vào .env.example');
    }

    const gitignorePath = path.join(root, '.gitignore');
    let gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    if (!gitignore.includes('backend/uploads/*')) {
      gitignore += `${gitignore.endsWith('\n') || !gitignore ? '' : '\n'}\nbackend/uploads/*\n!backend/uploads/.gitkeep\n`;
      write('.gitignore', gitignore);
    }
    fs.mkdirSync(path.join(root, 'backend/uploads'), { recursive: true });
    fs.writeFileSync(path.join(root, 'backend/uploads/.gitkeep'), '', 'utf8');
  }

  console.log('[INFO] Kiểm tra/cài multer và cloudinary...');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, paths.package), 'utf8'));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (!deps.multer || !deps.cloudinary) {
    const install = spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['install', 'multer', 'cloudinary', '--save', '--no-audit', '--no-fund'],
      { cwd: path.join(root, 'backend'), stdio: 'inherit' }
    );
    if (install.status !== 0) throw new Error('npm install multer cloudinary thất bại');
  } else {
    console.log('[SKIP] multer và cloudinary đã có trong package.json');
  }

  const syntax = spawnSync(process.execPath, ['--check', path.join(root, paths.server)], { stdio: 'inherit' });
  if (syntax.status !== 0) throw new Error('backend/server.js còn lỗi cú pháp');

  console.log('');
  console.log('================================================');
  console.log('[DONE] Đã hoàn tất upload ảnh v34 fixed');
  console.log(`[BACKUP] ${backupDir}`);
  console.log('[NEXT] cd backend && npm run dev');
  console.log('[NEXT] terminal khác: cd frontend && npm run dev');
  console.log('================================================');
} catch (error) {
  console.error('');
  console.error(`[ERROR] ${error.message}`);
  console.error(`[BACKUP] ${backupDir}`);
  process.exit(1);
}
