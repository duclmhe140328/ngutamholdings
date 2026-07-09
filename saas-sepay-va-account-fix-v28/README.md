# v28 - Fix SePay VA / tài khoản chính không tự đổi trạng thái

Bản vá này sửa `backend/controllers/paymentController.js`:

- Không khóa webhook SePay theo duy nhất `shop.bankAccountNumber` nữa.
- Mặc định ưu tiên đối soát bằng `orderCode` / `paymentReference` trong nội dung chuyển khoản.
- Vẫn kiểm tra giao dịch tiền vào và số tiền nhận.
- Cho phép SePay báo `accountNumber` là tài khoản chính hoặc VA mà vẫn cập nhật đơn nếu mã đơn đúng.
- Nếu giao dịch SePay đã từng lưu `matched=false`, webhook retry cùng transactionId vẫn có thể xử lý lại thay vì bị bỏ qua là duplicate.

Nếu muốn bật lại chế độ bắt buộc đúng tài khoản nhận, thêm env:

```env
SEPAY_STRICT_ACCOUNT_CHECK=true
BANK_ACCOUNT_NUMBER=so_tai_khoan_chinh_neu_muon_cho_phep
```

Cài đặt:

```powershell
cd "E:\foodhub_v14_5_release\ngutamholdings"
.\saas-sepay-va-account-fix-v28\install-sepay-va-account-fix.cmd
```

Sau đó restart backend.
