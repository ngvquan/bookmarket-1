# Thay đổi ngày 07/11/2026

## E — upload và phân phối ebook — 08/11/2026

Thêm upload tối đa 5 ảnh và một PDF cho tin ebook; đọc thử tối đa 2 trang. File đầy đủ chỉ trả cho chủ tin hoặc buyer có EbookAccess được cấp sau thanh toán VietQR. Không dùng lại API mua giả lập từ source cũ. PDF/ảnh lưu ở `backend/storage` hoặc `BOOKMARKET_STORAGE_DIR`.

## D — ghép tính năng marketplace phù hợp — 08/11/2026

Thêm Follow và bảng tin shop đang theo dõi; người bán phản hồi đánh giá và tự ẩn/hiện tin; chi tiết sách gợi ý cùng tác giả/thể loại. Không khôi phục trao đổi sách hoặc ebook session từ source cũ. Database hiện có 18 collection.

## C — tài khoản chung của sàn và BankTransaction

- Bỏ `Shop.paymentBank` khỏi schema, API và ba form shop; shop hoàn tất chỉ cần liên hệ + địa chỉ.
- Thêm `getPlatformBank()` và sáu biến PAYMENT_*; một đơn ebook được chứa nhiều shop nhưng dùng một QR của sàn.
- Thêm model/API/UI BankTransaction để lưu, chọn và giải quyết giao dịch webhook chưa khớp.
- Ebook 0đ paid và cấp quyền ngay; response buyer được lọc; thư viện gom truy vấn Listing; reader ưu tiên dữ liệu đã tải.
- Migration hardening gỡ field cũ, tạo index mới và vẫn backup trước khi apply. Bản xuất database có 17 collection.

## A — bỏ trao đổi (đã kiểm tra trước khi làm B)

Thêm backend/src/migrations/remove-exchange.js và backend/scripts/migrate-remove-exchange.js. Đăng ký migrate:remove-exchange trong package.json gốc và backend/package.json. Xem trước không ghi; --apply backup rồi xóa tin exchange và gỡ wanted. Chạy lại không thay đổi gì.

Sửa backend/src/models/Listing.js; backend/src/utils/listing.js, catalog.js, seller-stats.js; backend/src/routes/listings.js; backend/scripts/seed-extra.js; dữ liệu mẫu frontend/src/data/books.js và catalog.js. catalog-search.js không có nhánh trao đổi nên không cần sửa. API từ chối type=exchange với 400; các danh sách không trả dữ liệu trao đổi cũ ngay cả khi chưa chạy migration.

Xóa frontend/src/pages/RequestsPage.jsx. Sửa frontend/src/App.jsx, hooks/useBookMarket.js, utils/marketplace.js, components/BookUI.jsx, PostForm.jsx, MarketplaceHeader.jsx, MarketplaceFooter.jsx, SellerStats.jsx và pages/CatalogPage.jsx, HomePage.jsx, SellerStorefrontPage.jsx, AdminPage.jsx. Bỏ form, menu, thẻ, bộ lọc, modal, state và kiểm tra đề nghị trao đổi; link /trao-doi và /yeu-cau cũ về trang chủ. SellerLayout/SellerPage/SearchPanel dùng types/catalogSections chung nên tự nhận ba loại tin còn lại, không thêm nhánh mới. Bỏ CSS trao đổi khỏi frontend/src/styles/styles.css và commerce.css.

Sửa test API, orders, seller-stats, database trong backend/tests và frontend/tests/api-foundation.spec.js; bỏ e2e trao đổi, thêm kiểm tra redirect/từ chối loại cũ và migration backup.

## B — thanh toán và quyền ebook

File mới:

- backend/src/models/DigitalOrder.js, EbookAccess.js.
- backend/src/utils/vietqr.js, digital-order.js, ebook-access.js, digital-stats.js.
- backend/src/routes/digital-orders.js, library.js.
- backend/scripts/seed-ebook-library.js.
- backend/tests/digital-orders.test.js.
- frontend/src/hooks/useEbookLibrary.js.
- frontend/src/components/PaymentModal.jsx, DigitalOrders.jsx, AdminDigitalOrders.jsx.
- docs/PAYMENT_VIETQR.md, CHANGELOG_VIETQR.md.

