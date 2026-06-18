const trimSlash = (value) => String(value || '').trim().replace(/\/$/, '');

const isLocalOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
  } catch {
    return true;
  }
};

/**
 * Production luôn ưu tiên domain thực mà người quản trị đang mở.
 * Điều này tránh QR bị giữ link localhost/ngrok cũ sau khi deploy.
 * Khi chạy local, mới dùng publicBaseUrl hoặc VITE_PUBLIC_APP_URL.
 */
export const getPublicAppUrl = (shopPublicBaseUrl = '') => {
  const currentOrigin = typeof window !== 'undefined' ? trimSlash(window.location.origin) : '';
  const configured = trimSlash(import.meta.env.VITE_PUBLIC_APP_URL);
  const shopConfigured = trimSlash(shopPublicBaseUrl);

  if (currentOrigin && !isLocalOrigin(currentOrigin)) return currentOrigin;
  return shopConfigured || configured || currentOrigin;
};

export const buildTableOrderUrl = ({ slug, tableToken, shopPublicBaseUrl = '', customDomain = '' }) => {
  const normalizedDomain = String(customDomain || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (normalizedDomain) {
    return `https://${normalizedDomain}/table/${encodeURIComponent(tableToken)}`;
  }
  const baseUrl = getPublicAppUrl(shopPublicBaseUrl);
  return `${baseUrl}/shop/${encodeURIComponent(slug)}/table/${encodeURIComponent(tableToken)}`;
};
