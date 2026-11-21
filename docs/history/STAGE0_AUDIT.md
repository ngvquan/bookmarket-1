# Giai đoạn 0 — đối chiếu trước khi sửa

> Tài liệu lịch sử, số dòng/đường dẫn phản ánh bản trước refactor. Hiện trạng mới xem [README](../../README.md) và [đơn hàng/vận chuyển](../ORDERS_SHIPPING.md); không dùng mô tả dưới đây để kết luận bản hiện tại chưa có backend/database.

Mốc source: bản `BookMarket-source-light.zip` (26 file) đã có trước yêu cầu này. Các số dòng dưới đây là **trước khi refactor**, có thể đối chiếu với ZIP đó.

README và tài liệu bàn giao thống nhất rằng đây là frontend demo, chưa có API/database/auth thực (README.md:70; BOOKMARKET_HIEN_TRANG_PROMPT.md:214). Không phát hiện backend đã triển khai nhưng tài liệu bỏ sót. MongoDB đang có dịch vụ lắng nghe cổng 27017 trên máy; điều này không đồng nghĩa ứng dụng đã sử dụng MongoDB.

| Hiện trạng/khác biệt với yêu cầu mới | Vị trí trước sửa |
|---|---|
| Nhóm giỏ và URL/bộ lọc theo tên; chưa có sellerId ổn định | frontend/src/marketplace.js:81, 126; frontend/src/Sellers.jsx:22; tài liệu bàn giao:145 |
| Yêu thích/thư viện chưa lọc isAvailable | frontend/src/App.jsx:568, 595 |
| addToCart chỉ xét sold; placeOrder bỏ sót pending/exchanged | frontend/src/App.jsx:114, 180 |
| Badge lấy cart thô, loại item mất tham chiếu khỏi cartItems, tổng gồm tin hết hiệu lực | frontend/src/App.jsx:134, 404 |
| Modal lưu overflow riêng, mọi modal nghe Escape; closure onClose chỉ lấy lần mount | frontend/src/components.jsx:319 |
| localStorage.setItem không bắt lỗi | frontend/src/App.jsx:69 |
| ID đơn dùng đoạn Date.now; form shop chưa trim | frontend/src/App.jsx:197; Seller trong App.jsx:1686 |
| Mọi trạng thái trao đổi ngoài pending đều xanh | frontend/src/App.jsx:722 |
| ISBN dùng includes, số rất ngắn có thể khớp hàng loạt | frontend/src/marketplace.js:95 |
| Auth, modal, trang tài khoản, seller/admin còn chung App.jsx | frontend/src/App.jsx:1402–2154 |

Không coi thông tin “10 test từng đạt” trong tài liệu là kết quả cho các thay đổi mới. Chạy lại mốc ban đầu và từng checkpoint trong phiên triển khai này.
