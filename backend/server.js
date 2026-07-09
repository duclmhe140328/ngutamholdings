const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { initRealtime } = require('./realtime');
const revenueRoutes = require('./routes/revenueRoutes');
const authRoutes = require('./routes/authRoutes');
const shopRoutes = require('./routes/shopRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes');
const tableRoutes = require('./routes/tableRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const loyaltyRoutes = require('./routes/loyaltyRoutes');
const platformMarketingRoutes = require('./routes/platformMarketingRoutes');
const diningSessionRoutes = require('./routes/diningSessionRoutes');
const pushRoutes = require('./routes/pushRoutes');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

// Seller có thể nhập link ảnh từ nhiều nguồn, vì vậy CSP mặc định của Helmet
// cần tắt ở bản MVP này để ảnh/banner không bị chặn khi frontend được Express phục vụ.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

const configuredOrigins = String(process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

const requestOriginAllowed = (req) => {
  const origin = String(req.headers.origin || '').replace(/\/$/, '');
  if (!origin) return true;

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = req.get('host');
  const sameOrigin = host ? `${protocol}://${host}`.replace(/\/$/, '') : '';

  return origin === sameOrigin || configuredOrigins.includes(origin);
};

app.use(cors((req, callback) => {
  if (requestOriginAllowed(req)) {
    return callback(null, { origin: true, credentials: true });
  }
  return callback(new Error(`CORS không cho phép domain: ${req.headers.origin}`));
}));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'FoodHub Luxury API đang chạy' });
});

app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/platform', platformMarketingRoutes);
app.use('/api/dining-sessions', diningSessionRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/revenue', revenueRoutes);
// API sai vẫn trả JSON, không trả nhầm index.html.
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Không tìm thấy API này' });
});

// Production: Express phục vụ luôn frontend Vite đã build.
// Vì thế route QR /shop/:slug/table/:token vẫn hoạt động khi mở trực tiếp hoặc F5.
const frontendDist = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    index: false
  }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next();
    return res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      message: 'Backend đang chạy nhưng frontend chưa build',
      instruction: 'Chạy npm run build ở thư mục gốc trước khi deploy production.'
    });
  });
}

app.use(errorHandler);

initRealtime(server, configuredOrigins);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  const databaseReady = await connectDB();
  if (!databaseReady && process.env.NODE_ENV === 'production') {
    console.error('Production bắt buộc phải có MongoDB. Server đã dừng.');
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
    if (!databaseReady) {
      console.warn('Chế độ giao diện: backend vẫn chạy nhưng các API dữ liệu cần MongoDB sẽ chưa dùng được.');
    }
    if (fs.existsSync(frontendDist)) console.log('Frontend production đã được phục vụ cùng domain.');
  });
};

startServer();
