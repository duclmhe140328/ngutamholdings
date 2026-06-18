# V14.5 — Sửa tuyệt đối kim quay, ô sáng và số xu cộng

## Nguyên nhân lỗi
Bản trước xoay trực tiếp SVG bằng `transform-origin: 120px 120px`. Trên web/PWA, SVG được render ở kích thước khác 240px nên tâm CSS có thể lệch khỏi tâm thật. Vì vậy:

- kim nhìn vào ô 100;
- ô 2.000 lại sáng;
- backend vẫn cộng 2.000 theo ô server chọn.

## Cách sửa

1. Không xoay trực tiếp SVG nữa.
2. Xoay một `div` HTML bao quanh bánh xe với tâm cố định `50% 50%`.
3. Mỗi lát có tâm chính xác tại `index × 45°`.
4. Backend trả `rewardIndex` và `reward`.
5. Frontend quay theo công thức `rotation = -rewardIndex × 45°`.
6. Chỉ sau khi animation kết thúc mới sáng ô và hiện kết quả.
7. Số dư được tải lại từ database sau khi bánh xe dừng.
8. Chuẩn hóa 8 ô theo đúng vị trí; dữ liệu lỗi không còn làm các ô phía sau bị dồn index.

## Kiểm tra 8 ô

- Ô 1 → 0°
- Ô 2 → 315°
- Ô 3 → 270°
- Ô 4 → 225°
- Ô 5 → 180°
- Ô 6 → 135°
- Ô 7 → 90°
- Ô 8 → 45°

Ở cả 8 trường hợp, tâm ô trúng sau khi quay đều nằm đúng 0° dưới kim ở vị trí 12 giờ.

## PWA
Cache mới:

`foodhub-pwa-v14-5-exact-pointer`

Sau khi deploy, đóng hoàn toàn PWA rồi mở lại. Nếu thiết bị vẫn giữ bản cũ, xóa PWA và cài lại một lần.
