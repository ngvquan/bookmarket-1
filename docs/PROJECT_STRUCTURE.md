# Cấu trúc dự án

Mốc sắp xếp: 03/11/2026 (giờ Việt Nam). Giữ React/Vite, JavaScript và Express/Mongoose; không thêm dependency hay thay đổi mô hình dữ liệu.

Cập nhật sau mốc sắp xếp: đã hoàn thành Order/SubOrder, checkout server và vận chuyển demo; xem [ORDERS_SHIPPING.md](ORDERS_SHIPPING.md).

```text
BookMarket/
  backend/
    src/
      server.js             Kết nối MongoDB và mở HTTP server
      app.js                Express app, ghép routes và xử lý lỗi
      models/               16 model MongoDB, gồm đơn hàng, chat và Review
      routes/               Auth, shops, listings, orders, shipping, seller, conversations, reviews
      middleware/           Xác thực và phân quyền
      utils/                Validate, catalog/search/DTO, hoàn kho, phí giao
      migrations/           Logic chuyển đổi schema
    scripts/                seed.js, migrate.js, export-database.js, clean-test-data.js
    tests/                  Kiểm thử API
    .env.example            Mẫu cấu hình, không chứa secret thật
  frontend/
    src/
      App.jsx               Ghép bố cục, trang và modal
      main.jsx              Khởi tạo React và nạp CSS
      pages/                Mỗi trang một file *Page.jsx
      components/           UI dùng chung, form, modal, đọc PDF
      hooks/                Trạng thái phiên, API và luồng demo
      services/             Gọi API bằng fetch
      data/                 Danh mục và sách minh họa
      utils/                Format, định danh, kiểm tra và PDF
      styles/               CSS giao diện và bìa sách
    tests/                  Playwright và fixture hồi quy
  docs/
    history/                Tài liệu các mốc cũ
  scripts/                  setup-env.mjs, package-source.py
  exports/                  Backup/database xuất/source ZIP mới
  archives/
    packages/               Các ZIP cũ
    legacy/                 Source Expo cũ
    empty-backend-folders/  Vỏ thư mục backend cũ đã trống
  package.json              Lệnh chạy từ thư mục gốc
  README.md
```

## Các file đã chuyển

| Trước | Hiện tại |
|---|---|
| backend/app.js, server.js | backend/src/app.js, server.js |
| backend/models, routes, middleware, utils, migrations | backend/src/ với cùng tên thư mục |
| backend/seed.js, migrate.js, export-database.js | backend/scripts/ với cùng tên file |
| frontend/src/Home.jsx, Catalog.jsx | frontend/src/pages/HomePage.jsx, CatalogPage.jsx |
| frontend/src/Sellers.jsx | pages/SellerDirectoryPage.jsx và SellerStorefrontPage.jsx |
| frontend/src/pages/Seller.jsx, Admin.jsx | pages/SellerPage.jsx, AdminPage.jsx |
| frontend/src/components.jsx | components/BookUI.jsx, UI.jsx và index.js |
| frontend/src/data.js | data/catalog.js, data/books.js và utils/format.js |
| frontend/src/marketplace.js | frontend/src/utils/marketplace.js |
| CSS trong frontend/src/ | frontend/src/styles/ |
| Tài liệu bàn giao và checkpoint cũ | docs/history/ |
| ZIP ở thư mục gốc, book-main-3/ | archives/packages/, archives/legacy/ |

Đã cập nhật import, script npm, fixture và đường dẫn backup/export tương ứng. `.env` vẫn ở backend; không chuyển vào src. Lệnh chạy, seed, migrate, build và test từ gốc không thay đổi. Xuất dữ liệu dùng `npm run export:db`.

## Đóng gói

Chạy `python scripts/package-source.py` từ thư mục gốc. ZIP mới ở `exports/source/BookMarket-stage2-3-light.zip`, chỉ gồm mã nguồn cần chạy, cấu hình mẫu, lockfile, test và tài liệu. Không kèm node_modules, dist, test-results, .env, database xuất hoặc archives.

Ảnh và PDF ebook được lưu trong `backend/storage` (đã gitignore), hoặc đường dẫn riêng cấu hình bằng `BOOKMARKET_STORAGE_DIR`. MongoDB chỉ lưu ID tệp; quyền đọc ebook đầy đủ kiểm tra bằng EbookAccess.
