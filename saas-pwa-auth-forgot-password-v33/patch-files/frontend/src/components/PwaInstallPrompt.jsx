import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const HIDE_KEY = 'pwa_prompt_hidden_at_v33';
const HIDE_DAYS = 3;

const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [standalone, setStandalone] = useState(
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  );

  const ua = window.navigator.userAgent;
  const isIos = useMemo(() => /iphone|ipad|ipod/i.test(ua), [ua]);
  const isAndroid = useMemo(() => /android/i.test(ua), [ua]);

  useEffect(() => {
    if (standalone) return undefined;
    const hiddenAt = Number(localStorage.getItem(HIDE_KEY) || 0);
    if (hiddenAt && Date.now() - hiddenAt < HIDE_DAYS * 24 * 60 * 60 * 1000) return undefined;

    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };
    const onInstalled = () => {
      setStandalone(true);
      setVisible(false);
      setDeferredPrompt(null);
    };
    const displayQuery = window.matchMedia('(display-mode: standalone)');
    const onDisplayChange = () => setStandalone(displayQuery.matches || window.navigator.standalone === true);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    displayQuery.addEventListener?.('change', onDisplayChange);

    // Một số máy Chrome không phát beforeinstallprompt dù vẫn có thể thêm từ menu.
    // Vì vậy luôn hiện nút hướng dẫn thủ công sau vài giây.
    const timer = window.setTimeout(() => setVisible(true), 2200);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      displayQuery.removeEventListener?.('change', onDisplayChange);
    };
  }, [standalone]);

  if (standalone || !visible) return null;

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') setVisible(false);
      setDeferredPrompt(null);
      return;
    }
    setShowHelp(true);
  };

  const dismiss = () => {
    localStorage.setItem(HIDE_KEY, String(Date.now()));
    setVisible(false);
  };

  const help = isIos
    ? ['Mở trang bằng Safari.', 'Nhấn nút Chia sẻ.', 'Chọn “Thêm vào Màn hình chính”.']
    : isAndroid
      ? ['Mở trang bằng Chrome.', 'Nhấn menu ⋮ góc trên bên phải.', 'Chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.']
      : ['Mở menu của trình duyệt.', 'Chọn “Install app / Cài ứng dụng”.', 'Nếu chưa thấy, mở trang Kiểm tra PWA bên dưới.'];

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
            <img src="/icons/icon-192.png" alt="Ngự Tâm" />
            <div><b>Cài Ngự Tâm</b><small>{deferredPrompt ? 'Thiết bị đã sẵn sàng cài PWA' : 'Mở hướng dẫn cài thủ công'}</small></div>
            <button type="button" className="pwa-install-action" onClick={install}>{deferredPrompt ? 'Cài ngay' : 'Hướng dẫn'}</button>
          </div>
        )}
      </div>

      {showHelp && (
        <div className="pwa-help-backdrop" onClick={() => setShowHelp(false)}>
          <div className="pwa-help-card" onClick={(event) => event.stopPropagation()}>
            <button className="pwa-help-close" onClick={() => setShowHelp(false)}>×</button>
            <img src="/icons/icon-192.png" alt="Ngự Tâm" />
            <h3>Cài ứng dụng</h3>
            {help.map((line, index) => <p key={line}><b>{index + 1}.</b> {line}</p>)}
            <Link to="/pwa-status" onClick={() => setShowHelp(false)} style={{ display: 'inline-block', marginTop: 10, color: '#9a6822', fontWeight: 900 }}>Kiểm tra PWA trên máy này</Link>
          </div>
        </div>
      )}
    </>
  );
};

export default PwaInstallPrompt;
