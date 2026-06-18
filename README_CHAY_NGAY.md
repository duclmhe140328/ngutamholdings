# Chạy FoodHub local

Mở PowerShell tại thư mục gốc rồi chạy:

```powershell
npm run setup
npm run dev
```

Mở: `http://localhost:5173`

Script tự tạo `backend/.env` khi chưa có.

## Quan trọng về MongoDB

Giao diện vẫn hiện nếu MongoDB chưa chạy, nhưng đăng nhập, tạo shop, đơn hàng và chat cần database.

Sửa dòng sau trong `backend/.env`:

```env
MONGO_URI=mongodb+srv://TEN_USER:MAT_KHAU@cluster.../foodhub
```

hoặc bật MongoDB local tại `mongodb://127.0.0.1:27017/multi_shop_saas`.

Sau khi MongoDB hoạt động, chạy:

```powershell
npm run create-admin
```

Admin mặc định:

- Email: `admin@example.com`
- Mật khẩu: `123456`

## Khi trình duyệt từng cài PWA cũ

Bản sửa tự gỡ service worker khi chạy localhost. Sau khi chạy, nhấn `Ctrl + Shift + R` một lần.