File sửa:

- backend/src/models/index.js và app.js: đăng ký hai model/route mới.
- backend/src/routes/listings.js: bảo vệ ebook có đơn paid; routes/orders.js: COD từ chối ebook, hướng dẫn chuyển khoản.
- backend/src/utils/seller-stats.js: doanh thu paid tách paperRevenue/digitalRevenue; biểu đồ tổng, kho/sách bán chạy vẫn riêng sách giấy.
- backend/src/migrations/harden-database.js và backend/tests/database.test.js: hiểu unique partial theo trạng thái đơn ebook, kiểm tra quan hệ đơn paid/quyền và refs mới.
- backend/.env.example: thêm PAYMENT_* để trống; không sửa backend/.env thật.
- backend/scripts/seed.js, seed-extra.js: quyền/đơn minh họa cho tài khoản demo khi chủ động seed; export-database.js: đủ schema/index cả collection rỗng, bỏ trao đổi khỏi bản xuất.
- frontend/src/services/api.js: API ebook, thư viện, đối soát admin.
- frontend/src/hooks/useBookMarket.js, useRemoteMarket.js: bỏ mô phỏng, đọc quyền API, giỏ chỉ xóa ebook khi có thanh toán/quyền xác nhận.
- frontend/src/App.jsx: modal QR, route thư viện/đơn; pages/LibraryPage.jsx, OrdersPage.jsx, AdminPage.jsx; components/BookUI.jsx, Reader.jsx, SellerStats.jsx; styles/marketplace.css.
- frontend/tests/api-foundation.spec.js: checkout hỗn hợp + webhook test, quyền còn sau reload, mở lại/hủy QR, ngừng polling khi đóng, admin mark-paid, redirect cũ và hồi quy đơn/đánh giá.
- backend/tests/orders.test.js, seller-stats.test.js: sửa kỳ vọng thông báo/trường doanh thu theo luồng mới.
- README.md, docs/API.md, DATA_MODEL.md, DATABASE_EXPORT.md, PROJECT_STRUCTURE.md, ORDERS_SHIPPING.md, README.md, VERIFICATION.md: tài liệu hiện tại.
- database/data/*.json, database/schema.json, database/CAU_TRUC_DATABASE.md và database/DANH_SACH_FIELD.csv: bản chuyển máy có 16 collection, không còn exchange/wanted. Dữ liệu được tạo từ bản sao của snapshot cũ; không sửa database chính.

Xóa frontend/src/hooks/useSessionDemo.js. Không thêm dependency; Reader vẫn tạo PDF mẫu, không triển khai upload hoặc phân phối PDF thật.

## Lệnh và cấu hình cần làm

```powershell
npm run migrate:remove-exchange
npm run migrate:remove-exchange -- --apply
npm run migrate:hardening
npm run migrate:hardening -- --apply
```

Đọc báo cáo xem trước trước khi dùng --apply. Bản hiện tại đã thay mô hình cũ: shop không còn tài khoản nhận riêng; `.env` backend cần bốn biến PAYMENT_BANK_* / PAYMENT_ACCOUNT_* của sàn, PAYMENT_WEBHOOK_SECRET (ít nhất 32 ký tự) và PAYMENT_QR_TEMPLATE. Chọn SePay JSON/API Key, URL HTTPS + /webhooks/bank-transaction. Cấu hình và giới hạn hiện hành: PAYMENT_VIETQR.md.

## Kiểm chứng và giới hạn

Không chuyển tiền thật, không cấu hình ngân hàng/secret thật và không gọi webhook từ tài khoản SePay của người dùng trong phiên này. Test API dùng MongoDB replica set test riêng; e2e gọi webhook với secret test và chặn tải ảnh QR ra mạng. Kết quả chạy thực tế được ghi trong VERIFICATION.md. Không báo đã xác minh quét QR thật, chuyển tiền thật, ngrok public hoặc phân phối PDF thật.
