# saas-mobile-order-category-v24

Patch thêm thanh danh mục mobile cho trang khách order/menu (`frontend/src/pages/ShopPage.jsx`).

## Cài đặt

```powershell
cd "E:\foodhub_v14_5_release\ngutamholdings"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\saas-mobile-order-category-v24.zip" -DestinationPath "." -Force
.\saas-mobile-order-category-v24\install-mobile-order-category.cmd
```

Sau đó chạy lại frontend:

```powershell
cd frontend
npm run dev
```

## Thay đổi

- Thêm thanh danh mục mobile sticky.
- Có nút `Tất cả sản phẩm`.
- Có các danh mục lấy từ `product.category`.
- Hiện số lượng sản phẩm theo từng danh mục.
- Không ảnh hưởng sidebar desktop hiện tại.
