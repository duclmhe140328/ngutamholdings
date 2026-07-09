# v32 - PWA Safe Area / Dynamic Island

Bản vá này xử lý iPhone tai thỏ/Dynamic Island khi chạy PWA Add to Home Screen:

- Thêm `viewport-fit=cover` vào `frontend/index.html`
- Thêm `frontend/src/styles/pwa-safe-area.css`
- Thêm `frontend/src/utils/pwaSafeArea.js`
- Import 2 file vào `frontend/src/main.jsx` hoặc `main.tsx`/`App.jsx`

Muốn tụt xuống thêm: sửa trong `frontend/src/styles/pwa-safe-area.css`:

```css
--pwa-notch-extra: 8px;
```

thành `12px` hoặc `16px`.
