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

// Seller cÃ³ thá»ƒ nháº­p link áº£nh tá»« nhiá»u nguá»“n, vÃ¬ váº­y CSP máº·c Ä‘á»‹nh cá»§a Helmet
// cáº§n táº¯t á»Ÿ báº£n MVP nÃ y Ä‘á»ƒ áº£nh/banner khÃ´ng bá»‹ cháº·n khi frontend Ä‘Æ°á»£c Express phá»¥c vá»¥.
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
  return callback(new Error(`CORS khÃ´ng cho phÃ©p domain: ${req.headers.origin}`));
}));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'FoodHub Luxury API Ä‘ang cháº¡y' });
});

// FH_AUTH_NO_STORE_V33: trÃ¡nh proxy/PWA giá»¯ pháº£n há»“i Ä‘Äƒng nháº­p cÅ©.
app.use('/api/auth', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}, authRoutes);
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
// API sai váº«n tráº£ JSON, khÃ´ng tráº£ nháº§m index.html.
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y API nÃ y' });
});

// Production: Express phá»¥c vá»¥ luÃ´n frontend Vite Ä‘Ã£ build.
// VÃ¬ tháº¿ route QR /shop/:slug/table/:token váº«n hoáº¡t Ä‘á»™ng khi má»Ÿ trá»±c tiáº¿p hoáº·c F5.
const frontendDist = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  // FH_PWA_CACHE_HEADERS_V33
  app.use(express.static(frontendDist, {
    index: false,
    setHeaders: (res, filePath) => {
      const fileName = path.basename(filePath);
      if (['sw.js', 'manifest.webmanifest', 'index.html'].includes(fileName)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return;
      }
      if (filePath.split(path.sep).includes('assets')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next();
    return res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      message: 'Backend Ä‘ang cháº¡y nhÆ°ng frontend chÆ°a build',
      instruction: 'Cháº¡y npm run build á»Ÿ thÆ° má»¥c gá»‘c trÆ°á»›c khi deploy production.'
    });
  });
}

app.use(errorHandler);

initRealtime(server, configuredOrigins);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  const databaseReady = await connectDB();
  if (!databaseReady && process.env.NODE_ENV === 'production') {
    console.error('Production báº¯t buá»™c pháº£i cÃ³ MongoDB. Server Ä‘Ã£ dá»«ng.');
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`Server Ä‘ang cháº¡y táº¡i http://localhost:${PORT}`);
    if (!databaseReady) {
      console.warn('Cháº¿ Ä‘á»™ giao diá»‡n: backend váº«n cháº¡y nhÆ°ng cÃ¡c API dá»¯ liá»‡u cáº§n MongoDB sáº½ chÆ°a dÃ¹ng Ä‘Æ°á»£c.');
    }
    if (fs.existsSync(frontendDist)) console.log('Frontend production Ä‘Ã£ Ä‘Æ°á»£c phá»¥c vá»¥ cÃ¹ng domain.');
  });
};

startServer();

