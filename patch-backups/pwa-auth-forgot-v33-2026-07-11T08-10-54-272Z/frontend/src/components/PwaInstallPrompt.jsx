import { useEffect, useMemo, useState } from 'react';

const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  const isStandalone = useMemo(() => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true, []);
  const isIos = useMemo(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent), []);

  useEffect(() => {
    if (isStandalone || localStorage.getItem('pwa_prompt_hidden') === '1') return undefined;
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      window.setTimeout(() => setVisible(true), 1200);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    if (isIos) window.setTimeout(() => setVisible(true), 1800);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [isIos, isStandalone]);

  if (isStandalone || !visible) return null;

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
      setDeferredPrompt(null);
      setVisible(false);
      return;
    }
    if (isIos) setShowIosHelp(true);
  };

  const dismiss = () => {
    localStorage.setItem('pwa_prompt_hidden', '1');
    setVisible(false);
  };

  return (
    <>
      <div className={`pwa-install-dock ${expanded ? 'expanded' : ''}`}>
        <button type="button" className="pwa-dock-trigger" onClick={() => setExpanded((value) => !value)} aria-label="Tùy chọn cài ứng dụng">
          <img src="/icons/icon-192.png" alt="" />
          <span>Cài ứng dụng</span>
        </button>
        {expanded && (
          <div className="pwa-dock-card">
            <button type="button" className="pwa-install-close" onClick={dismiss} aria-label="Ẩn gợi ý">×</button>
            <img src="/icons/icon-192.png" alt="FoodHub" />
            <div><b>Cài FoodHub</b><small>Mở nhanh và chạy toàn màn hình</small></div>
            <button type="button" className="pwa-install-action" onClick={install}>Cài ngay</button>
          </div>
        )}
      </div>

      {showIosHelp && (
        <div className="pwa-help-backdrop" onClick={() => setShowIosHelp(false)}>
          <div className="pwa-help-card" onClick={(event) => event.stopPropagation()}>
            <button className="pwa-help-close" onClick={() => setShowIosHelp(false)}>×</button>
            <img src="/icons/icon-192.png" alt="FoodHub" />
            <h3>Cài trên iPhone/iPad</h3>
            <p>1. Mở trang bằng Safari.</p>
            <p>2. Nhấn nút <b>Chia sẻ</b> ở thanh công cụ.</p>
            <p>3. Chọn <b>Thêm vào Màn hình chính</b>.</p>
          </div>
        </div>
      )}
    </>
  );
};

export default PwaInstallPrompt;
