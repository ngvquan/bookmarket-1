# Database BookMarket — catalog và đơn hàng

BookMarket hiện có 18 collection. Tài khoản admin nằm riêng, không lưu role trong users/admins. Mọi collection có `_id`; các model nghiệp vụ mới dùng `versionKey=false`.

| Collection | Trường nghiệp vụ | Quan hệ / ràng buộc |
|---|---|---|
| users | name, email, passwordHash, addresses[], favorites[] | email unique; tối đa 3 địa chỉ nhận hàng, 500 ID tin yêu thích. |
| admins | name, email, passwordHash | email unique trong admins; chỉ seed/migration tạo admin. |
| shops | ownerId, name, description, contactName, contactPhone, contactEmail, pickupAddress, isRegistrationComplete, registrationCompletedAt | ownerId → users, unique; mỗi user tối đa một shop. Liên hệ/địa chỉ riêng tư; new/digital cần hồ sơ hoàn tất. Không lưu tài khoản ngân hàng shop. |
| authors | name, biography | nameSearch phục vụ tìm không dấu và tái sử dụng tên. |
| publishers | name | nameSearch phục vụ tìm không dấu và tái sử dụng tên. |
| categories | name | nameSearch phục vụ tìm không dấu và tái sử dụng tên. |
| books | title, authorIds, categoryId, description | authorIds → authors; categoryId → categories. titleSearch hỗ trợ tìm; catalogKey chống tạo trùng tác phẩm. |
| editions | bookId, isbn, publisherId, year, binding | bookId → books; publisherId → publishers hoặc null. ISBN unique/sparse để đọc dữ liệu cũ; API tạo tin mới bắt buộc ISBN. |
| listings | editionId, sellerId, shopId, type, price, stock, condition, description, status, hiddenBy, location | editionId → editions; sellerId → users; shopId → shops hoặc null. hiddenBy=seller/admin khi tin bị ẩn. |
| orders | buyerId, idempotencyKey, requestHash, receiverName, receiverPhone, receiverAddress, paymentMethod, itemsTotal, shippingTotal, total | buyerId → users; unique buyerId/idempotencyKey; paymentMethod chỉ cod; tổng và người nhận tại lúc mua. |
| suborders | orderId, buyerId, sellerId, shopName, items[], itemsTotal, shippingFee, status, cancelReason, shipment | orderId → orders; buyerId/sellerId → users; unique (orderId,sellerId). |
| reviews | buyerId, sellerId, listingId, orderId, subOrderId, rating, comment, reply | refs users/listings/orders/suborders; unique buyerId/listingId; reply chứa text/repliedAt/editedAt và chỉ seller của đánh giá được sửa. |
| notifications | userId, orderId, subOrderId, status, title, message, readAt | Các ID liên kết user/đơn; unique userId/subOrderId/status chống trùng; index hộp thư chưa đọc. |

Hai collection thanh toán mới:

| Collection | Trường và ràng buộc |
|---|---|
| digitalorders | buyerId → users; items[]{listingId → listings, sellerId → users, editionId → editions, title, author, price}; total bằng tổng item.price; status pending_payment/paid/cancelled/expired; transferCode unique; qrImageUrl; bank snapshot; expiresAt; bankTransactionId unique+sparse; paidAmount; paidAt; cartKey. Unique partial buyerId/cartKey chỉ khi pending_payment. |
| ebookaccesses | buyerId → users; listingId → listings (string); editionId → editions; digitalOrderId → digitalorders; grantedAt. Unique buyerId/listingId, chỉ cấp cùng transaction chuyển đơn sang paid. |
| banktransactions | transactionId unique; amount nguyên không âm; description; reason; orderId → digitalorders hoặc null; resolved mặc định false; createdAt | Lưu webhook chưa khớp để admin đối soát. reason: outgoing/no_code/no_order/not_enough/wrong_account/order_cancelled. Index resolved+createdAt+_id và orderId. |

Giá, tên, phiên bản, người bán và tài khoản ngân hàng chung của sàn được chụp tại lúc đặt. Một đơn có thể chứa ebook nhiều seller. Đơn ebook trùng giao dịch không được ghi lại; webhook chưa khớp được giữ trong BankTransaction. Quyền không mất sau reload hoặc khi tin bị ẩn/gỡ. Chi tiết: [PAYMENT_VIETQR.md](PAYMENT_VIETQR.md).

Thêm hai collection chat `conversations` và `messages`: cuộc trò chuyện có buyerId/sellerId unique theo cặp và snapshot sách; tin nhắn liên kết conversationId/senderId/recipientId, sequence, clientId, text, readAt. Chi tiết ràng buộc và cách đồng bộ: [CHAT.md](CHAT.md).

```mermaid
erDiagram
  ADMINS {
    ObjectId _id
    string name
    string email
    string passwordHash
  }
  USERS ||--o| SHOPS : owns
  USERS ||--o{ LISTINGS : posts
  SHOPS o|--o{ LISTINGS : contains
  AUTHORS }o--o{ BOOKS : writes
  CATEGORIES ||--o{ BOOKS : classifies
  BOOKS ||--o{ EDITIONS : has
  PUBLISHERS o|--o{ EDITIONS : publishes
  EDITIONS ||--o{ LISTINGS : offered_as
  USERS ||--o{ ORDERS : buys
  ORDERS ||--|{ SUBORDERS : contains
  USERS ||--o{ SUBORDERS : sells
  USERS ||--o{ CONVERSATIONS : chats
  CONVERSATIONS ||--o{ MESSAGES : contains
  USERS ||--o{ MESSAGES : sends
  USERS ||--o{ DIGITALORDERS : pays
  DIGITALORDERS ||--o{ EBOOKACCESSES : grants
  USERS ||--o{ EBOOKACCESSES : owns
  USERS ||--o{ REVIEWS : writes
  LISTINGS ||--o{ REVIEWS : receives
  SUBORDERS ||--o{ REVIEWS : verifies
```

