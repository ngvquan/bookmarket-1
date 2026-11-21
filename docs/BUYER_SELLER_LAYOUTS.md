# Giao diện người mua và người bán

BookMarket có hai khu giao diện riêng, dùng chung tài khoản đã xác thực. Không tạo thêm collection seller, không nhân đôi người dùng và không chuyển đổi dữ liệu tài khoản.

| Khu vực | Đường dẫn | Nội dung |
|---|---|---|
| Người mua | `/`, `/mua-sach` | Tìm sách, xem gian hàng công khai, giỏ hàng và mua sách |
| Tài khoản người mua | `/don-hang`, `/thu-vien`, `/yeu-thich`, `/yeu-cau` | Đơn mua, thư viện, sách đã lưu và trao đổi |
| Kênh người bán | `/nguoi-ban` | Chuyển đến trang quản lý sản phẩm |
| Sản phẩm người bán | `/nguoi-ban/san-pham` | Đăng sách và quản lý tin của tài khoản |
| Đơn bán | `/nguoi-ban/don-hang` | Xác nhận, giao và hủy đơn bán theo quyền |
| Chat người mua | `/tin-nhan`, `/tin-nhan/:id` | Trao đổi với người bán, lịch sử và số chưa đọc |
| Chat người bán | `/nguoi-ban/tin-nhan`, `/nguoi-ban/tin-nhan/:id` | Trả lời người mua trong workspace người bán |
| Chi tiết đơn bán | `/nguoi-ban/don-hang/:id` | Chi tiết và timeline các đơn con do chính tài khoản bán |
| Đăng ký rạp sách | `/dang-ky-rap-sach` | Form trong bố cục mua sắm; hoàn tất mới chuyển sang giao diện người bán |
| Gian hàng người bán | `/nguoi-ban/gian-hang` | Chỉnh sửa hồ sơ shop đã có; chưa có shop thì chuyển sang đăng ký |
| Gian hàng công khai | `/nha-ban/:id` | Trang dành cho người mua xem sách của một nhà bán |

Link cũ `/gian-hang` chuyển sang `/nguoi-ban`. Các mục quản lý có URL riêng, giữ đúng mục khi tải lại hoặc dùng nút quay lại của trình duyệt.

## Bố cục và chuyển khu vực

Giao diện mua sắm giữ header tìm kiếm, danh mục, giỏ hàng và footer của sàn. Thanh thông tin mỏng phía trên header đã được bỏ. Menu tài khoản hiển thị Đăng ký rạp sách với người chưa có shop, dẫn tới form riêng. Người đã có shop thấy Quản lý rạp sách để vào workspace.

Workspace người bán có header, menu quản lý bên trái và phần nội dung riêng. Trên điện thoại, menu chuyển thành hàng năm mục, gồm Tin nhắn. Không hiển thị header giỏ hàng/tìm kiếm hoặc footer mua sắm trong workspace. Có nút Về trang mua sách và Xem trang người bán công khai.

Giỏ hàng, yêu thích và token đăng nhập được giữ khi chuyển giữa hai khu. Các nút đăng bán sách giấy ở trang mua sắm dẫn tới khu Sản phẩm của người bán. Trao đổi sách tiếp tục là chức năng cộng đồng hiện có.

Các ô thống kê chỉ hiển thị nhãn và số liệu, bỏ icon trang trí. Sách giấy được phân biệt bằng hai nhóm Sách mới / Sách cũ; bỏ các mức Như mới, Còn tốt, Đã cũ khỏi giao diện. Form đăng/sửa, bộ lọc, giỏ hàng và chi tiết không còn trường loại bìa. Metadata loại bìa và tình trạng cũ trong database được giữ để tương thích dữ liệu; tin mới không cần gửi hai trường này. Khi dùng ISBN có sẵn, backend giữ metadata loại bìa của phiên bản đó.

## Đăng nhập và quyền

Người chưa đăng nhập thấy trang giới thiệu kênh người bán, có lối đăng nhập và đăng ký riêng về giao diện. Xác thực vẫn qua API user hiện có. Sau phần tài khoản, đăng ký shop diễn ra tại `/dang-ky-rap-sach` với ba bước thông tin shop, liên hệ/địa chỉ và xác nhận. Form chưa hiển thị layout quản lý người bán; tạo shop thành công mới tự chuyển vào `/nguoi-ban`. Người mua đã có tài khoản vào thẳng hồ sơ shop, không tạo tài khoản thứ hai. Xem [SHOP_REGISTRATION.md](SHOP_REGISTRATION.md).

Chưa có shop vẫn có thể quản lý tin sách cũ và trao đổi của mình. Bán sách mới/ebook vẫn cần tạo shop theo quy tắc backend hiện có. Tài khoản admin không được vào các chức năng bán hàng; giao diện hướng về trang quản trị và không gọi API thống kê của người bán.

Backend tiếp tục xác nhận chủ sở hữu tin/đơn/shop bằng tài khoản đăng nhập. Menu riêng không thay thế kiểm tra quyền. Chi tiết đơn bán chỉ hiển thị phần do chính tài khoản bán, kể cả khi tài khoản đồng thời là người mua của một đơn khác.

## Các tệp chính

- `frontend/src/components/SellerLayout.jsx`: header, sidebar, trang vào kênh người bán và kiểm tra loại tài khoản.
- `frontend/src/data/sellerNavigation.js`: nhóm đường dẫn và điều hướng người bán.
- `frontend/src/pages/SellerPage.jsx`: các phần thống kê, sản phẩm, đơn bán, hồ sơ shop theo URL.
- `frontend/src/styles/seller-layout.css`: bố cục riêng và các kích thước màn hình.
- `frontend/src/components/Auth.jsx`: nội dung đăng nhập/đăng ký theo khu vực truy cập.

Kiểm tra giao diện gồm chuyển khu vực giữ phiên/giỏ, đăng ký shop, đăng xuất, tải lại các URL riêng, chặn admin, chi tiết đơn bán và thao tác trên điện thoại. Không cần migration database.

Kết quả ngày 03/11/2026: build production thành công; 22/22 E2E đạt trên database riêng `bookmarket_test_splitui20261103`. Ảnh thống kê có dữ liệu trong `frontend/test-results/seller-stats-desktop.png` và `seller-stats-mobile.png` là từ giao dịch kiểm thử, không phải đơn tạo trong database dự án.

Chạy `node scripts/preview-seller-workspace.mjs` tại frontend để kiểm tra trang vào kênh người bán và năm mục quản lý, gồm hộp thư, với tài khoản demo có sẵn, ở 360/390/768/1024/1440 px. Ảnh nằm trong `frontend/test-results/seller-workspace/`; script không ghi tin nhắn, tin sách, shop hoặc đơn hàng.
