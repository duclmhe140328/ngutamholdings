# v33 — PWA ổn định + đăng nhập đa thiết bị + quên mật khẩu

## Cài đặt

```powershell
cd "E:\foodhub_v14_5_release\ngutamholdings"
Remove-Item .\saas-pwa-auth-forgot-password-v33 -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\saas-pwa-auth-forgot-password-v33.zip" -DestinationPath "." -Force
.\saas-pwa-auth-forgot-password-v33\install-pwa-auth-forgot-password-v33.cmd
```

## Sau khi cài

```powershell
npm run build
npm start
```

Hoặc chạy local:

```powershell
npm run dev
```

## Chức năng

- Service Worker tự cập nhật, xóa cache PWA cũ và không cache API đăng nhập.
- Chrome Android luôn có hướng dẫn cài thủ công khi `beforeinstallprompt` không xuất hiện.
- Trang kiểm tra PWA: `/pwa-status`.
- Không tự xóa token chỉ vì backend đang ngủ hoặc mạng chậm.
- Một tài khoản được đăng nhập đồng thời trên nhiều thiết bị.
- Email được chuẩn hóa, mật khẩu có dấu được thử cả Unicode NFC/NFD để tránh khác bàn phím giữa các máy.
- Thêm `/forgot-password`: gửi OTP đến số điện thoại đã đăng ký rồi đổi mật khẩu.
- Khi đổi mật khẩu, token cũ trên các máy bị đăng xuất để bảo mật.

## Production

Quên mật khẩu dùng cấu hình SMS OTP đang có:

```env
OTP_DEV_MODE=false
SMS_OTP_WEBHOOK_URL=https://...
SMS_OTP_WEBHOOK_TOKEN=...
```

Tài khoản cũ không có số điện thoại cần admin cập nhật số điện thoại trước.
