# V14.1 – Sửa vòng quay trúng xu nhưng số dư không hiển thị đúng

## Nguyên nhân
Frontend trước đây tự tạo góc quay ngẫu nhiên, trong khi backend chọn phần thưởng ngẫu nhiên độc lập. Vì vậy kim có thể dừng ở ô 1.000 xu nhưng server thực tế chọn mức khác.

## Đã sửa
- Backend chọn `rewardIndex` và giá trị thưởng.
- Frontend quay đúng tới `rewardIndex` do backend trả về.
- Chỉ dùng tối đa 8 ô đúng với 8 ô đang hiển thị.
- Cập nhật số dư ngay từ phản hồi server.
- Tải lại ví từ database sau animation để đồng bộ tuyệt đối.
- Ghi lịch sử vòng quay kèm ô trúng và danh sách phần thưởng.
- Nếu ghi lịch sử lỗi, backend hoàn tác số dư để không có dữ liệu nửa vời.
- PWA cache đổi thành `foodhub-pwa-v14-1-spin-balance-fix`.
