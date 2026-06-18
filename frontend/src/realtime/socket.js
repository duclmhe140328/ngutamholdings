import { io } from 'socket.io-client';

let socket;

export const getSocket = () => {
  if (!socket) {
    const configuredUrl = (import.meta.env.VITE_SOCKET_URL || '').trim();
    const serverUrl = configuredUrl || window.location.origin;
    socket = io(serverUrl, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: { token: localStorage.getItem('multi_shop_token') || '' }
    });
  }
  socket.auth = { token: localStorage.getItem('multi_shop_token') || '' };
  return socket;
};

export const connectSocket = () => {
  const instance = getSocket();
  if (!instance.connected) instance.connect();
  return instance;
};
