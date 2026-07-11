import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 12000,
  headers: {
    Accept: 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const next = config;
  const token = localStorage.getItem('multi_shop_token');
  if (token && !next.skipAuth) next.headers.Authorization = `Bearer ${token}`;

  if (String(next.url || '').startsWith('/auth/')) {
    next.headers['Cache-Control'] = 'no-cache';
    next.headers.Pragma = 'no-cache';
  }
  return next;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = Number(error?.response?.status || 0);
    const message = error.code === 'ECONNABORTED'
      ? 'Backend phản hồi quá lâu. Có thể máy chủ đang khởi động, hãy thử lại sau vài giây.'
      : (error?.response?.data?.message || error?.message || 'Có lỗi xảy ra');

    const appError = new Error(message);
    appError.status = status;
    appError.code = error?.code || '';
    appError.details = error?.response?.data || null;
    appError.isNetworkError = !status;
    return Promise.reject(appError);
  }
);

export default api;
