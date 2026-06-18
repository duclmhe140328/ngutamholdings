# FoodHub Atelier V10

## Thay đổi giao diện khách mua hàng
- Dựng lại trang cửa hàng theo kiểu ứng dụng giao đồ ăn: header sticky, tìm kiếm lớn, hero thông tin quán, danh mục sticky, card món rõ ảnh/giá/nút thêm.
- Giỏ hàng dạng drawer, badge số lượng và nút giỏ nổi.
- Responsive desktop, tablet, mobile và PWA.

## Thay đổi header trang tổng
- Header sticky đi theo khi cuộn.
- Khoảng cách điều hướng được nới lại.
- Mobile dùng menu drawer chứa đủ điều hướng, danh mục, đăng nhập và mở cửa hàng.

## Admin tổng
- Trang tài khoản chuyển sang bảng dữ liệu rõ ràng.
- Hiển thị tên, ID, email, điện thoại, cửa hàng sở hữu, vai trò, ngày tạo, trạng thái và nút khóa/mở.
- Backend trả thêm thông tin cửa hàng thuộc tài khoản seller.
- Bổ sung giao diện phân trang có tổng bản ghi, khoảng bản ghi và trang hiện tại.

## Phân trang
Các khu đã sử dụng Pagination:
- Admin tổng: cửa hàng, đơn hàng, tài khoản, tin nhắn.
- Admin shop: đơn hàng, sản phẩm, tin nhắn khách.

## PWA
Cache được nâng lên `foodhub-pwa-v10-storefront-admin` để xóa giao diện cũ sau khi deploy.
