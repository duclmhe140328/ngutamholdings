@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0\.."

if not exist "frontend\src" (
  echo [ERROR] Khong tim thay thu muc frontend\src. Hay chay file nay o thu muc goc project ngutamholdings.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; ^
  $root=(Get-Location).Path; ^
  $styles=Join-Path $root 'frontend\src\styles'; ^
  $utils=Join-Path $root 'frontend\src\utils'; ^
  New-Item -ItemType Directory -Force -Path $styles,$utils | Out-Null; ^
  $cssPath=Join-Path $styles 'pwa-safe-area.css'; ^
  $jsPath=Join-Path $utils 'pwaSafeArea.js'; ^
  $css=@' 
/* FH_PWA_SAFE_AREA_V32
   Fix iPhone notch / Dynamic Island khi chạy PWA Add to Home Screen.
   Muốn dịch xuống nhiều hơn: tăng --pwa-notch-extra từ 8px lên 12px/16px.
*/
:root {
  --pwa-safe-top: env(safe-area-inset-top, 0px);
  --pwa-safe-right: env(safe-area-inset-right, 0px);
  --pwa-safe-bottom: env(safe-area-inset-bottom, 0px);
  --pwa-safe-left: env(safe-area-inset-left, 0px);
  --pwa-notch-extra: 8px;
}

html.pwa-standalone,
html.pwa-standalone body {
  min-height: 100%;
  min-height: 100dvh;
  background: var(--fh-bg, var(--page-bg, #ffffff));
}

@supports (padding-top: env(safe-area-inset-top)) {
  html.pwa-standalone body {
    padding-top: calc(var(--pwa-safe-top) + var(--pwa-notch-extra));
    padding-bottom: var(--pwa-safe-bottom);
    padding-left: var(--pwa-safe-left);
    padding-right: var(--pwa-safe-right);
    box-sizing: border-box;
  }

  html.pwa-standalone #root {
    min-height: calc(100dvh - var(--pwa-safe-top) - var(--pwa-notch-extra));
  }

  html.pwa-standalone .fh-dashboard,
  html.pwa-standalone .ad-dashboard,
  html.pwa-standalone .admin-dashboard,
  html.pwa-standalone .platform-home,
  html.pwa-standalone .home-page,
  html.pwa-standalone .landing-page,
  html.pwa-standalone .shop-page,
  html.pwa-standalone .food-store,
  html.pwa-standalone .food-store-page,
  html.pwa-standalone .fhc-checkout,
  html.pwa-standalone .checkout-page {
    min-height: calc(100dvh - var(--pwa-safe-top) - var(--pwa-notch-extra));
  }

  /* Header/drawer fixed trên mobile không chui vào tai thỏ */
  html.pwa-standalone .fh-sidebar,
  html.pwa-standalone .ad-sidebar,
  html.pwa-standalone .mobile-drawer,
  html.pwa-standalone .drawer,
  html.pwa-standalone .side-menu {
    padding-top: calc(var(--pwa-safe-top) + 8px);
  }

  html.pwa-standalone .fh-header,
  html.pwa-standalone .ad-header,
  html.pwa-standalone .home-header,
  html.pwa-standalone .site-header,
  html.pwa-standalone .shop-header,
  html.pwa-standalone .food-store-header,
  html.pwa-standalone .mobile-header,
  html.pwa-standalone .topbar,
  html.pwa-standalone .navbar {
    scroll-margin-top: calc(var(--pwa-safe-top) + 12px);
  }

  /* Landscape iPhone không cần tụt quá sâu */
  @media (orientation: landscape) and (max-height: 520px) {
    html.pwa-standalone body {
      padding-top: max(4px, var(--pwa-safe-top));
    }
  }
}
'@; ^
  Set-Content -LiteralPath $cssPath -Value $css.TrimStart() -Encoding UTF8; ^
  $js=@' 
// FH_PWA_SAFE_AREA_V32
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
'@; ^
  Set-Content -LiteralPath $jsPath -Value $js.TrimStart() -Encoding UTF8; ^
  $mainCandidates=@('frontend\src\main.jsx','frontend\src\main.tsx','frontend\src\App.jsx','frontend\src\App.tsx') | ForEach-Object { Join-Path $root $_ }; ^
  $main=$mainCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1; ^
  if(-not $main){ throw 'Khong tim thay main.jsx/main.tsx/App.jsx de import safe area.' } ^
  $content=Get-Content -LiteralPath $main -Raw; ^
  $insert=''; ^
  if($content -notmatch 'pwa-safe-area\.css'){ $insert += "import './styles/pwa-safe-area.css';`r`n" } ^
  if($content -notmatch 'pwaSafeArea'){ $insert += "import './utils/pwaSafeArea.js';`r`n" } ^
  if($insert){ Set-Content -LiteralPath $main -Value ($insert + $content) -Encoding UTF8; Write-Host "[OK] Imported PWA safe area in $main" } else { Write-Host '[SKIP] Safe area import already exists' } ^
  $index=Join-Path $root 'frontend\index.html'; ^
  if(Test-Path $index){ ^
    $html=Get-Content -LiteralPath $index -Raw; ^
    if($html -notmatch 'viewport-fit=cover'){ ^
      if($html -match '<meta\s+name=["'']viewport["''][^>]*content=["''][^"'']*["''][^>]*>'){ ^
        $html=[regex]::Replace($html,'(<meta\s+name=["'']viewport["''][^>]*content=["''])([^"'']*)(["''][^>]*>)',{ param($m) $prefix=$m.Groups[1].Value; $val=$m.Groups[2].Value; $suffix=$m.Groups[3].Value; if($val.Trim().EndsWith(',')){ $prefix+$val+' viewport-fit=cover'+$suffix } else { $prefix+$val+', viewport-fit=cover'+$suffix } },1); ^
      } else { ^
        $html=$html -replace '<head>','<head>`r`n    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />'; ^
      } ^
      Set-Content -LiteralPath $index -Value $html -Encoding UTF8; ^
      Write-Host '[OK] Added viewport-fit=cover to frontend/index.html'; ^
    } else { Write-Host '[SKIP] viewport-fit=cover already exists' } ^
  } ^
  Write-Host '[DONE] PWA safe area Dynamic Island fix v32 installed.'"

if errorlevel 1 (
  echo [ERROR] Cai patch that bai.
  pause
  exit /b 1
)

endlocal
