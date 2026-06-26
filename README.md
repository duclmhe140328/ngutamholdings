# SaaS Revenue Mobile Production Patch v10

Patch này chỉ sửa `admin-revenue.html`:
- responsive mobile dạng card, không vỡ bảng
- lọc ngày/shop đẹp hơn trên mobile
- nút, pagination, search tối ưu màn nhỏ
- API production-safe: cùng domain dùng `/api/revenue`, local Vite 5173 tự gọi `http://localhost:5000`

Cài:
```powershell
cd "E:\foodhub_v14_5_release\ngutamholdings - Copy"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\saas-revenue-mobile-production-v10.zip" -DestinationPath "." -Force
.\install-revenue-mobile-production-patch.cmd
```

Mở local:
- http://localhost:5000/admin-revenue.html
- hoặc http://localhost:5173/admin-revenue.html

Production:
- Nếu frontend/backend cùng domain: chỉ push Git và redeploy.
- Nếu frontend/backend tách domain: set `localStorage.REVENUE_API_BASE` hoặc sửa `API_BASE` thành URL backend production.
