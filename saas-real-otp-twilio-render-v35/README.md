# OTP thật bằng Twilio Verify + Render — v35

Patch này giữ nguyên giao diện quên mật khẩu v33 và thay phần gửi OTP bằng Twilio Verify thật.

## Cài patch

Chạy tại thư mục gốc dự án:

```powershell
node .\saas-real-otp-twilio-render-v35\install-real-otp-twilio-v35.cjs
```

## Biến môi trường production

```env
NODE_ENV=production
OTP_PROVIDER=twilio
OTP_DEV_MODE=false
OTP_APP_NAME=Ngu Tam
OTP_HASH_SECRET=chuoi-ngau-nhien-rat-dai
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_VERIFY_CHANNEL=sms
```

Không đưa `TWILIO_AUTH_TOKEN` hoặc `OTP_HASH_SECRET` lên GitHub/frontend.

## Test local gửi SMS thật

Đặt các biến trên trong `backend/.env`, bảo đảm `OTP_DEV_MODE=false`, rồi chạy:

```powershell
cd backend
node .\scripts\testTwilioOtp.js 09xxxxxxxx
```

Lưu ý: tài khoản Twilio Trial chỉ gửi tới số đã xác minh trong Twilio. Muốn gửi cho mọi khách hàng phải nâng cấp tài khoản và nạp tiền.

## Deploy Render

Vào Web Service > Environment > Add Environment Variable, thêm toàn bộ biến production rồi chọn Save, rebuild, and deploy.

Sau khi deploy, thử tại `/forgot-password` bằng email của tài khoản đã có số điện thoại.
