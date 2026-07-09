const fs = require('fs');
const path = require('path');

const root = process.cwd();
const target = path.join(root, 'frontend', 'src', 'pages', 'ShopPage.jsx');
if (!fs.existsSync(target)) {
  console.error('[ERR] Cannot find frontend/src/pages/ShopPage.jsx. Run installer from project root.');
  process.exit(1);
}

const backupDir = path.join(root, 'patch-backups', `mobile-order-category-v24-${Date.now()}`);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(target, path.join(backupDir, 'ShopPage.jsx'));

let code = fs.readFileSync(target, 'utf8');

const styleBlock = `
      <style>{` + '`' + `
        .food-mobile-category-tools { display: none; }
        @media (max-width: 768px) {
          .food-mobile-category-tools {
            display: block;
            position: sticky;
            top: 68px;
            z-index: 980;
            background: rgba(255,255,255,.96);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom: 1px solid rgba(226,232,240,.95);
            box-shadow: 0 12px 24px rgba(15,23,42,.08);
            padding: 10px 0 9px;
          }
          .food-mobile-category-inner {
            width: min(100% - 22px, 1180px);
            margin: 0 auto;
          }
          .food-mobile-category-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
          }
          .food-mobile-category-head b {
            color: #0f172a;
            font-size: 14px;
            font-weight: 900;
          }
          .food-mobile-category-head span {
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
          }
          .food-mobile-category-scroll {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            scroll-snap-type: x proximity;
            padding: 1px 2px 3px;
            margin: 0 -2px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .food-mobile-category-scroll::-webkit-scrollbar { display: none; }
          .food-mobile-category-pill {
            border: 1px solid #e2e8f0;
            background: #fff;
            color: #334155;
            border-radius: 999px;
            padding: 9px 12px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
            scroll-snap-align: start;
            font-size: 13px;
            font-weight: 850;
            min-height: 38px;
            box-shadow: 0 5px 14px rgba(15,23,42,.05);
          }
          .food-mobile-category-pill em {
            font-style: normal;
            min-width: 22px;
            height: 22px;
            padding: 0 7px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            background: #f1f5f9;
            color: #64748b;
            font-size: 11px;
            font-weight: 900;
          }
          .food-mobile-category-pill.active {
            border-color: var(--food-brand);
            background: var(--food-brand);
            color: #fff;
            box-shadow: 0 10px 22px color-mix(in srgb, var(--food-brand) 30%, transparent);
          }
          .food-mobile-category-pill.active em {
            background: rgba(255,255,255,.22);
            color: #fff;
          }
          .food-store-main {
            scroll-margin-top: 128px;
          }
        }
      ` + '`' + `}</style>`;

const mobileCategoryBlock = `
      {/* FH_MOBILE_CATEGORY_BAR: danh mục mobile cho trang order */}
      <section className="food-mobile-category-tools" aria-label="Danh mục sản phẩm trên mobile">
        <div className="food-mobile-category-inner">
          <div className="food-mobile-category-head">
            <b>Danh mục</b>
            <span>{filtered.length} / {products.length} sản phẩm</span>
          </div>
          <div className="food-mobile-category-scroll">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? 'food-mobile-category-pill active' : 'food-mobile-category-pill'}
                onClick={() => {
                  setCategory(item);
                  window.setTimeout(() => document.getElementById('food-menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
                }}
              >
                <span>{item === 'all' ? 'Tất cả sản phẩm' : item}</span>
                <em>{item === 'all' ? products.length : products.filter((product) => product.category === item).length}</em>
              </button>
            ))}
          </div>
        </div>
      </section>
`;

if (!code.includes('FH_MOBILE_CATEGORY_BAR')) {
  const marker = '      <main className="container food-store-main" id="food-menu">';
  if (!code.includes(marker)) {
    console.error('[ERR] Cannot find <main className="container food-store-main" id="food-menu"> marker in ShopPage.jsx');
    process.exit(1);
  }
  code = code.replace(marker, `${mobileCategoryBlock}\n${marker}`);
  console.log('[OK] Added mobile category bar');
} else {
  console.log('[SKIP] Mobile category bar already exists');
}

if (!code.includes('.food-mobile-category-tools')) {
  const returnMarker = `<div className="food-store-page" style={{ '--food-brand': shop.themeColor || '#ee4d2d' }}>`;
  if (!code.includes(returnMarker)) {
    console.error('[ERR] Cannot find food-store-page root marker in ShopPage.jsx');
    process.exit(1);
  }
  code = code.replace(returnMarker, `${returnMarker}\n${styleBlock}`);
  console.log('[OK] Added mobile category CSS');
} else {
  console.log('[SKIP] Mobile category CSS already exists');
}

fs.writeFileSync(target, code, 'utf8');
console.log('[DONE] Mobile order page now shows "Tất cả sản phẩm" and categories on mobile.');
console.log('[BACKUP]', backupDir);
