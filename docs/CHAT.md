# Chat người mua và người bán

Tin nhắn văn bản lưu MongoDB, không lưu lịch sử trong localStorage. Dùng tài khoản user hiện có; admin không dùng hộp thư mua/bán.

## Cách sử dụng

- Mở chi tiết sách hoặc gian hàng, chọn **Chat với người bán**. Khách cần đăng nhập.
- Người mua mở `/tin-nhan`; người bán mở `/nguoi-ban/tin-nhan` trong menu quản lý. Link trên đầu trang chuyển giữa hai hộp thư.
- Một cặp người mua/người bán dùng một cuộc trò chuyện. Khi bắt đầu từ sách, lưu snapshot tên sách/tác giả để còn xem được khi tin bán bị ẩn hoặc xóa.
- Enter gửi; Shift + Enter xuống dòng. Tối đa 2.000 ký tự mỗi tin, hiển thị như văn bản, không thực thi HTML.
- Có Đã gửi/Đã xem, số chưa đọc, tải tin cũ và giữ nội dung để gửi lại khi lỗi mạng. Trên điện thoại, nút quay lại chuyển về danh sách cuộc trò chuyện.

## Đồng bộ và dữ liệu

Cuộc trò chuyện tự cập nhật mỗi 2 giây; hộp thư và badge mỗi 5 giây. Dừng polling khi tab ẩn, đồng bộ lại khi mở. Không hiển thị trạng thái online giả.

Hộp thư phân trang 20 cuộc trò chuyện. Mở đầu lấy 30 tin mới nhất; dùng `before` tải lịch sử, `after` nhận tin mới; mỗi request tối đa 50 tin. Backend hiện tại xếp hàng các lần ghi cùng cuộc trò chuyện trước khi cấp sequence tiếp theo.

Thêm collection `conversations` và `messages`, tự khởi tạo khi backend chạy, không cần xóa/chuyển dữ liệu cũ. Unique `(buyerId,sellerId)` tránh cuộc trò chuyện trùng. Tin nhắn có unique `(conversationId,sequence)` và `(conversationId,senderId,clientId)`. Frontend giữ clientId khi gửi lại để không nhân đôi; cùng mã khác nội dung trả 409. Đánh dấu đã đọc chỉ áp dụng đến mốc đã nhận.

## API

Tất cả endpoint yêu cầu Bearer JWT user. Mỗi thao tác đều kiểm tra thành viên cuộc trò chuyện; người ngoài nhận 404. API không nhận senderId/recipientId từ client, không gửi email/hash mật khẩu qua dữ liệu chat.

| Endpoint | Nội dung |
|---|---|
| `POST /conversations` | `{listingId}` hoặc `{sellerId}`. Chỉ bắt đầu từ người bán có tin đang hiển thị; không tự chat. |
| `GET /conversations?role=buyer&page=1&limit=20` | Hộp thư mua; đổi role thành seller để xem hộp thư bán. |
| `GET /conversations/unread` | `{buyer,seller,total}` số chưa đọc. |
| `GET /conversations/:id/messages` | Query before hoặc after, limit; trả items, conversation và hasMore. |
| `POST /conversations/:id/messages` | `{text,clientId?}`; tạo mới 201, gửi lại tin đã lưu 200. |
| `POST /conversations/:id/read` | `{through: sequence}`; đánh dấu tin gửi đến tài khoản đăng nhập. |

## Code và kiểm tra

Backend: `src/models/Conversation.js`, `src/models/Message.js`, `src/routes/conversations.js`. Frontend: `src/pages/ChatPage.jsx`, `src/hooks/useChatThread.js`, `src/hooks/useChatUnread.js`, `src/styles/chat.css`.

Test API trong `backend/tests/chat.test.js`; hai test trình duyệt trong `frontend/tests/api-foundation.spec.js` kiểm tra hai tài khoản, lưu lịch sử, đã đọc, tải tin cũ và mất phản hồi sau khi server đã lưu. Chạy trên database `bookmarket_test_*` riêng.
