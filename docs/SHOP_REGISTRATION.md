# Đăng ký rạp sách

Người mua dùng tài khoản BookMarket hiện có để mở shop. Phần đăng ký tài khoản và hồ sơ gian hàng là hai bước riêng; không tạo thêm user hoặc đổi role từ dữ liệu client.

## Lối vào và luồng

- Menu tài khoản của người chưa có shop → **Đăng ký rạp sách**. Người đã có shop thấy **Quản lý rạp sách** và vào thẳng kênh bán.
- URL riêng: `/dang-ky-rap-sach`. Link cũng có ở footer, sidebar người bán và thông báo cần shop khi đăng sách mới/ebook. URL cũ `/nguoi-ban/dang-ky` chuyển về trang này.
- Khách đăng nhập hoặc tạo tài khoản trước. Người đã đăng nhập vào thẳng hồ sơ đăng ký.
- Chưa có shop mà vào `/nguoi-ban/gian-hang` sẽ chuyển sang đăng ký. Shop hoàn tất vào `/nguoi-ban`; shop chưa hoàn tất vào form bổ sung `/nguoi-ban/gian-hang`, không tạo shop thứ hai.

Trang form dùng bố cục mua sắm và chưa hiển thị sidebar/header kênh người bán. Sau khi API tạo shop thành công, frontend tự chuyển sang `/nguoi-ban` với giao diện quản lý và thông báo rạp sách đã sẵn sàng. Nếu gửi lỗi, người dùng ở lại form để sửa hoặc thử lại.

Hồ sơ gồm ba bước:

1. **Thông tin gian hàng:** tên shop và giới thiệu.
2. **Liên hệ và địa chỉ:** tên người liên hệ, số điện thoại, email, tỉnh/thành phố, phường/xã, số nhà/đường.
3. **Kiểm tra và xác nhận:** xem lại dữ liệu, quay lại sửa nếu cần và xác nhận thông tin chính xác trước khi gửi.

Shop được tạo ngay sau khi đăng ký thành công. Hồ sơ hoàn tất được đăng sách mới/ebook, tin hiển thị ngay không cần duyệt. Từ trang quản lý, người dùng có thể tiếp tục đăng sách đầu tiên hoặc mở thông tin gian hàng để chỉnh sửa.

Thông tin ở các bước được giữ trong bộ nhớ khi quay lại, không lưu bản nháp liên hệ/địa chỉ vào localStorage. Khi tải lại trang trước khi xác nhận, người dùng cần nhập lại.

## Dữ liệu và quyền truy cập

`POST /shops` cần name, description, contactName, contactPhone, contactEmail, pickupAddress và `registrationConfirmed: true`. Backend lấy ownerId từ JWT và tự đặt isRegistrationComplete=true, registrationCompletedAt; từ chối client tự gán các trường này.

pickupAddress có province, ward, detail. Số điện thoại nhận dạng 10 số Việt Nam hoặc +84; API chuẩn hóa dấu cách/dấu phân cách. Email được trim và chuyển chữ thường. Một tài khoản có tối đa một shop theo unique ownerId.

Tên và mô tả shop là thông tin công khai. Liên hệ và địa chỉ chỉ được trả qua `/auth/me`, `/shops` và `/shops/:id` cho chính chủ; danh sách sách, người bán và chat không trả các trường này. Tài khoản nhận VietQR thuộc cấu hình chung của sàn ở backend, không phải dữ liệu shop.

Shop cũ thiếu hồ sơ có isRegistrationComplete=false, cần bổ sung đủ thông tin tại trang chỉnh sửa rồi lưu để đăng sách mới/ebook. POST/PATCH listing đều kiểm tra tại backend; React ẩn nút gửi và hiện nhắc hoàn tất. Sách cũ/trao đổi vẫn không bắt buộc shop. Migration chỉ gán cờ theo hồ sơ thật, không tạo liên hệ giả; xem [HARDENING.md](HARDENING.md).

Gửi lại sau khi server đã tạo shop nhưng phản hồi bị mất: POST trả 409, frontend đọc lại shop của chính tài khoản và chuyển vào giao diện người bán, không tạo bản trùng.

## Code và kiểm tra

- Frontend: `pages/ShopRegistrationPage.jsx`, `components/ShopFields.jsx`, `components/ShopSettingsForm.jsx`, `styles/shop-registration.css`.
- Backend: `models/Shop.js`, `utils/shop.js`, `routes/shops.js`, `utils/user.js`.
- Test API kiểm tra hồ sơ bắt buộc, chuẩn hóa, riêng tư, đăng ký đồng thời và shop cũ.
- Test trình duyệt kiểm tra đăng ký từ tài khoản mới/có sẵn, validation từng bước, quay lại sửa, xác nhận, tải lại, mất phản hồi, chỉnh sửa hồ sơ và giao diện điện thoại. Tất cả dùng database `bookmarket_test_*` riêng.
