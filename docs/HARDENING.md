# Hoàn thiện shop, đơn hàng và database — 05/11/2026

Giữ React, Express và Mongoose hiện có; không thêm thư viện. Các đoạn quan trọng có comment tiếng Việt. Bốn phần dưới dùng cùng các model/route cũ.

## 1. Shop hoàn tất mới được đăng sách mới hoặc ebook

Shop có `contactName`, `contactPhone`, `contactEmail`, `pickupAddress: {province, ward, detail}`, `isRegistrationComplete` và `registrationCompletedAt`. Client không được tự gán cờ hoặc thời điểm hoàn tất.

API đăng ký yêu cầu đủ hồ sơ và xác nhận. Shop cũ thiếu hồ sơ có cờ false; vào **Thông tin gian hàng**, điền đầy đủ và bấm **Hoàn tất đăng ký**. API PATCH tự kiểm tra rồi đặt cờ true. Không tự điền thông tin liên hệ giả khi migration.

POST/PATCH `/listings` kiểm tra cả cờ hoàn tất lẫn dữ liệu hồ sơ khi loại sách là new/digital. Hồ sơ hoàn tất gồm liên hệ và địa chỉ lấy hàng. React ẩn nút gửi và nhắc bổ sung hồ sơ. Tài khoản VietQR là cấu hình chung của sàn; sách cũ không bắt buộc có shop.

Tự thử: shop thiếu hồ sơ → chọn sách mới/ebook → bị chặn; hoàn tất hồ sơ → đăng được; thử gọi API trực tiếp vẫn bị kiểm tra độc lập.

## 2. Đơn và kho dùng transaction

```text
pending → confirmed → shipping → delivered → completed
pending / confirmed → cancelled
shipping / delivered / completed → returned
```

Seller xác nhận/giao, buyer xác nhận nhận; admin xử lý giao thành công/hoàn hàng. Buyer chỉ hủy pending; seller hủy pending/confirmed và phải có lý do. Đơn hủy/hoàn không được giao tiếp.

Cả new và used đều trừ kho bằng `findOneAndUpdate` với `stock >= quantity` và `$inc`. Used có đúng một cuốn; khi đặt, stock=0 và status=sold. Hủy/hoàn tăng lại stock; used trở về approved.

Tạo đơn mẹ, đơn con và trừ kho nằm trong một transaction. Đổi trạng thái, ghi timeline và hoàn kho cũng nằm trong một transaction. Một bước lỗi thì các bước đã ghi trong transaction đều bị hủy. Điều kiện trạng thái ngăn hai request hoàn cùng một đơn hai lần.

Doanh thu chỉ tổng hợp đơn con **đang có status=completed**, lấy tiền sách, không tính phí giao. Khi admin chuyển completed → returned, tiền đơn bị loại khỏi doanh thu và số sách bán; lịch sử timeline vẫn giữ. Đây là điều chỉnh thống kê COD demo, chưa có cổng thanh toán hoặc API hoàn tiền thật.

Tin có đơn hoàn tất không được xóa hoặc đổi loại sách để còn hỗ trợ hoàn hàng; tin mới vẫn được sửa giá/mô tả sau khi không còn đơn đang xử lý. Lịch sử dùng snapshot, không sửa theo giá mới.

Tự thử: đặt cùng một cuốn cuối bằng hai tài khoản; chỉ một người mua được. Hủy/hoàn rồi xem kho. Hoàn tất đơn → doanh thu tăng → admin hoàn hàng → doanh thu giảm lại. Test API còn giả lập lỗi ghi đơn con và lỗi hoàn kho giữa chừng.

## 3. Chống đặt trùng

React tạo `idempotencyKey` ngẫu nhiên trước khi gửi POST `/orders`. Backend bắt buộc nhận mã hợp lệ và lưu trong Order. Unique index `{buyerId: 1, idempotencyKey: 1}` bảo đảm cùng người mua/cùng mã chỉ có một đơn, kể cả nhiều tiến trình API.

- Mới tạo: HTTP 201, `{order, replayed:false}`.
- Gửi lại cùng nội dung: HTTP 200, `{order, replayed:true}`; không kiểm tra/trừ lại kho.
- Cùng mã nhưng đổi người nhận/sách/số lượng/dịch vụ: HTTP 409. Server so SHA-256 nội dung đã chuẩn hóa qua `requestHash`.
- Hai người mua khác nhau được dùng cùng chuỗi key, nhưng quyền và đơn vẫn tách biệt.
- Lần đặt đã hủy vẫn giữ key: gửi lại key đó trả chính đơn đã hủy. Muốn đặt mới phải dùng key mới.

