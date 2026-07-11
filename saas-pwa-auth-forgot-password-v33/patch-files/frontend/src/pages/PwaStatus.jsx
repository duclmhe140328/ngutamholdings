import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const PwaStatus = () => {
  const [state, setState] = useState({ checking: true });
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  const check = async () => {
    const next = {
      checking: false,
      secure: window.isSecureContext,
      online: navigator.onLine,
      standalone,
      serviceWorkerSupported: 'serviceWorker' in navigator,
      controller: Boolean(navigator.serviceWorker?.controller),
      registration: false,
      manifest: false
    };
    try {
      const registration = await navigator.serviceWorker?.getRegistration('/');
      next.registration = Boolean(registration);
      next.waiting = Boolean(registration?.waiting);
      next.activeState = registration?.active?.state || '';
    } catch { /* no-op */ }
    try {
      const response = await fetch('/manifest.webmanifest', { cache: 'no-store' });
      next.manifest = response.ok;
    } catch { /* no-op */ }
    setState(next);
  };

  useEffect(() => { check(); }, []);

  const refreshPwa = async () => {
    const registrations = await navigator.serviceWorker?.getRegistrations?.() || [];
    for (const registration of registrations) {
      await registration.update().catch(() => null);
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    }
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('foodhub-pwa-')).map((key) => caches.delete(key)));
    window.location.reload();
  };

  const rows = [
    ['HTTPS / ngữ cảnh an toàn', state.secure],
    ['Có mạng', state.online],
    ['Hỗ trợ Service Worker', state.serviceWorkerSupported],
    ['Đã đăng ký Service Worker', state.registration],
    ['Trang đang được Service Worker điều khiển', state.controller],
    ['Manifest tải được', state.manifest],
    ['Đang chạy dạng ứng dụng PWA', state.standalone]
  ];

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#f6f1e9', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <section style={{ width: 'min(680px,100%)', margin: '40px auto', padding: 28, borderRadius: 24, background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.1)' }}>
        <h1 style={{ marginTop: 0 }}>Kiểm tra PWA</h1>
        <p style={{ color: '#6b6258' }}>Dùng trang này trên máy gặp lỗi để biết thiếu HTTPS, manifest hay Service Worker.</p>
        <div style={{ display: 'grid', gap: 10, margin: '22px 0' }}>
          {rows.map(([label, ok]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 12, borderRadius: 12, background: '#f8f5ef' }}><b>{label}</b><span style={{ color: ok ? '#177245' : '#b43e35', fontWeight: 900 }}>{ok ? 'OK' : 'CHƯA'}</span></div>)}
        </div>
        <button type="button" onClick={refreshPwa} style={{ width: '100%', minHeight: 48, border: 0, borderRadius: 12, background: '#17130f', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>Cập nhật và xóa cache PWA</button>
        <button type="button" onClick={check} style={{ width: '100%', minHeight: 44, marginTop: 10, border: '1px solid #d8cfc2', borderRadius: 12, background: '#fff', fontWeight: 800, cursor: 'pointer' }}>Kiểm tra lại</button>
        <Link to="/" style={{ display: 'inline-block', marginTop: 18, color: '#8a6126', fontWeight: 800 }}>← Về trang chủ</Link>
      </section>
    </div>
  );
};

export default PwaStatus;
