# Đánh giá sau khi mua sách

Chỉ tài khoản khách hàng có đơn con `completed` chứa đúng `listingId` mới được gửi đánh giá. Đặt đơn, người bán xác nhận hoặc giao thành công chưa đủ; người mua cần bấm **Đã nhận hàng** để hoàn tất. Đơn hủy/hoàn không cấp quyền đánh giá. Hiện đánh giá áp dụng cho đơn sách giấy; quyền ebook được quản lý riêng.

Mỗi khách đánh giá một lần cho mỗi tin bán, kể cả mua nhiều lần hoặc nhiều cuốn. Các tin của người bán khác nhau có đánh giá riêng, dù cùng phiên bản sách. Sau khi gửi, đánh giá được giữ làm lịch sử nếu đơn được hoàn hàng về sau; không tự tạo đánh giá từ đơn cũ.

Người bán mở **Kênh người bán → Đánh giá** để lọc đánh giá chưa trả lời/đã trả lời và thêm, sửa hoặc xóa một phản hồi tối đa 1000 ký tự. Phản hồi hiện công khai dưới nhận xét; backend luôn kiểm tra `sellerId`, không nhận quyền từ frontend.

## Cách dùng và tự kiểm tra

1. Khách chưa đăng nhập mở chi tiết sách: được đọc đánh giá, không có form gửi.
2. Khách đăng nhập nhưng chưa mua, hoặc đơn còn pending/confirmed/shipping/delivered: không có form đánh giá. Gửi trực tiếp POST /reviews vẫn bị chặn 403.
3. Hoàn tất đơn qua seller xác nhận/giao → admin giao thành công → buyer bấm Đã nhận hàng. Mở **Nhận hàng** ở `/don-hang`, bấm **Đánh giá sách** tại từng sách. Sách cũ đã sold/hết kho vẫn dùng được đường này.
4. Chọn 1–5 sao, nhập nhận xét tối đa 2000 ký tự rồi gửi. Nút bị khóa khi gửi; sau thành công hiện đánh giá, điểm trung bình và nhãn Đã mua hàng. Tải lại vẫn còn, không có form gửi lần hai.
5. Chi tiết sách đang bán cũng hiển thị danh sách và form nếu đủ điều kiện. Nếu đơn đã hoàn hàng sau khi mở form, backend kiểm tra lại và từ chối gửi. Nút Thử lại tải lại điều kiện thực tế.

## API và dữ liệu

| API | Quyền và dữ liệu |
|---|---|
| GET /reviews?listingId=...&page=1 | Công khai, 10 đánh giá/trang. Trả items, total, average, page, limit, pages. average tính toàn bộ đánh giá của tin, làm tròn một chữ số thập phân. |
| GET /reviews/eligibility?listingId=... | JWT user. Trả canReview, alreadyReviewed, message; không lấy quyền từ localStorage. |
| POST /reviews | JWT user. Body chỉ gồm listingId, rating (số nguyên 1–5), comment (chuỗi không rỗng, trim, tối đa 2000 ký tự). 201 khi lưu; 400 khi dữ liệu sai; 401 chưa đăng nhập; 403 sai vai/chưa đủ điều kiện; 409 đã đánh giá. |

Collection `reviews` lưu `buyerId`, `sellerId`, `listingId`, `orderId`, `subOrderId`, `rating`, `comment`, `createdAt`, `updatedAt`. Buyer lấy từ JWT; seller và liên kết đơn lấy từ đơn completed trong DB, không nhận từ form. Index unique `{buyerId:1,listingId:1}` chặn trùng kể cả request đồng thời; `{listingId:1,createdAt:-1,_id:-1}` phục vụ đọc/phân trang. API công khai chỉ trả id đánh giá, tên khách, sao, nhận xét, ngày và nhãn đã mua; không trả ID đơn, thông tin người nhận, email hay mật khẩu.

Không cần tạo database mới hoặc cập nhật bản ghi cũ. Backend tự khởi tạo collection/index khi chạy. Script export database tự nhận model Review và xuất cả reviews. Nên sao lưu trước khi cập nhật phiên bản; phần này không yêu cầu chạy migration hoặc seed trên database đang dùng.

## File chính và kiểm thử

- Backend: `src/models/Review.js`, `src/routes/reviews.js`, đăng ký trong `models/index.js` và `app.js`.
- React: `components/BookReviews.jsx`; gắn vào `App.jsx` và `SubOrderCard.jsx`; `OrdersPage`/`OrderDetailPage` truyền profile, API client tại `services/api.js`, CSS tại `styles/marketplace.css`.
- Test API: `backend/tests/reviews.test.js`, chạy `npm test -- tests/reviews.test.js` trong backend với TEST_MONGO_URI trỏ database test replica set.
- Test UI: nhóm `verified reviews:` trong `frontend/tests/api-foundation.spec.js`. Chạy trên frontend/backend kiểm thử dùng database riêng, không dùng database chính vì test tạo tài khoản và đơn.
