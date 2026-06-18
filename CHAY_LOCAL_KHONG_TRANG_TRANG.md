# Chạy local không bị trắng trang

Tại thư mục gốc:

```powershell
npm run setup
npm run dev
```

Script sẽ tự tạo `backend/.env` và `frontend/.env` nếu chưa có.

Mở `http://localhost:5173`.

Để đăng nhập, tạo shop và lưu dữ liệu, MongoDB phải hoạt động. Sửa `MONGO_URI` trong `backend/.env` thành MongoDB Atlas của bạn hoặc bật MongoDB local.

Nếu trình duyệt từng mở bản PWA cũ, bản mới sẽ tự gỡ service worker khi chạy localhost. Có thể nhấn Ctrl+Shift+R một lần.
