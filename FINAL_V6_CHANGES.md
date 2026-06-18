# Các thay đổi V6

1. Header mobile/tablet: hamburger cố định sát mép phải, menu dạng drawer nổi.
2. Trang chủ dựng lại theo từng khối độc lập, search mới không chèn đè.
3. Storefront, checkout, chi tiết sản phẩm, chat và dashboard responsive từ 320px.
4. Chat phân biệt người gửi: của mình bên phải, người còn lại bên trái.
5. Chat khách-shop và shop-admin có phân trang, tìm kiếm, lọc chưa đọc, mới nhất lên đầu.
6. Đơn hàng seller/admin có phân trang và bộ lọc trạng thái, thanh toán, loại đơn, phương thức và ngày.
7. Sản phẩm, shop, tài khoản, bàn và POS có bộ lọc phù hợp.
8. Shop mới phải được admin duyệt trước khi công khai.
9. Seller tự nhập custom domain trong dashboard; storefront và QR tự nhận domain.
10. PWA đổi giao diện cài đặt thành dock nhỏ, không che nội dung mobile.
11. QR trên custom domain dùng `/table/:token`; domain hệ thống dùng `/shop/:slug/table/:token`.
12. Local dùng `npm run dev`; production dùng `npm run build && npm start`.
