# Dữ liệu mẫu mở rộng

Chạy tại thư mục gốc dự án:

```powershell
npm run seed:extra
```

Xem trước mà không ghi database (tại thư mục backend):

```powershell
npm run seed:extra -- --dry-run
```

Script đọc `backend/.env` và chỉ bổ sung dữ liệu bằng ID/email/ISBN ổn định. Không xóa, không sửa giá/tồn kho, không khôi phục tin đã bán, không thay mật khẩu và không tạo đơn hàng giả. Những bản ghi đã tồn tại được bỏ qua. Không chạy trong `NODE_ENV=production`.

## Phạm vi bổ sung

- 60 đầu sách giấy thuộc văn học, phát triển bản thân, kinh tế, tâm lý và thiếu nhi.
- Mỗi đầu sách giấy có 2 tin sách mới từ hai gian hàng khác nhau và 1 tin sách cũ từ cá nhân: 180 tin mua bán.
- 30 tin trao đổi từ các cá nhân.
- 12 ebook mẫu của BookMarket Studio. Chức năng đọc tiếp tục dùng PDF demo hiện có, không phải nội dung thương mại của các tác phẩm sách giấy.
- 6 tin sách mới bổ sung từ nhà bán khác; hiển thị ngay. ID cũ có hậu tố pending được giữ để không mất liên kết.
- 12 gian hàng mới và 12 cá nhân mới, tương ứng 24 tài khoản người bán.

Tổng cộng **228 tin mới**, có thể chạy lại mà không tạo trùng. Mỗi tin vẫn giữ người bán, giá, số lượng, tình trạng và địa điểm riêng. Các tin cùng phiên bản dùng chung edition/ISBN để thử so sánh nhà bán. Thời điểm đăng được trải đều để các thể loại cùng xuất hiện trên trang chủ.

Đây là dữ liệu phục vụ đồ án. Tên sách/tác giả tham khảo các tác phẩm đã biết; giá, tồn kho, ISBN, nhà xuất bản, năm xuất bản, người bán và địa điểm giao dịch là dữ liệu minh họa. Không coi ISBN này là thông tin xuất bản thật. Mô tả ngắn do dự án biên soạn cho dữ liệu mẫu.

## Tệp và kiểm tra

- `frontend/src/data/extraBooks.js`: danh sách đầu sách, phần hiển thị và ebook mẫu. Giữ thứ tự các hàng đã seed để mã ISBN minh họa không thay đổi.
- `backend/scripts/seed-extra.js`: bổ sung catalog, tài khoản, gian hàng và tin đăng; đối chiếu fingerprint của toàn bộ bản ghi cũ để xác nhận không thay đổi.
- `exports/seed-extra/seed-*.json`: báo cáo từng lần chạy, số bản ghi và ID các tin vừa thêm; không chứa mật khẩu hoặc hash mật khẩu.
- `frontend/src/data/extraCovers.json`: ánh xạ ảnh bìa đã tải thành công. Ảnh nằm tại `frontend/public/covers/extra/`, nguồn ghi ở `sources.json` cùng thư mục. Chạy `node scripts/fetch-extra-covers.mjs` từ frontend để bổ sung các ảnh còn thiếu; sách chưa có ảnh dùng bìa chữ minh họa.

Tài khoản demo dùng `SEED_PASSWORD` khi tạo mới, hoặc mật khẩu mặc định được nêu trong README. Email gian hàng từ `extra-shop-01@bookmarket.local` đến `extra-shop-12@bookmarket.local`; email cá nhân từ `extra-reader-01@bookmarket.local` đến `extra-reader-12@bookmarket.local`. Seed lại không thay mật khẩu đã có.

Đã kiểm tra trên database riêng: lần đầu thêm 228 tin, lần hai thêm 0 tin; fingerprint các bản ghi cũ không thay đổi. Sau khi chạy trên database dự án, xác minh lại qua API catalog và giao diện, gồm phân trang và các bản bán chung ISBN.

Kết quả trên `bookmarket_foundation` ngày 03/11/2026: thêm 228 tin; giữ nguyên 135 bản ghi đã có. Database có 246 tin, 88 tác phẩm, 88 phiên bản, 75 tài khoản user và 26 gian hàng. API công khai trả 192 tin sách giấy (20 trang khi limit=10), 34 tin trao đổi và 14 ebook; 6 tin bổ sung còn chờ duyệt. Không có liên kết edition/book, listing/seller/shop lỗi; số lượng sách cũ và tồn kho sách mới đã được kiểm tra.

Với catalog lớn, các tab thể loại trên trang chủ lấy một trang kết quả từ API, thay vì chỉ lọc 12 tin đã tải ban đầu. Mở thể loại nào sẽ tìm trên toàn bộ catalog; giỏ hàng và chi tiết sách tiếp tục dùng giá/tình trạng từ backend.
