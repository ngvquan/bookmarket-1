# Giai đoạn 2 — bước 1: models và đặt hàng

> Đây là bản ghi mốc bước 1, giữ để đối chiếu. Các phần ghi “chưa làm” bên dưới đã được bổ sung ở [Giai đoạn 2–3](ORDERS_SHIPPING.md). README/API/DATA_MODEL phản ánh bản hiện tại; không dùng các giới hạn của mốc này để kết luận code mới thiếu tính năng.

## Đối chiếu đầu vào với source

- backend/src/models/index.js đã có 9 model trước bước này, gồm Admin riêng và Author/Publisher/Category/Book/Edition; không chỉ User/Shop/Listing như phần bàn giao mới mô tả.
- backend/src/models/Listing.js giữ editionId; ISBN/title/author được đọc qua backend/src/utils/catalog.js. Vì vậy snapshot đơn phải ghép quan hệ, không đọc listing.title/isbn vốn không có.
- backend/src/middleware/auth.js có requireLogin/requireAdmin và requireUser; token admin không dùng để mua hàng.
- frontend/src/services/api.js dùng fetch; frontend/src/hooks/useBookMarket.js vẫn tạo đơn demo trong bộ nhớ. Không thay checkout trong bước này.
- README trước bước này nói chưa có đơn hàng server. Đã cập nhật để phân biệt POST /orders mới và checkout UI chưa kết nối.

## File tạo/sửa và trách nhiệm

| File | Thay đổi |
|---|---|
| backend/src/models/Order.js | Đơn mẹ: buyer/người nhận/COD/tổng tiền. |
| backend/src/models/SubOrder.js | Đơn mỗi seller, snapshot sách/shop, trạng thái và shipment ban đầu. |
| backend/src/models/index.js | Đăng ký 11 model để init index và test. |
| backend/src/models/Listing.js | Thêm index type; giữ ISBN trong Edition. |
| backend/src/utils/order.js | readOrder validate bằng if và restoreItems dùng chung. |
| backend/src/utils/shipping.js | Một object phí cố định; cần để tổng đơn API đúng ngay từ bước đặt. |
| backend/src/routes/orders.js | POST /orders, trừ kho có điều kiện, gom seller và bù kho khi lỗi. |
| backend/src/app.js | Gắn route /orders. |
| backend/tests/orders.test.js | 14 bài về đặt hàng, cạnh tranh kho và lỗi giữa chừng. |
| backend/scripts/export-database.js | Nhận model đơn và ghi bản xuất hiện tại riêng với bản chín collection cũ. |
| README.md, docs/ | API, sơ đồ dữ liệu, phạm vi và kết quả kiểm chứng. |

Không thêm dependency, không đổi framework, không dùng transaction. Sau khi giữ mỗi dòng, lưu ngay listingId/type/quantity vào danh sách để bù kho nếu metadata hoặc ghi đơn lỗi. Chỉ tạo Order/SubOrder sau khi giữ đủ mọi dòng. Nếu ghi con thứ hai lỗi, xóa những con/mẹ của chính request rồi hoàn kho. restoreItems tiếp tục hoàn các dòng khác nếu một dòng thất bại, sau đó báo lỗi để cần đối soát.

## Cách chạy và kiểm tra

Tại thư mục gốc, MongoDB local đang chạy:

```powershell
npm run dev:api
```

Không cần migrate hay seed lại dữ liệu chính cho bước này. Backend khởi tạo hai collection đơn và index mới. Nếu API cũ đang mở, khởi động lại để nhận route mới.

Kiểm thử độc lập (suite chỉ nhận tên bookmarket_test hoặc bookmarket_test_ với hậu tố chữ/số và xóa DB test sau khi chạy):

```powershell
$env:TEST_MONGO_URI='mongodb://127.0.0.1:27017/bookmarket_test_ordersstep1'
npm run test:api
npm run build
```

Xem body và quyền tại [API.md](API.md). Để thử bằng Postman dùng DB test riêng đã seed, login reader lấy Bearer token rồi POST /orders. Không tạo đơn thử trên DB cần giữ, vì bước này chưa có API hủy. Một request hợp lệ trả 201 cùng order/subOrders; thiếu hàng trả 409 và listingId. Các ca cạnh tranh dùng Promise.all trong orders.test.js, không dựa vào bấm tay.

## Đã làm và phần tiếp theo

Đã có 11 model, POST /orders, validate, snapshot, phân nhóm seller, phí do server tính, giữ kho có điều kiện và bù khi lỗi trong request. Chuẩn bị shipment trong model và một sự kiện pending; đây chưa phải luồng vận chuyển.

Chưa làm: xem đơn/phân trang/phân quyền đọc đơn, API hủy và hoàn kho đúng một lần theo trạng thái, frontend đơn giấy, API danh sách dịch vụ, xác nhận/vận đơn/timeline/đã nhận/hoàn hàng và tab admin vận chuyển. Chưa thêm/chạy script clean-test-data; không xóa tài khoản/shop hay database phát triển. users.isActive/listings.searchText đã được migration cũ dọn; script cleanup có xác nhận sẽ thuộc bước dọn dẹp sau.

Ebook và trao đổi tiếp tục mô phỏng. Chưa thanh toán thật, email thông báo, phí vùng/cân nặng, giao thất bại, tích hợp hãng vận chuyển, đánh giá hoặc bảo vệ ebook theo quyền mua.

## Giới hạn còn lại

Không transaction nên chỉ xử lý bù kho được khi request còn chạy và DB phản hồi. Tiến trình chết, mất kết nối sau một lần ghi không rõ thành công, hoặc lỗi xóa/hoàn kho có thể để lại dữ liệu cần đối soát. Chưa có tác vụ phục hồi khi khởi động hay idempotency cho lần gửi lại request. restoreItems không tự chống gọi lặp cho stock mới; ở bước hủy/hoàn hàng phải khóa chuyển trạng thái bằng findOneAndUpdate trước khi gọi. Việc chỉnh/xóa tin trong lúc đang giữ kho cũng chưa có cơ chế khóa riêng.

Hướng mở rộng sau các bước người dùng đã yêu cầu: kiểm tra đối soát bền vững, idempotency, phí theo vùng/cân nặng, xử lý giao thất bại, API hãng thật, thanh toán thật, email và đánh giá. Chưa coi những phần này là đã có.
