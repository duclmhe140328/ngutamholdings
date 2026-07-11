import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'multi_shop_token';
const USER_KEY = 'multi_shop_user';
const AUTH_CHANNEL = 'ngutam-auth-v33';

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

const writeAuth = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearStoredAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);
  const [authWarning, setAuthWarning] = useState('');

  const announce = useCallback((type, payload = null) => {
    try {
      const channel = new BroadcastChannel(AUTH_CHANNEL);
      channel.postMessage({ type, payload });
      channel.close();
    } catch {
      // Trình duyệt cũ vẫn được đồng bộ qua storage event.
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
    setAuthWarning('');
    announce('logout');
  }, [announce]);

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return undefined;
    }

    api.get('/auth/me', {
      timeout: 15000,
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
    }).then((res) => {
      if (!alive) return;
      setUser(res.data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
      setAuthWarning('');
    }).catch((error) => {
      if (!alive) return;
      // Chỉ xóa đăng nhập khi server xác nhận token sai/hết hạn.
      // Mất mạng hoặc backend đang ngủ không được tự đăng xuất người dùng.
      if ([401, 403].includes(Number(error.status || 0))) {
        clearStoredAuth();
        setUser(null);
      } else {
        setUser(readStoredUser());
        setAuthWarning('Đang dùng phiên đã lưu vì máy chủ chưa phản hồi. Dữ liệu sẽ tự tải lại khi có mạng.');
      }
    }).finally(() => {
      if (alive) setLoading(false);
    });

    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const syncFromStorage = (event) => {
      if (event.key && ![TOKEN_KEY, USER_KEY].includes(event.key)) return;
      const token = localStorage.getItem(TOKEN_KEY);
      setUser(token ? readStoredUser() : null);
    };
    window.addEventListener('storage', syncFromStorage);

    let channel = null;
    try {
      channel = new BroadcastChannel(AUTH_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data?.type === 'logout') setUser(null);
        if (event.data?.type === 'login') setUser(event.data.payload || readStoredUser());
      };
    } catch {
      channel = null;
    }

    return () => {
      window.removeEventListener('storage', syncFromStorage);
      channel?.close();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const res = await api.post('/auth/login', {
      email: normalizedEmail,
      password: String(password || '')
    }, { skipAuth: true });

    writeAuth(res.data.token, res.data.user);
    setUser(res.data.user);
    setAuthWarning('');
    announce('login', res.data.user);
    return res.data.user;
  }, [announce]);

  const register = useCallback(async ({ name, email, phone, password }) => {
    const res = await api.post('/auth/register', {
      name: String(name || '').trim(),
      email: String(email || '').trim().toLowerCase(),
      phone: String(phone || '').trim(),
      password: String(password || '')
    }, { skipAuth: true });

    writeAuth(res.data.token, res.data.user);
    setUser(res.data.user);
    setAuthWarning('');
    announce('login', res.data.user);
    return res.data.user;
  }, [announce]);

  const value = useMemo(() => ({
    user,
    loading,
    authWarning,
    login,
    register,
    logout,
    isLoggedIn: Boolean(user)
  }), [user, loading, authWarning, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
