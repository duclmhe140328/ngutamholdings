# v36 — Gmail OTP cho quên mật khẩu và ví xu

Bản này:

- Bỏ Twilio khỏi code OTP.
- Quên mật khẩu gửi OTP qua Gmail SMTP.
- Khách tích xu/vòng quay có 2 lựa chọn: Email hoặc SMS.
- Email là lựa chọn mặc định và dùng được cho vòng quay shop, checkout, ví xu và vòng quay toàn hệ thống.
- Sau lần xác thực email đầu tiên, email được gắn cố định với số điện thoại ví xu.
- OTP hết hạn sau 5 phút, tối đa 5 lần nhập sai, chờ tối thiểu 60 giây để gửi lại.
- Cài `nodemailer`, gỡ package `twilio` và sao lưu file cũ.

## Cài

```powershell
cd "E:\foodhub_v14_5_release\ngutamholdings"
node .\saas-gmail-email-otp-loyalty-v36\install-gmail-email-otp-loyalty-v36.cjs
```

## Biến môi trường

```env
OTP_DEV_MODE=false
OTP_HASH_SECRET=chuoi_bi_mat_dai_ngau_nhien
OTP_RESEND_SECONDS=60
GMAIL_USER=ten@gmail.com
GMAIL_APP_PASSWORD=mat_khau_ung_dung_16_ky_tu
GMAIL_FROM_NAME=Ngu Tam
```

`GMAIL_APP_PASSWORD` là App Password của Google, không phải mật khẩu Gmail thường.

## Test Gmail

```powershell
cd backend
node .\scripts\testGmailOtp.js email-nhan@gmail.com
```

Test OTP tích xu qua email:

```powershell
node .\scripts\testGmailOtp.js email-nhan@gmail.com loyalty 0372012286
```
