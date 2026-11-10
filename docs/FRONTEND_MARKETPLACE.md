# Giao diện sàn sách BookMarket

## Hướng thiết kế

Giữ tên BookMarket và màu xanh của dự án. Tổ chức giao diện theo hoạt động mua bán: tìm sách, lọc, xem giá và người bán, so sánh các tin cùng ISBN, thêm giỏ và theo dõi đơn hàng. Dùng font Be Vietnam Pro nhất quán, nền xám nhẹ và khu vực sản phẩm màu trắng. Không dùng đánh giá mẫu trên thẻ sản phẩm hoặc các con số bán hàng, đếm ngược, ưu đãi vận chuyển chưa có trong hệ thống.

Các nguồn tham khảo bố cục đã xem ngày 03/11/2026:

- [Tiki](https://tiki.vn/): tìm kiếm nổi bật, danh mục, tài khoản và giỏ hàng, phân nhóm nội dung mua sắm.
- [Lazada – sách](https://pages.lazada.vn/sach/): danh mục sản phẩm và thứ bậc thông tin giá.
- [AbeBooks](https://www.abebooks.com/): tìm theo tên sách, tác giả, ISBN và truy cập từng người bán.
- [FAHASA](https://www.fahasa.com/): cách phân loại sách theo thể loại. Đây là tham khảo ngành sách, không dùng làm ví dụ mô hình nhiều người bán.

Không sao chép thương hiệu, logo hoặc banner của các trang tham khảo.

## Những phần đã đổi

- Ngày 05/11/2026: thêm giỏ cập nhật tin ngay tại vị trí cũ trong cache, giữ offerCount từ kết quả gộp để sách không bị đẩy khỏi 12 thẻ trang chủ. Thông báo thêm giỏ được bật lại theo yêu cầu. Bỏ ô lối tắt Gian hàng và dòng “THÊM MỘT HÀNH TRÌNH MỚI” trong thông báo thành công. Thanh lối tắt desktop còn 5 mục.

- Tìm kiếm nâng cao dùng hai ô nhập số **Giá từ / Giá đến**, không dùng thanh kéo. Để trống Giá đến để không giới hạn; trình duyệt kiểm tra giá không âm và giá đến không nhỏ hơn giá từ. Giá được giữ trong URL khi quay lại chỉnh bộ lọc.
- Sidebar thể loại ở trang chủ chỉ giữ các thể loại; đã bỏ hai liên kết Tất cả sách đang bán / Tất cả nhà bán trong sidebar.

- Header: tìm kiếm, từ khóa nhanh, tài khoản, yêu thích, giỏ hàng và điều hướng trên điện thoại. Đã bỏ thanh tiện ích phía trên và mục Nhà bán sách khỏi menu chính; trang gian hàng vẫn truy cập qua link người bán trên thẻ sách.
- Trang chủ: danh mục thể loại, sách nổi bật lấy từ dữ liệu API, sáu lối vào chính, một khu sách đang bán gồm cả mới và cũ, cùng khu nhà bán. Mỗi phiên bản sách giấy hiển thị một thẻ đại diện với giá thấp nhất; mở chi tiết để chọn trong các tin bán cùng phiên bản. Không xóa hoặc gộp các tin trong database.
- Thẻ sách: ảnh bìa, tình trạng, tên, tác giả, giá, gian hàng và nút thêm giỏ. Giữ chức năng lưu sách và xem các bản bán cùng phiên bản.
- Danh mục **Mua sách** (`/mua-sach`): mặc định hiển thị cả sách mới và sách cũ; có bộ lọc tất cả/mới/cũ, giữ chuyển lưới/danh sách và bộ lọc trên điện thoại. Link cũ `/sach-moi` và `/sach-cu` chuyển sang trang chung và giữ từ khóa, sắp xếp cùng bộ lọc loại tương ứng. Backend dùng `type=physical&group=edition`, gộp trước khi đếm và phân trang để không lặp một phiên bản giữa các trang. Trang tìm kiếm và gian hàng công khai cũng gộp thẻ; kênh người bán vẫn quản lý riêng từng tin.
- Gian hàng công khai, danh sách nhà bán, trang quản lý: bố cục và tiêu đề đồng bộ với sàn.
- Footer: lối vào mua hàng, tài khoản, người bán, phương thức COD và thông tin phạm vi đồ án.

## Ảnh bìa

Ảnh bìa của các đầu sách mẫu được lưu tại `frontend/public/covers/`. Nguồn trang sản phẩm và URL ảnh của từng ảnh nằm trong `sources.json` cùng thư mục. Có thể tải lại bằng `node scripts/fetch-book-covers.mjs` từ thư mục frontend.

Ảnh chỉ minh họa đầu sách trong dữ liệu demo; metadata ISBN trong seed vẫn là dữ liệu minh họa. Không coi ảnh này là xác minh phiên bản hay tình trạng sách người bán. Những đầu sách chưa có ảnh dùng lại bìa chữ dự phòng, không ảnh hưởng chức năng đặt hàng. Không thêm chức năng upload hoặc sửa dữ liệu người bán.

## Chạy và kiểm tra

Frontend giữ nguyên địa chỉ phát triển `http://localhost:5173`; không cần cài thêm dependency. Chạy `npm run build` để kiểm tra bản production.

`node scripts/preview-marketplace.mjs` tạo ảnh desktop, tablet, mobile trong `frontend/test-results/marketplace/`, kiểm tra chiều rộng trang, ảnh lỗi và lỗi JavaScript. Script chỉ đọc API; thay đổi giỏ hàng trong trình duyệt kiểm tra không ảnh hưởng tài khoản đang dùng.

Bộ E2E sử dụng Chrome và API/MongoDB riêng theo hướng dẫn `ORDERS_SHIPPING.md`. Những bài kiểm tra tạo tài khoản/đơn hàng cần chạy với DB QA, không chạy trên dữ liệu làm việc chính.

Backend bổ sung bộ lọc đọc `type=physical`; cấu trúc dữ liệu và cách đặt hàng không đổi. Thanh toán vẫn là COD; vận chuyển dùng mô phỏng hiện có. Ebook và trao đổi vẫn giữ phạm vi mô phỏng đã mô tả trong README.

Kết quả xác minh ngày 03/11/2026:

- Sau khi gộp mục Mua sách: 36/36 API test và 18/18 E2E đạt; kiểm tra lọc chung trước phân trang, lọc mới/cũ, chuyển link cũ, giao diện điện thoại và các luồng đặt hàng. E2E dùng DB riêng `bookmarket_test_mergedui20261103`; API test dùng `bookmarket_test_mergecatalog` và tự dọn sau kiểm thử. Build production thành công.

- Build production thành công.
- 16/16 kịch bản E2E hiện có đạt trên DB riêng `bookmarket_test_commerceui`: tìm kiếm/ISBN, tài khoản, phân quyền, gian hàng, duyệt tin, đặt đơn, giao hàng, hủy/hoàn, cạnh tranh tồn kho, ebook và trao đổi mô phỏng.
- Kịch bản bổ sung dành cho điện thoại đạt: mở bộ lọc, lọc thể loại, sắp xếp, chuyển dạng xem, thêm giỏ và điều hướng menu. Chạy riêng sau bộ 16 kịch bản.
- Kiểm tra trực quan ở độ rộng 360, 390, 768, 1024 và 1440 px; không có tràn ngang trang, ảnh lỗi hoặc lỗi JavaScript trong các trang kiểm tra.
