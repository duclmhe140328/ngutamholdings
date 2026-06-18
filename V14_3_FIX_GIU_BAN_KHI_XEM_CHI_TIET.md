# V14.3 — Giữ đúng bàn khi xem chi tiết sản phẩm

## Lỗi đã sửa
Khi khách quét QR bàn, sau đó mở trang chi tiết món rồi quay lại, route cũ làm mất `tableToken`. Vì vậy giỏ hàng chuyển sang giỏ công khai và checkout không còn nhận diện đơn tại bàn.

## Luồng mới
- Menu bàn: `/shop/:slug/table/:tableToken`
- Chi tiết món tại bàn: `/shop/:slug/table/:tableToken/product/:id`
- Checkout bàn: `/shop/:slug/table/:tableToken/checkout`

Với domain riêng:
- Menu bàn: `/table/:tableToken`
- Chi tiết món: `/table/:tableToken/product/:id`
- Checkout: `/table/:tableToken/checkout`

## Các điểm đã đồng bộ
- Link chi tiết sản phẩm giữ nguyên mã bàn.
- Nút quay lại trả về đúng menu của bàn.
- Trang chi tiết hiển thị tên bàn đang đặt.
- Giỏ hàng dùng khóa `shop + tableToken`, không lẫn với giỏ mua hàng thường.
- Sản phẩm thêm tại trang chi tiết được đưa vào đúng giỏ của bàn.
- Checkout nhận đúng mã bàn và tạo đơn `dine_in`.
- PWA cache nâng thành `foodhub-pwa-v14-3-table-context`.
