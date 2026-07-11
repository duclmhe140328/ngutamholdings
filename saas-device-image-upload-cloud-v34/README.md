# FoodHub – Upload ảnh từ thiết bị v34

Bản vá thêm lựa chọn **dán URL hoặc tải ảnh trực tiếp từ điện thoại/máy tính** cho:

- Logo shop
- Banner shop
- 3 ảnh slider/nền
- Tối đa 8 ảnh cho mỗi sản phẩm

## Cài đặt

Đặt thư mục patch trong thư mục gốc project rồi chạy:

```powershell
cd "E:\foodhub_v14_5_release\ngutamholdings"
node .\saas-device-image-upload-cloud-v34\install-device-image-upload-v34.cjs
```

Hoặc chạy file:

```powershell
.\saas-device-image-upload-cloud-v34\install-device-image-upload-v34.cmd
```

## Cloudinary trên Render

Không cấu hình Cloudinary thì ảnh được lưu trong `backend/uploads`. Cách này chạy local nhưng Render có thể xóa tệp khi redeploy/restart.

Thêm vào Environment của Render:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=foodhub
```

Sau đó restart/redeploy backend.