authorIds là array ID, không có collection nối thứ mười. Tác giả nhập qua form được phân cách bằng dấu chấm phẩy; các chuỗi tác giả cũ được giữ nguyên nếu không có dấu phân cách đó.

Một tác phẩm có nhiều phiên bản. Một phiên bản có nhiều offer khác seller/giá/tình trạng. Ba offer Nhà giả kim trong seed cùng một editionId/ISBN. Khi đăng mới, form gợi ý theo ISBN hoặc tên + tác giả; lựa chọn chỉ tự điền metadata, backend vẫn xác nhận ISBN trước khi dùng chung editionId. Edition cũ thiếu ISBN được giữ để tương thích nhưng không tạo mới qua API.

Tin mới và tin đang bán sau sửa được approved, hiển thị ngay, không cần duyệt. Tin hidden/rejected vẫn giữ trạng thái admin đã đặt. pending trong enum chỉ để đọc dữ liệu cũ; `npm run publish:books -- --apply` sao lưu rồi chuyển các listing pending cũ sang approved, không đổi trạng thái đơn hàng. Metadata ISBN dùng chung vẫn được bảo vệ; giá, mô tả và kho thuộc từng listing. Catalog có thể còn book/edition sau khi offer cuối bị xóa.

Listing.type: new/used/digital. Listing.status: pending/approved/rejected/hidden/sold. New/digital cần shop có isRegistrationComplete=true và đủ liên hệ/địa chỉ. Used không bắt buộc shop. User không có role seller.

Listing.images chứa tối đa 5 object `{id, contentType}`. `ebookFileId` và `ebookPageCount` chỉ là metadata; byte ảnh/PDF lưu trong `backend/storage` hoặc thư mục `BOOKMARKET_STORAGE_DIR`. API JSON không trả `ebookFileId`, chỉ trả `hasEbook`; file đầy đủ được bảo vệ bằng JWT và EbookAccess.

role/accountType trong JSON profile là giá trị server suy ra từ collection đã xác thực, dùng tương thích UI; không phải quyền đọc từ localStorage hoặc field role trong DB. JWT 7 ngày có accountType user/admin; backend đọc lại đúng collection. Token cũ không có accountType phải đăng nhập lại.

refreshsessions, users.role/isActive, shops.paymentBank và metadata cũ trong listings đã bỏ. Shipment là object nhúng trong SubOrder. Có 19 collection; quyền ebook lưu trong EbookAccess, không dùng storage của trình duyệt.

Review có index listingId/createdAt/_id để đọc theo tin và unique buyerId/listingId chống trùng; không lưu trung bình vào Listing để tránh lệch dữ liệu. Điểm trung bình tính từ reviews trước phân trang. Không cần migration cho đơn cũ: đơn đã completed có thể cấp quyền ngay. Xem [REVIEWS.md](REVIEWS.md).

## Snapshot đơn hàng

SubOrder.items lưu {listingId, type, title, author, isbn, price, quantity}. type=new/used giúp restoreItems biết cách hoàn kho khi đặt lỗi, hủy hoặc hoàn hàng. listingId chỉ để định danh; lịch sử dùng snapshot, không populate giá/tên mới. shopName cũng là snapshot; seller không có shop dùng tên User. Tin đang có đơn pending/confirmed/shipping/delivered không được sửa/xóa. Sau khi kết thúc, sửa/xóa tin/shop không làm đổi snapshot đã lưu.

shipment lưu {service, fee, trackingCode, events:[{at,status,note}]}; service=standard/fast. Khi đặt có pending, trackingCode rỗng. Xác nhận sinh BM + 8 ký tự hex in hoa; mỗi chuyển thêm sự kiện. status gồm pending/confirmed/shipping/delivered/completed/cancelled/returned. cancelReason lưu lý do hủy, seller bắt buộc nhập.

Order.itemsTotal bằng tổng SubOrder.itemsTotal; Order.shippingTotal bằng tổng shippingFee; total bằng hai tổng cộng lại. Các tổng giữ snapshot lúc đặt. SubOrder.itemsTotal bằng tổng price × quantity. Schema kiểm tra tổng mẹ, tổng dòng và phí shipment. New/used cùng trừ stock nguyên tử khi đủ kho; used đồng thời đổi sold. Tạo mẹ/con và trừ kho nằm trong transaction; đổi trạng thái/hoàn kho cũng dùng transaction. Order thêm idempotencyKey và requestHash; unique buyerId/key chống tạo trùng. [Migration và ràng buộc](HARDENING.md).

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> confirmed
  pending --> cancelled
  confirmed --> cancelled
  confirmed --> shipping
  shipping --> delivered
  shipping --> returned
  delivered --> completed
  delivered --> returned
  completed --> returned
```

Index: Listing ghép status/type/ngày/giá, seller/ngày, edition/status/type/giá, shop/status. Book có authorIds/categoryId; Edition có publisherId và ISBN unique/sparse. Order có buyer/ngày, ngày và unique buyer/key. SubOrder có seller/status/ngày, seller/ngày, buyer/ngày, status/ngày, unique order/seller và items.listingId/status. Migration bỏ index thừa theo schema sau backup; xem danh sách trong HARDENING.md.
