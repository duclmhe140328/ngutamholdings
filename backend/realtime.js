const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Shop = require('./models/Shop');

let io = null;

const normalize = (value) => String(value || '').trim().replace(/\/$/, '');

const initRealtime = (httpServer, configuredOrigins = []) => {
  const allowed = configuredOrigins.map(normalize).filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    },
    allowRequest(req, callback) {
      const origin = normalize(req.headers.origin);
      if (!origin) return callback(null, true);

      const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
      const protocol = forwardedProto || (req.socket.encrypted ? 'https' : 'http');
      const ownOrigin = req.headers.host ? normalize(`${protocol}://${req.headers.host}`) : '';

      return callback(null, origin === ownOrigin || allowed.includes(origin));
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next();
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-passwordHash');
      if (!user || !user.isActive) return next(new Error('Unauthorized'));
      socket.user = user;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    if (socket.user?.role === 'admin') socket.join('admins');

    if (socket.user?.role === 'seller') {
      const shop = await Shop.findOne({ ownerId: socket.user._id }).select('_id');
      if (shop) socket.join(`shop:${shop._id}`);
    }

    socket.on('join:customer', ({ shopId, customerSessionId }) => {
      if (shopId && customerSessionId) {
        socket.join(`customer:${shopId}:${customerSessionId}`);
      }
    });
  });

  return io;
};

const emitToShop = (shopId, event, payload) => {
  if (io && shopId) io.to(`shop:${shopId}`).emit(event, payload);
};

const emitToAdmins = (event, payload) => {
  if (io) io.to('admins').emit(event, payload);
};

const emitToCustomer = (shopId, customerSessionId, event, payload) => {
  if (io && shopId && customerSessionId) {
    io.to(`customer:${shopId}:${customerSessionId}`).emit(event, payload);
  }
};

module.exports = { initRealtime, emitToShop, emitToAdmins, emitToCustomer };
