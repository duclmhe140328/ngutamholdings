import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios.js';

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem('multi_shop_user');
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem('multi_shop_user');
    localStorage.removeItem('multi_shop_token');
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('multi_shop_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        localStorage.setItem('multi_shop_user', JSON.stringify(res.data.user));
      })
      .catch(() => {
        localStorage.removeItem('multi_shop_token');
        localStorage.removeItem('multi_shop_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('multi_shop_token', res.data.token);
    localStorage.setItem('multi_shop_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async ({ name, email, phone, password }) => {
    const res = await api.post('/auth/register', { name, email, phone, password });
    localStorage.setItem('multi_shop_token', res.data.token);
    localStorage.setItem('multi_shop_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('multi_shop_token');
    localStorage.removeItem('multi_shop_user');
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout, isLoggedIn: Boolean(user) }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