Nút đặt bị khóa khi gửi và có ref chặn gọi đồng thời. Nếu mất phản hồi, tab giữ payload gồm người nhận, địa chỉ, items, dịch vụ và key trong **sessionStorage**. Nút **Kiểm tra lần đặt trước** gửi lại chính payload đó, kể cả sau khi tải lại trang hoặc sách cũ đã hết kho. Xóa dữ liệu tạm khi nhận kết quả thành công hoặc lỗi 4xx xác định. Đóng tab/xóa storage sẽ mất dữ liệu tạm; mã trên server vẫn giữ trong đơn, người mua có thể kiểm tra danh sách đơn của mình.

Tự thử: bấm nhiều lần hoặc ngắt phản hồi POST sau khi server lưu; kiểm tra lại trên cùng tab hoặc tải lại trang rồi bấm nút kiểm tra. Chỉ có một đơn và một lần trừ kho.

## 4. Schema, index và migration

Ở mốc hardening giữ 13 collection, không thêm collection mới. Phần đánh giá triển khai sau đó bổ sung collection thứ 14 là reviews, không cần sửa dữ liệu cũ; xem [REVIEWS.md](REVIEWS.md). Ref tài khoản/shop/catalog dùng ObjectId; Listing `_id` và SubOrder.items.listingId vẫn dùng String để giữ các ID seed cũ.

- Schema kiểm tra required, enum, độ dài, số nguyên, giá 0–100.000.000₫, kho 0–100.000; used tối đa một cuốn.
- Order/SubOrder kiểm tra tổng tiền với snapshot; các tổng và phí là số nguyên không âm.
- Model Shop từ chối cờ hoàn tất khi thiếu hồ sơ. Book cần 1–10 tác giả; ISBN 10/13 ký tự; năm 1400–2100; sequence chat là số nguyên không âm/dương phù hợp.
- Listing có index ghép theo status/type/ngày/giá, seller/ngày, edition/status/type/giá, shop/status. Book có authorIds/categoryId; Edition có publisherId.
- Order có buyer/ngày, ngày và unique buyer/key. SubOrder có seller/status/ngày, seller/ngày, buyer/ngày, status/ngày, unique order/seller và items.listingId/status.
- Bỏ index đơn trùng phần đầu index ghép hoặc index cũ không còn trong schema bằng migration; không syncIndexes mỗi lần mở server.

**Sao lưu trước khi chạy trên dữ liệu cần giữ. Dừng backend khi migration để không có thao tác ghi chen vào.** Script tự tạo và đọc lại backup đầy đủ dữ liệu/index trước khi sửa. Chế độ mặc định chỉ xem trước:

```powershell
npm run migrate:hardening
npm run migrate:hardening -- --apply
```

Script dùng MONGO_URI trong backend/.env. Dry-run trả số bản ghi cần cập nhật, index sẽ tạo/xóa và lỗi dữ liệu. Có lỗi kiểu dữ liệu, schema, ref, chủ shop hoặc unique thì dừng, không tự xóa bản ghi để vượt qua lỗi. `--apply` đồng bộ index theo schema, nên cần đọc danh sách index sẽ xóa nếu database từng được tạo index ngoài ứng dụng.

Migration: gán cờ shop theo hồ sơ thực; bổ sung thời điểm hoàn tất cho hồ sơ đủ; gán `legacy_<orderId>` cho đơn cũ thiếu key; chuẩn hóa used sold về stock=0; bổ sung kho thiếu theo quy tắc cũ; bỏ ISBN rỗng để đúng unique/sparse. Không suy đoán requestHash của đơn lịch sử. Giữ nguyên ID, tài khoản, passwordHash và snapshot. Chạy lại sẽ không tiếp tục thay đổi dữ liệu đã đúng.

## MongoDB replica set local và cách chạy

Transaction không chạy trên MongoDB standalone. Dùng MongoDB Atlas hoặc replica set. Bản local có script tạo **một node để phát triển**, cổng 27018, tên `bookmarket-rs`, data tại `.local/mongo-rs`; không sửa service standalone cổng 27017.

```powershell
# Tại thư mục gốc BookMarket; cần MongoDB đã cài và npm run setup đã chạy.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-mongo-replica.ps1
```

Nếu không tự tìm được mongod.exe, thêm `-MongodPath 'D:\mongo\bin\mongod.exe'` theo vị trí trên máy. Script chạy lại được, không reset data. Sau khi khởi động lại Windows, chạy lại script trước backend. Mô hình một node này dùng để học/thử; không tạo khả năng dự phòng nhiều máy.

