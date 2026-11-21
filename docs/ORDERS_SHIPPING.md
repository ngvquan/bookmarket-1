# Giai đoạn 2–3: đơn sách giấy và vận chuyển cơ bản

Luồng được nối từ React/Vite qua Express/Mongoose tới MongoDB. Bản ngày 05/11/2026 dùng transaction và idempotency, không thêm thư viện. Hiện có 16 collection gồm catalog, tài khoản, đơn và chat. ISBN vẫn ở Edition vì nhiều seller dùng chung một phiên bản. [Cấu hình và migration mới](HARDENING.md).

## Cách chạy

Tại thư mục gốc, cài lần đầu:

```powershell
npm run setup
node scripts/setup-env.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-mongo-replica.ps1
```

MongoDB cần là replica set; script local chạy cổng 27018. Với database cũ, sao lưu rồi chạy migration theo HARDENING.md. npm run seed chỉ thêm mẫu thiếu, không reset dữ liệu. Shop seed thiếu hồ sơ cần hoàn tất trước khi đăng new/digital. Mở hai terminal:

```powershell
npm run dev:api
```

```powershell
npm run dev
```

Frontend http://localhost:5173, API http://localhost:4000. Cấu hình trong backend/.env, mẫu backend/.env.example. Các tài khoản mẫu trong README. Không ghi JWT_SECRET thật vào Git/ZIP.

## Cách thử bằng giao diện

1. Đăng nhập user mua hàng, thêm sách giấy. Một ISBN có thể có nhiều offer độc lập của các seller.
2. Vào checkout, nhập người nhận và chọn Tiết kiệm/Nhanh cho từng seller. Server kiểm tra lại giá/seller/kho và tự tính phí; một seller chỉ một phí. Thiếu hàng hiện lỗi và nút Cập nhật lại giỏ.
3. Thành công COD: bỏ sách mới/cũ khỏi giỏ; ebook giữ lại để thanh toán VietQR riêng. Quyền ebook lưu trong database, không mất khi reload. Xem [PAYMENT_VIETQR.md](PAYMENT_VIETQR.md).
4. /don-hang có phân trang và nút Hủy đơn khi đơn con pending. Chi tiết đơn có người nhận, mã vận đơn, dịch vụ, timeline và trạng thái từng seller. Tổng đơn mẹ giữ snapshot ban đầu kể cả sau hủy.
5. Đăng nhập seller của tin bằng trình duyệt/context khác, vào /gian-hang → Đơn của shop. Xác nhận tạo mã BM + 8 ký tự hex in hoa; tiếp theo Giao cho hãng. Seller được hủy pending/confirmed và bắt buộc ghi lý do. Người bán sách cũ chưa có shop cũng dùng tab này.
6. Admin vào /quan-tri → Vận chuyển (demo), tìm đơn shipping, nhập ghi chú tùy chọn rồi Giao thành công hoặc Hoàn hàng. Hoàn hàng trả kho. Tab Đơn hàng xem toàn bộ đơn có phân trang.
7. Buyer xác nhận Đã nhận hàng khi delivered để hoàn tất. Các nút sai vai không có trên UI; gọi API trực tiếp vẫn bị kiểm tra độc lập.

## File và trách nhiệm

| File/nhóm | Làm gì và vì sao |
|---|---|
| backend/src/models/Order.js | Đơn mẹ: người nhận, buyer, COD và tổng snapshot. |
| backend/src/models/SubOrder.js | Đơn con mỗi seller, snapshot sách/shop và shipment/events. Index phục vụ buyer/seller/status và tin đang có đơn. |
| backend/src/routes/orders.js | POST giữ kho/tạo đơn; GET mine và chi tiết với quyền buyer/seller/admin. |
| backend/src/routes/subOrders.js | Seller list, confirm/ship/cancel; buyer cancel/received. |
| backend/src/routes/admin-orders.js | Admin list đơn và cập nhật hãng demo. Middleware chỉ gắn vào đúng route để giữ URL admin cũ. |
| backend/src/routes/shipping.js | Danh sách dịch vụ công khai, dùng chung cấu hình tính tiền. |
| backend/src/utils/order.js | Validate đầu vào thủ công và restoreItems dùng chung. |
| backend/src/utils/order-query.js | Phân trang/filter tại MongoDB; seller chỉ thấy dữ liệu được phép. |
| backend/src/utils/order-status.js | Một allowedNext và CAS chuyển trạng thái, thêm event, hoàn kho nếu hủy/hoàn. |
| backend/src/utils/shipping.js | Một object standard/fast; tính phí tại server. |
| backend/src/routes/listings.js | Chặn sửa/xóa tin đang có đơn chưa kết thúc để còn hoàn kho được. |
| frontend/src/services/api.js | orderService, shopOrderService, adminOrderService và shippingService dùng fetch/JWT. |
| frontend/src/hooks/useBookMarket.js | Checkout giấy qua API, ebook riêng, chống gửi lặp khi đang chờ, cập nhật giỏ sau lỗi. |
| frontend/src/utils/marketplace.js | Nhóm giỏ theo sellerId và dịch vụ lấy từ server; bỏ phí ghi cứng. |
| frontend/src/pages/OrdersPage.jsx, OrderDetailPage.jsx | Đơn buyer có phân trang, chi tiết/timeline. |
| frontend/src/pages/SellerPage.jsx, AdminPage.jsx | Gắn tab đơn shop, đơn admin và hãng demo. |
| frontend/src/components/SubOrderCard.jsx | Snapshot, trạng thái, timeline và nút theo vai. |
| frontend/src/components/ShopOrders.jsx, AdminOrders.jsx | Danh sách API có phân trang, filter và hiển thị lỗi. |
| frontend/src/utils/orders.js | Nhãn và màu hiển thị; không quyết định quyền thay server. |
| backend/scripts/clean-test-data.js | Xem trước, xác nhận, backup và dọn dữ liệu phát triển. |
| backend/tests/orders.test.js | Đặt/đọc/hủy, cạnh tranh kho, quyền, giao/hoàn và cleanup. |
| frontend/tests/api-foundation.spec.js | Luồng API thật trên trình duyệt; ebook dùng VietQR và lưu quyền sở hữu. |

