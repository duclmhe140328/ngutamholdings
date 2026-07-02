const fs = require('fs');
const path = require('path');

const root = process.cwd();

function log(msg) { console.log(`[v12] ${msg}`); }
function fail(msg) { console.error(`[v12 ERROR] ${msg}`); process.exit(1); }

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'build', '.git', 'patch-backups', 'patch-files'].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/SellerDashboard\.(jsx|js|tsx|ts)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const candidates = walk(root);
if (!candidates.length) fail('Cannot find SellerDashboard.jsx/js. Run this from project root.');

const target = candidates.find(p => p.includes(`${path.sep}frontend${path.sep}`)) || candidates[0];
log(`Patching: ${path.relative(root, target)}`);

let src = fs.readFileSync(target, 'utf8');
const original = src;

const backupDir = path.join(root, 'patch-backups', `admin-chat-v12-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, path.basename(target)), original, 'utf8');
log(`Backup saved: ${path.relative(root, backupDir)}`);

// 1) Add placeholder constants after toParams helper.
const marker = `const toParams = (filters, page, limit = 12) => Object.fromEntries(Object.entries({ ...filters, page, limit }).filter(([, value]) => value !== '' && value !== null && value !== undefined && value !== false));`;
const constants = `const toParams = (filters, page, limit = 12) => Object.fromEntries(Object.entries({ ...filters, page, limit }).filter(([, value]) => value !== '' && value !== null && value !== undefined && value !== false));

const PLATFORM_ADMIN_CONVERSATION_ID = 'platform-admin-foodhub';
const createPlatformAdminConversation = () => ({
  _id: PLATFORM_ADMIN_CONVERSATION_ID,
  type: 'shop_admin',
  title: 'Admin tổng FoodHub',
  adminName: 'Admin tổng FoodHub',
  lastMessage: 'Kênh hỗ trợ chính thức từ Admin tổng. Nhập tin nhắn để bắt đầu trao đổi.',
  lastMessageAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  unreadForSeller: 0,
  messages: [],
  isPlatformAdminPlaceholder: true
});`;
if (!src.includes('PLATFORM_ADMIN_CONVERSATION_ID')) {
  if (!src.includes(marker)) fail('Cannot find toParams marker to insert placeholder constants.');
  src = src.replace(marker, constants);
  log('Added platform admin placeholder constants.');
} else {
  log('Placeholder constants already exist.');
}

// 2) Replace fetchAdminChat block.
const fetchAdminOld = `  const fetchAdminChat = async () => {
    try {
      const res = await api.get('/chat/seller', { params: { type: 'shop_admin', page: 1, limit: 5 } });
      const list = res.data.conversations || [];
      setAdminThreads(list);
      setUnreadTotals(res.data.unreadTotals || { customer_shop: 0, shop_admin: 0 });
      setActiveAdminId(list[0]?._id || '');
    } catch (err) { showError(err); }
  };`;
const fetchAdminNew = `  const fetchAdminChat = async () => {
    try {
      const res = await api.get('/chat/seller', { params: { type: 'shop_admin', page: 1, limit: 5 } });
      const list = res.data.conversations || [];
      const safeList = list.length ? list : [createPlatformAdminConversation()];
      setAdminThreads(safeList);
      setUnreadTotals(res.data.unreadTotals || { customer_shop: 0, shop_admin: 0 });
      setActiveAdminId((current) => current && safeList.some((item) => item._id === current) ? current : safeList[0]?._id || PLATFORM_ADMIN_CONVERSATION_ID);
    } catch (err) {
      setAdminThreads([createPlatformAdminConversation()]);
      setActiveAdminId(PLATFORM_ADMIN_CONVERSATION_ID);
      showError(err);
    }
  };`;
if (src.includes(fetchAdminOld)) {
  src = src.replace(fetchAdminOld, fetchAdminNew);
  log('Updated fetchAdminChat to always show Admin tong.');
} else if (!src.includes('const safeList = list.length ? list : [createPlatformAdminConversation()]')) {
  fail('Cannot replace fetchAdminChat automatically. Send this file so it can be patched manually.');
} else {
  log('fetchAdminChat already patched.');
}

// 3) Remove placeholder when a real admin conversation arrives over socket.
const socketOld = `      setAdminThreads((current) => upsertFirst(current, next, 5));`;
const socketNew = `      setAdminThreads((current) => upsertFirst(current.filter((item) => item._id !== PLATFORM_ADMIN_CONVERSATION_ID), next, 5));`;
if (src.includes(socketOld)) {
  src = src.replace(socketOld, socketNew);
  log('Updated socket admin chat merge.');
}

// 4) markAdminRead: do not call read API for placeholder.
const markOld = `  const markAdminRead = async (thread) => {
    setActiveAdminId(thread._id);
    if (!thread.unreadForSeller) return;
    setAdminThreads((current) => current.map((item) => item._id === thread._id ? { ...item, unreadForSeller: 0 } : item));
    try { const res = await api.post(\`/chat/seller/\${thread._id}/read\`); setAdminThreads((current) => mergeById(current, res.data.conversation)); } catch { }
    refreshUnreadCounts();
  };`;
const markNew = `  const markAdminRead = async (thread) => {
    setActiveAdminId(thread._id);
    if (thread.isPlatformAdminPlaceholder) return;
    if (!thread.unreadForSeller) return;
    setAdminThreads((current) => current.map((item) => item._id === thread._id ? { ...item, unreadForSeller: 0 } : item));
    try { const res = await api.post(\`/chat/seller/\${thread._id}/read\`); setAdminThreads((current) => mergeById(current, res.data.conversation)); } catch { }
    refreshUnreadCounts();
  };`;
if (src.includes(markOld)) {
  src = src.replace(markOld, markNew);
  log('Updated markAdminRead for placeholder.');
} else if (!src.includes('thread.isPlatformAdminPlaceholder')) {
  fail('Cannot replace markAdminRead automatically.');
}

// 5) sendAdmin: when first message creates real conversation, remove placeholder.
const sendOld = `  const sendAdmin = async () => {
    const text = adminMessage.trim(); if (!text) return;
    try { const res = await api.post('/chat/seller/admin', { text }); setAdminThreads((current) => upsertFirst(current, { ...res.data.conversation, unreadForSeller: 0 }, 5)); setActiveAdminId(res.data.conversation._id); setAdminMessage(''); refreshUnreadCounts(); } catch (err) { showError(err); }
  };`;
const sendNew = `  const sendAdmin = async () => {
    const text = adminMessage.trim(); if (!text) return;
    try {
      const res = await api.post('/chat/seller/admin', { text });
      setAdminThreads((current) => upsertFirst(current.filter((item) => item._id !== PLATFORM_ADMIN_CONVERSATION_ID), { ...res.data.conversation, unreadForSeller: 0 }, 5));
      setActiveAdminId(res.data.conversation._id);
      setAdminMessage('');
      refreshUnreadCounts();
    } catch (err) { showError(err); }
  };`;
if (src.includes(sendOld)) {
  src = src.replace(sendOld, sendNew);
  log('Updated sendAdmin to replace placeholder with real conversation.');
} else if (!src.includes("current.filter((item) => item._id !== PLATFORM_ADMIN_CONVERSATION_ID)")) {
  fail('Cannot replace sendAdmin automatically.');
}

// 6) Make title/subtitle dynamic if possible.
const convoOld = `titleFor={() => 'Admin tổng FoodHub'} subtitleFor={() => 'Hỗ trợ nền tảng · Realtime'}`;
const convoNew = `titleFor={(thread) => thread?.title || thread?.adminName || 'Admin tổng FoodHub'} subtitleFor={(thread) => thread?.isPlatformAdminPlaceholder ? 'Luôn sẵn sàng hỗ trợ shop mới' : 'Hỗ trợ nền tảng · Realtime'}`;
if (src.includes(convoOld)) {
  src = src.replace(convoOld, convoNew);
  log('Updated admin chat title/subtitle.');
}

if (src === original) {
  log('No changes needed.');
} else {
  fs.writeFileSync(target, src, 'utf8');
  log('Patch completed.');
}

console.log('Next steps: npm run dev/build and test a newly created shop dashboard.');