```text
MONGO_URI=mongodb://127.0.0.1:27018/bookmarket_foundation?replicaSet=bookmarket-rs
TEST_MONGO_URI=mongodb://127.0.0.1:27018/bookmarket_test_simple?replicaSet=bookmarket-rs
```

Giữ JWT_SECRET hiện có. Nếu chuyển dữ liệu từ standalone, xuất/khôi phục toàn bộ sang database rỗng trên replica set rồi kiểm tra số lượng/ID trước khi đổi MONGO_URI. Script `backend/scripts/restore-packaged-database.mjs` nhận URI đích và đường dẫn thư mục export; tự từ chối ghi đè database đã có collection.

```powershell
npm run dev:api
# Terminal thứ hai
npm run dev
```

Frontend http://localhost:5173, backend http://localhost:4000. Không cấu hình replica set thì thao tác đơn trả 503 kèm hướng dẫn; không âm thầm bỏ transaction để tiếp tục ghi.

## File sửa/thêm theo từng việc

| Việc | File |
|---|---|
| 1 — backend | `backend/src/models/Shop.js`, `utils/shop.js`, `utils/user.js`, `routes/shops.js`, `routes/listings.js`, `backend/tests/api.test.js` |
| 1 — React | `frontend/src/components/PostForm.jsx`, `ShopSettingsForm.jsx`, `frontend/src/pages/ShopRegistrationPage.jsx`, `SellerPage.jsx`, `frontend/tests/api-foundation.spec.js` |
| 2 | `backend/src/routes/orders.js`, `admin-orders.js`, `backend/src/utils/order.js`, `order-status.js`, `order-transaction.js`, `catalog.js`, `backend/src/app.js`, `backend/tests/orders.test.js`, `frontend/src/components/SubOrderCard.jsx` |
| 2 — môi trường | `scripts/start-mongo-replica.ps1`, `backend/scripts/init-mongo-replica.mjs`, `.gitignore` |
| 3 | `backend/src/models/Order.js`, `backend/src/utils/order.js`, `backend/src/routes/orders.js`, `backend/tests/orders.test.js`, `frontend/src/utils/checkout.js`, `frontend/src/hooks/useBookMarket.js`, `frontend/src/App.jsx`, `frontend/tests/api-foundation.spec.js` |
| 4 — models | Toàn bộ 13 file trong `backend/src/models/`: User, Admin, Shop, Author, Publisher, Category, Book, Edition, Listing, Order, SubOrder, Conversation, Message |
| 4 — kiểm tra/migration | `backend/src/migrations/harden-database.js`, `backend/src/utils/database-backup.js`, `backend/scripts/migrate-hardening.js`, `backend/tests/database.test.js`, `backend/src/utils/listing.js`, `backend/src/utils/order.js`, `backend/src/routes/listings.js` |
| 4 — cấu hình | `package.json`, `backend/package.json`, `backend/.env.example`, `scripts/setup-env.mjs`, cấu hình local `backend/.env` (không đóng gói secret) |
| 4 — React | `frontend/src/components/PostForm.jsx`, `frontend/src/App.jsx`: giới hạn giá/kho/độ dài khớp API; test catalog trong `frontend/tests/api-foundation.spec.js` đọc đủ các trang khi kiểm tra tổng |
| 4 — báo cáo database | `backend/scripts/export-database.js`: mô tả các field shop, chống trùng và tin nhắn trong báo cáo xuất |
| Tài liệu | `README.md`, `docs/README.md`, `HARDENING.md`, `API.md`, `DATA_MODEL.md`, `SHOP_REGISTRATION.md`, `SELLER_STATS.md`, `ORDERS_SHIPPING.md`, `DATABASE_EXPORT.md`, `PACKAGED_BACKUP.md`, `IMPLEMENTATION.md`, `VERIFICATION.md` |

## Kiểm tra tự động

```powershell
# Database này bị xóa sau test; không dùng database có dữ liệu cần giữ.
$env:TEST_MONGO_URI='mongodb://127.0.0.1:27018/bookmarket_test_hardening?replicaSet=bookmarket-rs'
npm run test:api
npm run build
```

Playwright cần API QA cổng 4001/Vite 5180 trỏ tới database **khác**, có prefix bookmarket_test_ và được seed riêng. Không chạy test mua/hủy trên database đang dùng. Kết quả thực tế trong [VERIFICATION.md](VERIFICATION.md).