## Các bước và kết quả đã chạy

- Models + đặt hàng: 26/26 API test, build đạt (mốc trước).
- Xem/hủy + test: 30/30 API test, build đạt. Lỗi middleware làm URL /admin/auth/register đổi 404 thành 401 đã được sửa và chạy lại.
- Nối frontend đơn hàng: build đạt.
- Dịch vụ/vận đơn/trạng thái: 33/33 API test, build đạt.
- Frontend vận chuyển và dọn dữ liệu: 35/35 API test, build đạt; Playwright kiểm tra giao diện từ đầu tới cuối. Kết quả lần cuối tại [VERIFICATION.md](VERIFICATION.md).

Không suy ra E2E đạt từ build. Các số trên là lần thực chạy sau từng nhóm thay đổi; số test tăng vì giữ nguyên test cũ và thêm ca mới.

## Chạy test độc lập

API tests tự dọn database test; chỉ cho bookmarket_test hoặc bookmarket_test_ với hậu tố chữ/số:

```powershell
$env:TEST_MONGO_URI='mongodb://127.0.0.1:27018/bookmarket_test_fullorders?replicaSet=bookmarket-rs'
npm run test:api
npm run build
```

E2E tạo tài khoản, đơn và trừ kho thật. Dùng database mới riêng cho mỗi lần chạy để sách cũ trong seed chưa bị mua. Terminal API QA:

```powershell
$env:MONGO_URI='mongodb://127.0.0.1:27018/bookmarket_test_fullui?replicaSet=bookmarket-rs'
$env:PORT='4001'
$env:NODE_ENV='test'
$env:JWT_SECRET=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')
npm run seed
npm run dev:api
```

Terminal Vite QA:

```powershell
$env:API_PROXY_TARGET='http://127.0.0.1:4001'
npm --prefix frontend run dev -- --port 5180 --strictPort
```

Terminal test:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5180'
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e
```

Có thể bỏ PLAYWRIGHT_CHANNEL khi đã cài Chromium bằng Playwright. Sau khi xong dừng riêng server QA; giữ dữ liệu chính riêng biệt.

## Dọn dữ liệu phát triển

Dừng API trước khi chạy npm run clean:test-data. Script báo chính xác database, số user @example.com/shop/tin sẽ xóa và giữ user đã có bất kỳ đơn ở vai buyer/seller. Enter hoặc nhập khác tên DB thì không sửa dữ liệu. Chỉ khi gõ đúng tên DB mới backup toàn bộ dữ liệu/index dạng Extended JSON vào exports/backups, xác minh file rồi xóa. Không xóa orders/suborders, catalog dùng chung hoặc admin. refreshsessions cũ được bỏ; users.isActive/listings.searchText được unset nếu còn. NODE_ENV=production bị chặn; tên DB phải thuộc BookMarket.

Cho kiểm thử tự động có tùy chọn --confirm=TÊN_DB chính xác, ví dụ tại thư mục backend: `node scripts/clean-test-data.js --confirm=bookmarket_test_fullorders`. Đây cũng là xác nhận xóa; không dùng nếu chưa đọc cảnh báo/xem dữ liệu. Script đã được thử trên DB test với cả xác nhận sai và đúng; không chạy xóa dữ liệu phát triển chính trong phiên triển khai.

## Đã đơn giản hóa và giới hạn

Giữ một ứng dụng Express, models/routes/utils, hàm thường và kiểm tra if. Không thêm dependency. Transaction dùng chung session cho đơn/kho; findOneAndUpdate kiểm tra đủ kho và trạng thái trước. Snapshot giữ lịch sử. Hãng/phí là hư cấu; admin thao tác thủ công.

Không có thanh toán thật, email, upload, đánh giá, phí vùng/cân nặng, API hãng thật hoặc quyền mua ebook. Có transaction cho đơn/kho và unique buyer/key cho gửi lại POST; frontend có khôi phục lần đặt chưa rõ kết quả. Các chỉnh sửa tin bị chặn theo trạng thái đơn; lịch sử dùng snapshot.

Đánh giá sau khi mua đã triển khai: chỉ đơn completed được gửi, xem [REVIEWS.md](REVIEWS.md). Hướng mở rộng: phí theo vùng/cân nặng, tích hợp hãng thật, thanh toán/hoàn tiền thật và email.
