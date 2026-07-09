// FH_PWA_SAFE_AREA_V32_FIXED
function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;
}

function applyPwaSafeAreaClass() {
  document.documentElement.classList.toggle('pwa-standalone', isStandalonePwa());
}

applyPwaSafeAreaClass();
window.addEventListener('resize', applyPwaSafeAreaClass);
window.addEventListener('orientationchange', () => setTimeout(applyPwaSafeAreaClass, 250));
