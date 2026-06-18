# FoodHub V13 — In hóa đơn / phiếu tính tiền có VAT

## Chức năng mới

Tất cả tài khoản Seller có thêm mục:

- `Dashboard → In hóa đơn`

Danh sách này chỉ tải các đơn đã xác nhận thanh toán.

Seller có thể:

- Tìm theo mã đơn, tên khách hoặc số điện thoại.
- Lọc theo trạng thái hóa đơn và ngày.
- Nhập thông tin người mua/doanh nghiệp.
- Nhập mã số thuế, địa chỉ và email nhận hóa đơn.
- Chọn thuế suất: không chịu thuế, 0%, 5%, 8% hoặc 10%.
- Tách tiền trước thuế và tiền VAT từ tổng tiền đã thanh toán.
- In A4 hoặc lưu PDF bằng hộp thoại in của trình duyệt.
- In phiếu POS khổ 80mm.
- Lưu dữ liệu hóa đơn vào đơn hàng.
- Ghi nhận thông tin của hóa đơn điện tử đã phát hành ở nhà cung cấp bên ngoài.

## Cấu hình thông tin người bán

Vào:

- `Dashboard → Cài đặt → Thông tin thuế & hóa đơn`

Nhập:

- Tên pháp lý/người bán.
- Mã số thuế.
- Địa chỉ trên hóa đơn.
- Email và số điện thoại.
- Thuế suất mặc định.
- Tên nhà cung cấp hóa đơn điện tử.
- Trang tra cứu hóa đơn.

## In từ POS hoặc danh sách đơn

Sau khi đơn được xác nhận `Đã thanh toán`, tại:

- `POS / Tính tiền`
- `Đơn hàng`

sẽ có nút `In hóa đơn`.

## Cách tính VAT

Hệ thống hiểu giá đơn hàng hiện tại là **giá đã bao gồm VAT**, nhằm giữ nguyên tổng tiền mà khách đã thanh toán.

Ví dụ tổng thanh toán là 108.000đ và VAT 8%:

- Tiền trước VAT: 100.000đ
- VAT: 8.000đ
- Tổng thanh toán: 108.000đ

## Lưu ý pháp lý quan trọng

Chức năng này tạo:

- Phiếu bán hàng/phiếu tính tiền.
- Bản in tham khảo có tách VAT.
- Bản thể hiện dựa trên dữ liệu hóa đơn điện tử đã phát hành ở hệ thống khác.

Nó **không tự phát hành hóa đơn điện tử hợp pháp**, không tự ký số và không tự xin mã cơ quan thuế.

Muốn phát hành hóa đơn điện tử thật, cần tích hợp API với nhà cung cấp hóa đơn điện tử hoặc giải pháp được cơ quan thuế chấp nhận. Khi có API cụ thể, các trường `invoiceNumber`, `invoiceSymbol`, `invoiceLookupCode`, `invoiceIssuedAt` và trạng thái phát hành có thể được đồng bộ tự động.

Người bán chịu trách nhiệm chọn đúng thuế suất và nhập đúng thông tin đăng ký thuế của đơn vị.
