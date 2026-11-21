# Chuyển BookMarket sang 9 collection

> Phần dưới ghi lại mốc chuẩn hóa catalog. Bản ngày 05/11/2026 có 13 model, chat, hồ sơ shop hoàn tất, transaction đơn/kho, idempotency và migration index; xem [HARDENING.md](HARDENING.md). Ebook và trao đổi tiếp tục mô phỏng. Mô tả 9/11 collection ở các mốc cũ bên dưới là lịch sử.

## Phạm vi đã thực hiện

Giữ React/Vite, Express/Mongoose, validate if, fetch, JWT 7 ngày. Không thêm dependency. Các sửa giỏ/khả dụng/Modal/storage/ErrorBoundary/trim/UUID vẫn giữ. Người dùng đã chốt tách admin, tác giả, NXB, thể loại, tác phẩm và phiên bản.

| File / nhóm | Trách nhiệm |
|---|---|
| backend/src/models/*.js | Chín model User,Admin,Shop,Author,Publisher,Category,Book,Edition,Listing; index.js liệt kê để init/test. |
| backend/src/routes/auth.js, admin-auth.js | Hai route login riêng; không public register admin. |
| backend/src/middleware/auth.js | JWT accountType, đọc lại collection, requireUser/requireAdmin. Không tin role từ client. |
| backend/src/utils/credentials.js | Validate email/password chung, không factory. |
| backend/src/utils/catalog.js | Tìm/tạo quan hệ catalog, chống ghi đè metadata ISBN của seller khác, chuyển metadata thành DTO. |
| backend/src/utils/catalog-search.js | Lọc sách/phiên bản bằng metadata ở các collection đã tách. |
| backend/src/utils/listing.js | Validate form phẳng; trả DTO gồm metadata quan hệ để không viết lại UI. |
| backend/src/routes/listings.js | Owner CRUD, public/mine/admin query và phân trang; title sort join book/edition ở MongoDB. |
| backend/scripts/migrate.js | Backup JSON có kiểu dữ liệu và index trước khi đổi; không tự chạy khi mở server. |
| backend/src/migrations/normalize-database.js | Chuyển dữ liệu, kiểm tra liên kết/hash, giữ ID và trạng thái, rồi mới bỏ field cũ. |
| backend/scripts/seed.js | Seed chín model, admin vào admins; giữ dữ liệu đã có, chặn production. |
| frontend/src/services/api.js | Login mode admin; metadata DTO vẫn phẳng, ghép bìa mẫu; đánh giá thật lấy từ /reviews. |
| frontend/src/components/Auth.jsx, AccessGate.jsx và frontend/src/App.jsx | Modal admin login riêng ở /quan-tri, không hiện đăng ký admin; user thường không vào quản trị. |
| backend/scripts/export-database.js | Xuất dữ liệu/schema thực có trong DB, gồm DigitalOrder, EbookAccess và BankTransaction; không xuất .env. |

Frontend còn dùng tên biến books cho mảng DTO tin bán như trước; đó không phải array document của collection books. DTO có editionId/bookId và dữ liệu đã populate. Giữ tên này để tránh sửa lại toàn bộ UI.

## Migration đã chạy

Trước thay đổi đã có backup đầy đủ JSON (Extended JSON, giữ ObjectId/Date, kèm index) tại exports/backups/before-nine-collections-2026-11-02T16-20-57-977Z.json. Source cũ: archives/packages/BookMarket-before-nine-collections.zip. Script migrate cũng tạo backup riêng trước khi chuyển dữ liệu. Các file dữ liệu backup không nằm trong ZIP source/Git.

Migration chuyển 18 tin sang editionId, chuyển một admin từ users sang admins với cùng ID/hash, giữ nguyên 50 user và 14 shop còn lại. Kết quả: 13 authors, 2 publishers, 4 categories, 16 books, 16 editions, 18 listings. Ba offer Nhà giả kim cùng một editionId, ba seller khác nhau.

Sau khi kiểm tra liên kết, bỏ users.role/isActive, metadata/presentation lặp trong listings và collection refreshsessions cũ. Bản sao các dữ liệu đó vẫn nằm trong backup. Admin cũ có shop/tin thì script sẽ dừng để chuyển quyền trước, không tự bỏ chủ sở hữu. Nếu lỗi giữa chừng, field cũ chưa bị dọn cho tới khi kiểm tra hoàn tất. Chạy lại không tạo trùng dữ liệu; xem VERIFICATION.md cho kết quả thực tế.

Không chạy lại seed để reset data; seed chỉ thêm bản mẫu còn thiếu. Metadata tác phẩm được dùng lại theo tên chuẩn hóa/tác giả/thể loại. Tin mới bắt buộc ISBN; API gợi ý phiên bản theo ISBN hoặc tên + tác giả nhưng backend mới là nơi quyết định editionId. Khi seller sửa tác phẩm của một phiên bản riêng, không cập nhật book của các phiên bản khác.

## Chạy và kiểm tra

Môi trường cũ: npm run setup; node scripts/setup-env.mjs; npm run migrate; npm run seed; npm run dev:api. Mở terminal khác npm run dev. Token cũ không có accountType cần đăng nhập lại.

Chạy npm run build và npm run test:api. Test API chỉ nhận DB bookmarket_test hoặc bookmarket_test_* và dọn DB test sau suite. E2E kiểm tra trên MongoDB/API/Vite riêng để không thêm tài khoản thử vào DB chính; hướng dẫn lệnh trong VERIFICATION.md.

Ở mốc chuẩn hóa catalog này chưa có đơn hàng server; đơn hàng và vận chuyển demo đã thêm sau, xem ORDERS_SHIPPING.md. Hiện chưa thanh toán thật/upload/quyền đọc ebook phía server; ebook/thư viện/trao đổi vẫn mô phỏng trong bộ nhớ. Chưa có giao diện CRUD riêng cho catalog dùng chung hoặc xử lý hợp nhất tác giả trùng tên ngoài thuật toán tên chuẩn hóa hiện tại. JWT trong localStorage, đăng xuất chưa thu hồi token đã sao chép, chưa có refresh/rate limit/quên mật khẩu.
