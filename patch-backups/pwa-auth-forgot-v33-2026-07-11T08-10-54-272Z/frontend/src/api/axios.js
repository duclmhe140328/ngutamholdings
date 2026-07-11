import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 8000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('multi_shop_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Backend phản hồi quá lâu. Hãy kiểm tra backend và MongoDB.'));
    }
    const message = error?.response?.data?.message || error?.message || 'Có lỗi xảy ra';
    return Promise.reject(new Error(message));
  }
);

export default api;
