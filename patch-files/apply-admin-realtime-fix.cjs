const fs = require('fs');
const path = require('path');

const root = process.cwd();
const backupDir = path.join(root, 'patch-backups', `admin-realtime-v13-${Date.now()}`);
fs.mkdirSync(backupDir, { recursive: true });

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'build', '.git', 'patch-backups'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(jsx|tsx|js|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function backup(file) {
  const rel = path.relative(root, file);
  const dest = path.join(backupDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
}

const files = walk(root);
const sellerFile = files.find((file) => {
  const text = fs.readFileSync(file, 'utf8');
  return text.includes('const fetchAdminChat')
    && text.includes('ConversationWorkspace conversations={adminThreads}')
    && text.includes("socket.on('chat:seller'");
});

if (!sellerFile) {
  console.error('[ERROR] Cannot find SellerDashboard file.');
  console.error('Search terms: fetchAdminChat + adminThreads + socket.on chat:seller');
  process.exit(1);
}

let text = fs.readFileSync(sellerFile, 'utf8');
backup(sellerFile);

const start = text.indexOf('    const onAdminChat =');
const end = text.indexOf('    const onApproval =', start);
if (start === -1 || end === -1) {
  console.error('[ERROR] Cannot locate onAdminChat block.');
  process.exit(1);
}

const newOnAdminChat = `    const onAdminChat = (payload = {}) => {
      const conversation = payload.conversation
        || payload.thread
        || payload.chat
        || payload.data?.conversation
        || payload.data?.thread
        || null;
      const notification = payload.notification || payload.data?.notification || {};

      if (!conversation || !conversation._id) {
        fetchAdminChat();
        refreshUnreadCounts();
        return;
      }

      const conversationType = conversation.type
        || conversation.chatType
        || conversation.channel
        || payload.type
        || payload.chatType
        || payload.channel
        || '';

      if (conversationType && !['shop_admin', 'seller_admin', 'admin_shop'].includes(String(conversationType))) {
        return;
      }

      const opened = tab === 'admin-chat' && activeAdminId === conversation._id;
      const next = opened ? { ...conversation, unreadForSeller: 0 } : conversation;
      setAdminThreads((current) => upsertFirst(current, next, 5));
      setActiveAdminId(conversation._id);
      if (opened) api.post(\`/chat/seller/\${conversation._id}/read\`).catch(() => {});
      else {
        setToast(notification?.title || 'Admin tong vua tra loi');
        if (soundEnabled) playMessageSound();
        const lastMessage = conversation.lastMessage?.text
          || conversation.lastMessage
          || payload.message?.text
          || payload.text
          || 'Ban co tin nhan moi tu Admin tong';
        showMessageNotification({
          title: notification?.title || 'Admin tong vua tra loi',
          body: notification?.body || lastMessage,
          tag: \`seller-admin-\${conversation._id}\`,
          url: \`\${window.location.origin}/dashboard\`
        });
      }
      refreshUnreadCounts();
    };
`;

text = text.slice(0, start) + newOnAdminChat + text.slice(end);

const oldSocketBlock = `    socket.on('order:new', onNewOrder);
    socket.on('order:updated', onOrderUpdated);
    socket.on('chat:customer', onCustomerChat);
    socket.on('chat:seller', onAdminChat);
    socket.on('shop:approval', onApproval);
    return () => {
      socket.off('order:new', onNewOrder); socket.off('order:updated', onOrderUpdated); socket.off('chat:customer', onCustomerChat); socket.off('chat:seller', onAdminChat); socket.off('shop:approval', onApproval);
    };`;

const newSocketBlock = `    const adminRealtimeEvents = [
      'chat:seller',
      'chat:admin',
      'chat:shop_admin',
      'shop_admin:message',
      'admin:message',
      'seller:admin-message',
      'conversation:updated',
      'message:new'
    ];

    socket.on('order:new', onNewOrder);
    socket.on('order:updated', onOrderUpdated);
    socket.on('chat:customer', onCustomerChat);
    adminRealtimeEvents.forEach((eventName) => socket.on(eventName, onAdminChat));
    socket.on('shop:approval', onApproval);
    return () => {
      socket.off('order:new', onNewOrder);
      socket.off('order:updated', onOrderUpdated);
      socket.off('chat:customer', onCustomerChat);
      adminRealtimeEvents.forEach((eventName) => socket.off(eventName, onAdminChat));
      socket.off('shop:approval', onApproval);
    };`;

if (text.includes(oldSocketBlock)) {
  text = text.replace(oldSocketBlock, newSocketBlock);
} else if (!text.includes('adminRealtimeEvents')) {
  console.warn('[WARN] Could not replace exact socket block. Trying smaller replacement.');
  text = text.replace(
    "    socket.on('chat:seller', onAdminChat);",
    "    const adminRealtimeEvents = ['chat:seller', 'chat:admin', 'chat:shop_admin', 'shop_admin:message', 'admin:message', 'seller:admin-message', 'conversation:updated', 'message:new'];\n    adminRealtimeEvents.forEach((eventName) => socket.on(eventName, onAdminChat));"
  );
  text = text.replace(
    "socket.off('chat:seller', onAdminChat);",
    "adminRealtimeEvents.forEach((eventName) => socket.off(eventName, onAdminChat));"
  );
}

fs.writeFileSync(sellerFile, text, 'utf8');
console.log('[OK] Patched frontend seller admin realtime listener:');
console.log('     ' + path.relative(root, sellerFile));
console.log('[OK] Backup saved to: ' + path.relative(root, backupDir));
console.log('');
console.log('If admin replies still require reload, patch backend emit:');
console.log("  io.to(<seller/shop room>).emit('chat:seller', { conversation, notification })");
