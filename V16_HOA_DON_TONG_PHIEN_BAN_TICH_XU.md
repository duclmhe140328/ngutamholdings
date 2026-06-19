# V16 — Hóa đơn tổng phiên bàn và tích xu theo số điện thoại

## Quy tắc mới

- Một lần khách ngồi tại bàn tương ứng một `DiningSession`.
- Mọi lần gọi thêm món trong phiên đều thuộc một hóa đơn tổng.
- Khách có thể nhập tên khác nhau ở từng lần gọi; hóa đơn cuối hiển thị đầy đủ tất cả tên và từng lượt gọi món.
- Xác nhận thanh toán không tự tạo hóa đơn mới.
- Nếu khách gọi thêm trước khi nhân viên đóng phiên, hệ thống cộng món mới vào cùng hóa đơn tổng và tính phần còn phải thu.
- Chỉ khi nhân viên bấm **Đóng bàn / kết thúc lượt khách**, phiên mới được chốt và hóa đơn tổng được mở để in.

## Tích xu

- Nếu khách đã nhập cùng một số điện thoại, hệ thống ghi nhận số đó cho phiên bàn.
- Khi nhân viên chọn **Đã thanh toán**, giao diện hỏi số điện thoại tích xu.
- Có thể để trống nếu khách không muốn tích xu.
- Xu của phiên bàn được cộng một lần khi nhân viên đóng phiên, dựa trên tổng giá trị cuối cùng của toàn bộ lượt gọi món.
- Các đơn giao hàng/nhận tại shop vẫn cộng xu khi chuyển sang đã thanh toán.

## Ví dụ

Bàn 5:

- Lượt 1 — Đức: Cơm rang, Coca.
- Lượt 2 — Thuyết: Gà nướng.
- Lượt 3 — Đức: Kem.

Hóa đơn cuối:

- Người gọi món: Đức · Thuyết.
- Hiển thị chi tiết cả ba lượt gọi.
- Gộp toàn bộ sản phẩm và tổng tiền.
- Hiển thị lịch sử các lần thanh toán.
- Tích xu cho một số điện thoại được nhân viên xác nhận.

## Quy trình vận hành

1. Khách quét QR và gọi món.
2. Khách có thể thoát rồi quay lại và gọi thêm.
3. Nhân viên bấm xác nhận thanh toán, nhập SĐT tích xu hoặc để trống.
4. Nếu khách gọi thêm trước khi đóng bàn, hệ thống tính thêm số tiền còn lại.
5. Khi số tiền còn lại bằng 0, nhân viên bấm đóng phiên.
6. Hệ thống cộng xu một lần và mở hóa đơn tổng để in.
