const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const patchDir = __dirname;
const root = path.resolve(patchDir, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(root, 'patch-backups', `image-upload-v34-${stamp}`);

const required = [
  'backend/server.js',
  'backend/package.json',
  'frontend/src/pages/SellerDashboard.jsx',
  'frontend/src/pages/CreateShop.jsx'
];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) {
    console.error(`[ERROR] Không tìm thấy ${relative}`);
    console.error(`[INFO] Hãy đặt thư mục ${path.basename(patchDir)} ngay trong thư mục gốc project rồi chạy lại.`);
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
  console.log(`[OK] Tạo ${relative}`);
};

const replaceOnce = (source, oldText, newText, label) => {
  if (source.includes(newText)) {
    console.log(`[SKIP] ${label} đã có`);
    return source;
  }
  if (!source.includes(oldText)) {
    throw new Error(`Không tìm thấy vị trí để sửa: ${label}`);
  }
  console.log(`[OK] ${label}`);
  return source.replace(oldText, newText);
};

try {
  required.forEach(backup);

  copyPatchFile('backend/middleware/imageUpload.js');
  copyPatchFile('backend/controllers/uploadController.js');
  copyPatchFile('backend/routes/uploadRoutes.js');
  copyPatchFile('frontend/src/components/ImageUploadField.jsx');

  // Patch backend/server.js
  {
    const relative = 'backend/server.js';
    let source = fs.readFileSync(path.join(root, relative), 'utf8');

    if (!source.includes("require('./routes/uploadRoutes')")) {
      const anchor = "const pushRoutes = require('./routes/pushRoutes');";
      if (!source.includes(anchor)) throw new Error('Không tìm thấy pushRoutes trong backend/server.js');
      source = source.replace(anchor, `${anchor}\nconst uploadRoutes = require('./routes/uploadRoutes'); // FH_IMAGE_UPLOAD_V34`);
      console.log('[OK] Thêm uploadRoutes vào server');
    }

    if (!source.includes('FH_IMAGE_UPLOAD_STATIC_V34')) {
      const anchor = "app.get('/api/health', (req, res) => {\n  res.json({ ok: true, message: 'FoodHub Luxury API đang chạy' });\n});";
      if (!source.includes(anchor)) throw new Error('Không tìm thấy route /api/health trong backend/server.js');
      const block = `${anchor}\n\n// FH_IMAGE_UPLOAD_STATIC_V34: fallback lưu ảnh local khi chưa cấu hình Cloudinary.\nconst uploadsDir = path.resolve(__dirname, 'uploads');\nfs.mkdirSync(uploadsDir, { recursive: true });\napp.use('/uploads', express.static(uploadsDir, {\n  maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,\n  immutable: process.env.NODE_ENV === 'production'\n}));`;
      source = source.replace(anchor, block);
      console.log('[OK] Thêm static /uploads');
    }

    if (!source.includes("app.use('/api/uploads', uploadRoutes)")) {
      const anchor = "app.use('/api/push', pushRoutes);";
      if (!source.includes(anchor)) throw new Error('Không tìm thấy app.use /api/push trong backend/server.js');
      source = source.replace(anchor, `${anchor}\napp.use('/api/uploads', uploadRoutes); // FH_IMAGE_UPLOAD_V34`);
      console.log('[OK] Mount API upload');
    }

    write(relative, source);
  }

  // Patch SellerDashboard.jsx
  {
    const relative = 'frontend/src/pages/SellerDashboard.jsx';
    let source = fs.readFileSync(path.join(root, relative), 'utf8');

    if (!source.includes("../components/ImageUploadField.jsx")) {
      const anchor = "import LoyaltyManager from '../components/LoyaltyManager.jsx';";
      if (!source.includes(anchor)) throw new Error('Không tìm thấy import LoyaltyManager trong SellerDashboard.jsx');
      source = source.replace(anchor, `${anchor}\nimport ImageUploadField from '../components/ImageUploadField.jsx'; // FH_IMAGE_UPLOAD_V34`);
      console.log('[OK] Import ImageUploadField vào SellerDashboard');
    }

    const oldProduct = `                <div className="fh-input-group">\n                  <label>Link ảnh (Mỗi link một dòng)</label>\n                  <textarea rows="3" value={productForm.images} onChange={(e) => setProductForm({ ...productForm, images:e.target.value })} placeholder="https://..." />\n                </div>`;
    const newProduct = `                {/* FH_IMAGE_UPLOAD_V34: vừa dán link vừa chọn nhiều ảnh từ thiết bị */}\n                <ImageUploadField\n                  label="Ảnh sản phẩm (dán link hoặc chọn trong máy)"\n                  value={productForm.images}\n                  onChange={(images) => setProductForm({ ...productForm, images })}\n                  multiple\n                  maxFiles={8}\n                  kind="product"\n                  help="Tối đa 8 ảnh, mỗi ảnh 8MB. Ảnh tải lên sẽ được thêm cùng các link đang có."\n                />`;
    source = replaceOnce(source, oldProduct, newProduct, 'Thêm upload ảnh sản phẩm');

    const oldShop = `                  <div className="fh-grid-2">\n                    <div className="fh-input-group"><label>Link Logo (URL)</label><input value={shopForm.logoUrl || ''} onChange={(e) => setShopForm({ ...shopForm, logoUrl:e.target.value })} /></div>\n                    <div className="fh-input-group"><label>Link Banner ngang (URL)</label><input value={shopForm.bannerUrl || ''} onChange={(e) => setShopForm({ ...shopForm, bannerUrl:e.target.value })} /></div>\n                  </div>\n                  <div className="fh-grid-3">\n                    {[1,2,3].map((number) => (\n                      <div className="fh-input-group" key={number}><label>Ảnh Slider {number}</label><input value={shopForm[\`backgroundImage\${number}\`] || ''} onChange={(e) => setShopForm({ ...shopForm, [\`backgroundImage\${number}\`]:e.target.value })} /></div>\n                    ))}\n                  </div>`;
    const newShop = `                  {/* FH_IMAGE_UPLOAD_V34: URL và upload thiết bị hoạt động song song */}\n                  <div className="fh-grid-2">\n                    <ImageUploadField\n                      label="Logo cửa hàng"\n                      value={shopForm.logoUrl || ''}\n                      onChange={(logoUrl) => setShopForm({ ...shopForm, logoUrl })}\n                      kind="shop-logo"\n                    />\n                    <ImageUploadField\n                      label="Banner ngang"\n                      value={shopForm.bannerUrl || ''}\n                      onChange={(bannerUrl) => setShopForm({ ...shopForm, bannerUrl })}\n                      kind="shop-banner"\n                    />\n                  </div>\n                  <div className="fh-grid-3">\n                    {[1,2,3].map((number) => (\n                      <ImageUploadField\n                        key={number}\n                        label={\`Ảnh Slider \${number}\`}\n                        value={shopForm[\`backgroundImage\${number}\`] || ''}\n                        onChange={(imageUrl) => setShopForm({ ...shopForm, [\`backgroundImage\${number}\`]: imageUrl })}\n                        kind={\`shop-slider-\${number}\`}\n                      />\n                    ))}\n                  </div>`;
    source = replaceOnce(source, oldShop, newShop, 'Thêm upload logo/banner/slider trong SellerDashboard');

    write(relative, source);
  }

  // Patch CreateShop.jsx
  {
    const relative = 'frontend/src/pages/CreateShop.jsx';
    let source = fs.readFileSync(path.join(root, relative), 'utf8');

    if (!source.includes("../components/ImageUploadField.jsx")) {
      const anchor = "import MapPicker from '../components/MapPicker.jsx';";
      if (!source.includes(anchor)) throw new Error('Không tìm thấy import MapPicker trong CreateShop.jsx');
      source = source.replace(anchor, `${anchor}\nimport ImageUploadField from '../components/ImageUploadField.jsx'; // FH_IMAGE_UPLOAD_V34`);
      console.log('[OK] Import ImageUploadField vào CreateShop');
    }

    const oldCreateShop = `              <div className="form-grid two">\n                <div><label>Logo URL</label><input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." /></div>\n                <div><label>Banner URL</label><input value={form.bannerUrl} onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })} placeholder="https://..." /></div>\n              </div>\n              <label>Ba ảnh nền chạy như video</label>\n              <div className="form-grid three">\n                {[1,2,3].map((number) => <input key={number} value={form[\`backgroundImage\${number}\`]} onChange={(e) => setForm({ ...form, [\`backgroundImage\${number}\`]: e.target.value })} placeholder={\`Link ảnh nền \${number}\`} />)}\n              </div>`;
    const newCreateShop = `              {/* FH_IMAGE_UPLOAD_V34: có thể nhập URL hoặc tải ảnh trực tiếp */}\n              <div className="form-grid two">\n                <ImageUploadField\n                  label="Logo cửa hàng"\n                  value={form.logoUrl}\n                  onChange={(logoUrl) => setForm({ ...form, logoUrl })}\n                  kind="shop-logo"\n                />\n                <ImageUploadField\n                  label="Banner ngang"\n                  value={form.bannerUrl}\n                  onChange={(bannerUrl) => setForm({ ...form, bannerUrl })}\n                  kind="shop-banner"\n                />\n              </div>\n              <label>Ba ảnh nền chạy như video</label>\n              <div className="form-grid three">\n                {[1,2,3].map((number) => (\n                  <ImageUploadField\n                    key={number}\n                    label={\`Ảnh nền \${number}\`}\n                    value={form[\`backgroundImage\${number}\`]}\n                    onChange={(imageUrl) => setForm({ ...form, [\`backgroundImage\${number}\`]: imageUrl })}\n                    kind={\`shop-slider-\${number}\`}\n                  />\n                ))}\n              </div>`;
    source = replaceOnce(source, oldCreateShop, newCreateShop, 'Thêm upload logo/banner/slider khi tạo shop');

    write(relative, source);
  }

  // Update env example without touching real secrets.
  {
    const relative = 'backend/.env.example';
    backup(relative);
    const target = path.join(root, relative);
    let source = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (!source.includes('CLOUDINARY_CLOUD_NAME=')) {
      source += `${source.endsWith('\n') || !source ? '' : '\n'}\n# Lưu ảnh upload lâu dài trên Cloudinary (khuyến nghị khi deploy Render)\nCLOUDINARY_CLOUD_NAME=\nCLOUDINARY_API_KEY=\nCLOUDINARY_API_SECRET=\nCLOUDINARY_FOLDER=foodhub\n`;
      write(relative, source);
      console.log('[OK] Bổ sung biến Cloudinary vào backend/.env.example');
    }
  }

  // Keep local upload directory out of Git.
  {
    const relative = '.gitignore';
    backup(relative);
    const target = path.join(root, relative);
    let source = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (!source.includes('backend/uploads/')) {
      source += `${source.endsWith('\n') || !source ? '' : '\n'}\n# Ảnh local fallback; production nên dùng Cloudinary\nbackend/uploads/*\n!backend/uploads/.gitkeep\n`;
      write(relative, source);
      console.log('[OK] Cập nhật .gitignore');
    }
    fs.mkdirSync(path.join(root, 'backend/uploads'), { recursive: true });
    fs.writeFileSync(path.join(root, 'backend/uploads/.gitkeep'), '', 'utf8');
  }

  console.log('[INFO] Cài multer và cloudinary...');
  const install = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['install', 'multer', 'cloudinary', '--save', '--no-audit', '--no-fund'],
    { cwd: path.join(root, 'backend'), stdio: 'inherit' }
  );
  if (install.status !== 0) {
    throw new Error('npm install multer cloudinary thất bại. Kiểm tra mạng rồi chạy lại trong thư mục backend.');
  }

  const syntax = spawnSync(process.execPath, ['--check', path.join(root, 'backend/server.js')], { stdio: 'inherit' });
  if (syntax.status !== 0) throw new Error('backend/server.js còn lỗi cú pháp');

  console.log('');
  console.log('==============================================');
  console.log('[DONE] Đã cài upload ảnh từ thiết bị v34');
  console.log(`[BACKUP] ${backupDir}`);
  console.log('[NEXT] Chạy backend: cd backend && npm run dev');
  console.log('[NEXT] Chạy frontend: cd frontend && npm run dev');
  console.log('[PROD] Render nên cấu hình 3 biến CLOUDINARY_* để ảnh không mất sau redeploy.');
  console.log('==============================================');
} catch (error) {
  console.error('');
  console.error(`[ERROR] ${error.message}`);
  console.error(`[BACKUP] Các file cũ nằm tại: ${backupDir}`);
  process.exit(1);
}
