# V14.2 - Sửa chính xác vòng quay 8 ô

- Vòng quay luôn có đúng 8 ô.
- Seller cấu hình từng ô riêng: Ô 1 đến Ô 8.
- Backend trả `rewardSlot.index`, `rewardSlot.number` và `rewardSlot.value`.
- Kim quay vào chính giữa ô trúng, không dừng ở ranh giới hai ô.
- Nhãn trên bánh xe lấy đúng snapshot phần thưởng từ server.
- Kết quả hiển thị rõ số ô và số xu đã cộng.
- Số dư tải lại từ database sau khi animation hoàn tất.
- Nhập 0 để tạo ô “May mắn”.
