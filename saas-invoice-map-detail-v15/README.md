# SaaS Invoice Map Detail v15

Patch hien thi day du thong tin checkout trong tab hoa don:
- Don tu den lay: note, ngay gio lay, so dien thoai.
- Don giao hang/ship: dia chi, toa do/ban do, ghi chu giao hang.
- Khi click hoa don se co modal chi tiet truoc, co nut in hoa don cu.

Cai dat:
cd "E:\foodhub_v14_5_release\ngutamholdings"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\saas-invoice-map-detail-v15.zip" -DestinationPath "." -Force
.\install-invoice-map-detail.cmd

Sau do chay lai frontend/backend va push git.
