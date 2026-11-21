# API BookMarket

Base local: http://localhost:4000. Frontend gọi /api qua Vite proxy. JSON lỗi `{ "message": "..." }`; 400 dữ liệu sai, 401 thiếu/sai/hết hạn token, 403 sai quyền, 404 không thấy/không public, 409 xung đột, 500 lỗi nội bộ.

## Đăng nhập riêng

| Method / path | Body | Quyền / kết quả |
|---|---|---|
| POST /auth/register | name, email, password | Công khai, chỉ tạo User; 201 {token,user}; gửi role bị 400. |
| POST /auth/login | email, password | Đọc users; 200 {token,user}. Không đăng nhập Admin bằng route này. |
| POST /admin/auth/login | email, password | Đọc admins; 200 {token,user}. Không có đăng ký admin công khai. |
| GET /auth/me | Không | Bearer token; trả profile đã đọc lại từ users hoặc admins theo accountType đã ký. |
| GET /admin/auth/me | Không | Chỉ Admin đã xác thực. |
| PATCH /auth/profile | `{name}` | User đổi tên hiển thị; trả profile mới. |
| POST /auth/addresses | label, receiverName, phone, address, isDefault? | User thêm địa chỉ; tối đa 3, địa chỉ đầu tiên tự là mặc định. |
| PATCH /auth/addresses/:id | Đầy đủ label, receiverName, phone, address, isDefault? | User sửa địa chỉ của mình. |
| DELETE /auth/addresses/:id | Không | User xóa địa chỉ; nếu xóa mặc định thì địa chỉ đầu tiên còn lại thành mặc định. |
| PUT /auth/favorites/:listingId | Không | User lưu tin sách vào yêu thích; gọi lại không tạo trùng. |
| DELETE /auth/favorites/:listingId | Không | User bỏ tin sách khỏi yêu thích. |

JWT hạn 7 ngày, header Authorization: Bearer token; không refresh/cookie. Mật khẩu từ 6 ký tự, tối đa 72 byte UTF-8, không toàn khoảng trắng và không tự trim; bcrypt hash. Email trim/lowercase, unique trong từng collection. Hai loại tài khoản có thể cùng email nhưng đăng nhập qua route riêng, không chia sẻ quyền. User/Admin JSON không trả passwordHash; role là giá trị suy ra ở server để giữ UI, không lưu DB.

requireLogin xác minh chữ ký/expiry/accountType và đọc đúng model. requireAdmin chỉ nhận admin; requireUser chỉ nhận user. Token cũ thiếu accountType trả 401 để đăng nhập lại. Admin không tạo shop/tin hoặc dùng /mine bằng token quản trị. Đăng xuất frontend xóa token; chưa thu hồi token đã sao chép.

Tên dài tối đa 100 ký tự. Mỗi user có tối đa 3 địa chỉ và 500 tin yêu thích; cả hai được lưu trong MongoDB nên giữ nguyên khi đăng nhập trên trình duyệt khác. Thêm đúng địa chỉ đã có sẽ trả lại địa chỉ cũ thay vì tạo trùng.

## Thông báo đơn hàng

| Method / path | Body / query | Quyền / kết quả |
|---|---|---|
| GET /notifications | page, limit | User; trả danh sách mới nhất cùng `total`, `unread`, phân trang. |
| PATCH /notifications/read-all | Không | User; đánh dấu toàn bộ thông báo của mình đã đọc. |
| PATCH /notifications/:id/read | Không | User; đánh dấu một thông báo của mình đã đọc. |

Ngay khi người mua đặt hàng thành công, backend tạo thông báo `pending` cho người bán. Các thay đổi tiếp theo confirmed, shipping, delivered, completed, cancelled hoặc returned tiếp tục tạo thông báo cho bên liên quan nhưng không gửi lại cho chính người vừa thao tác. Unique user/subOrder/status chống tạo thông báo trùng.

## Shops

| Method / path | Body | Quyền |
|---|---|---|
| GET /shops | Không | User, shop của mình. |
| GET /shops/:id | Không | User chủ shop. |
| POST /shops | name, description, contactName, contactPhone, contactEmail, pickupAddress, registrationConfirmed=true | User chưa có shop; trùng owner 409. |
| PATCH /shops/:id | Các trường thông tin shop/liên hệ/địa chỉ cần sửa | User chủ shop. |

name/description trim, không rỗng, tối đa 120/1500 ký tự. pickupAddress gồm province, ward, detail. ownerId, isRegistrationComplete và registrationCompletedAt do server đặt. PATCH hồ sơ đủ tự hoàn tất shop; shop thiếu liên hệ hoặc địa chỉ không được đăng new/digital. Liên hệ/địa chỉ chỉ trả cho chủ shop. Không có DELETE shop.

## Listings

| Method / path | Body / query | Quyền |
|---|---|---|
| GET /listings | Query bên dưới | Công khai, chỉ approved và new/used còn kho; {items,total,page,limit,pages}. |
| GET /listings/sellers | q,page,limit | Công khai; người có offer còn bán, phân trang. |
| GET /listings/mine | Query tương tự | User; chỉ offer của mình, gồm trạng thái riêng tư. |
| GET /listings/admin | Query tương tự, thêm status | Admin; mọi offer hoặc lọc trạng thái. |
| GET /listings/suggestions | isbn,title,author,type | User; tối đa 5 phiên bản có ISBN để chọn khi đăng sách. |
| GET /listings/:id/recommendations | limit 1–12 | Công khai; nhóm `sameAuthor` và `sameCategory`, sách giấy gộp theo phiên bản. |
| GET /listings/:id | Không | Công khai, tin approved còn bán; còn lại 404. |
| POST /listings | Form phẳng bên dưới | User; sellerId từ JWT, status=approved và hiển thị ngay; new/digital cần shop hoàn tất và đủ hồ sơ. |
| PATCH /listings/:id | Một phần form | Chỉ User chủ tin; sold 409; tin đang bán sửa xong vẫn approved. Tin hidden/rejected giữ trạng thái admin đã đặt. |
| DELETE /listings/:id | Không | Chỉ User chủ tin; 204. Không tự xóa book/edition dùng chung. |
| PATCH /listings/:id/sold | Không | User chủ tin used đã approved; chuyển sold, gọi lại sold được. |
| PATCH /listings/:id/moderation | status approved/rejected/hidden | Admin; không duyệt lại sold (409). |
| PATCH /listings/:id/visibility | {hidden:boolean} | Chủ tin tự ẩn/hiện. Không được mở tin do admin ẩn. |
| POST /listings/:id/images | Raw JPEG/PNG/WebP, tối đa 8 MB | Chủ tin; tối đa 5 ảnh. |
| DELETE /listings/:id/images/:imageId | Không | Chủ tin xóa ảnh và file tương ứng. |
| GET /listings/:id/images/:imageId | Không | Trả ảnh bìa với đúng content-type. |
| PUT /listings/:id/ebook | Raw PDF, tối đa 100 MB | Chủ tin digital; PDF hợp lệ và có ít nhất một trang. Không thay sau khi đã có người mua. |
| GET /listings/:id/preview | Không | Công khai với ebook approved; trả PDF mới chỉ gồm tối đa 2 trang đầu. |
| GET /listings/:id/ebook | Không | JWT; chỉ chủ ebook hoặc buyer có EbookAccess được nhận file đầy đủ. |

Form vẫn nhận type,title,author,isbn,publisher,year,binding,category,price,stock,condition,description,location để giữ UI đơn giản. Chỉ lưu field whitelist. sellerId/owner/shopId/status/id/_id do client gửi bị từ chối. Title/author/category/description bắt buộc trim; ISBN bắt buộc khi POST tạo tin mới.

Server tự tìm/tạo Author/Category/Publisher/Book/Edition tương ứng; Listing chỉ lưu editionId và dữ liệu offer. Nếu ISBN đã có thì metadata phải khớp; tin mới tự dùng chung editionId để vào phần so sánh giá. API suggestions chỉ gợi ý, không cho client tự chỉ định editionId. Schema vẫn đọc edition cũ thiếu ISBN, nhưng API không tạo thêm loại dữ liệu này. Nhiều tác giả nhập cách nhau bởi dấu chấm phẩy.

- new cần price nguyên 0–100000000 và stock nguyên 0–100000; cần shop hoàn tất.
- used cần price, stock=1 khi đăng; sau mua hoặc đánh dấu bán stock=0. condition không bắt buộc.
- digital cần price, shop hoàn tất và file PDF để chuyển từ pending sang approved. Quyền sở hữu lưu ở EbookAccess sau thanh toán. Dữ liệu ebook mẫu cũ chưa có file vẫn dùng PDF minh họa để tương thích.
- condition: Như mới/Còn tốt/Đã cũ. binding: Bìa mềm/Bìa cứng/PDF. ISBN định dạng 10/13, chuẩn hóa bỏ khoảng trắng/gạch, chưa đối chiếu xuất bản thực.

Query: q,title,author,isbn,publisher,type,category,condition,binding,seller,min,max,sort,page,limit. sort featured/title/price-up/price-down; page 1–100000, limit 1–50, mặc định 10. Tìm không dấu theo tác phẩm/tác giả/NXB, ISBN prefix từ 3 ký tự. Regex được escape. Lọc metadata truy vấn các collection liên kết; sắp xếp title join book/edition trên server trước skip/limit. Không tải toàn catalog về frontend.

`type=physical` lấy chung tin `new` và `used`, lọc và tính tổng trước phân trang. Chỉ là bộ lọc cho mục **Mua sách**, không phải loại tin mới trong database. Các giá trị `all/new/used/digital` vẫn được hỗ trợ.

`group=edition` trên `GET /listings` gộp các tin sách giấy cùng `editionId` thành một thẻ, chọn tin còn bán có giá thấp nhất sau khi lọc. Mỗi item thêm `offerCount`; `total` và `pages` tính trên các nhóm trước phân trang. Ebook giữ từng tin. `/listings/mine` và `/listings/admin` luôn giữ đầy đủ tin đăng. Chi tiết gọi `GET /listings?edition=<editionId>&type=physical` không truyền `group` để xem các tin bán cùng phiên bản; vẫn chỉ trả tin công khai còn bán.

Response giữ title/author/isbn/publisher/year/binding/category dạng phẳng để frontend cũ chạy; thêm bookId,editionId,authorIds,categoryId,publisherId. shop/sellerId/owner alias và các cờ khả dụng vẫn có. Không lộ email/hash người bán. Bìa mẫu được ghép ở frontend theo ID; đánh giá thật lấy riêng qua /reviews.

## Chat người mua và người bán

`/conversations` yêu cầu JWT user; chỉ thành viên cuộc trò chuyện đọc/gửi/đánh dấu đã đọc. Có bắt đầu từ listingId/sellerId, hộp thư theo vai trò, số chưa đọc, phân trang lịch sử và gửi lại an toàn bằng clientId. Endpoint, body và cách thử: [CHAT.md](CHAT.md).

## Đánh giá từ khách đã mua

`GET /reviews?listingId=...&page=1` công khai trả danh sách phân trang và điểm trung bình thật. `GET /reviews/eligibility?listingId=...` yêu cầu JWT user để kiểm tra quyền. `POST /reviews` nhận `{listingId,rating,comment}`, chỉ cho buyer có đơn completed chứa đúng tin sách; không nhận ID người mua/đơn hoặc trạng thái từ client. Unique buyerId/listingId chặn đánh giá lại. Chi tiết field, mã lỗi và cách thử: [REVIEWS.md](REVIEWS.md).

Người bán dùng `GET /reviews/shop?replied=all|yes|no&page=1`, `PUT /reviews/:id/reply` với `{text}` và `DELETE /reviews/:id/reply`. Chỉ sellerId của đánh giá được phản hồi; phản hồi công khai kèm tên shop.

## Đặt đơn sách giấy — Giai đoạn 2–3

| Method / path | Body | Quyền / kết quả |
|---|---|---|
| POST /orders | idempotencyKey, receiverName, receiverPhone, receiverAddress, items: [{listingId, quantity}], services?: {[sellerId]: "standard" hoặc "fast"} | User; 201 {order,replayed:false} khi mới, 200 {order,replayed:true} khi gửi lại cùng mã/nội dung. |

Ví dụ body (thay listingId/sellerId bằng dữ liệu thật):

```json
{
  "idempotencyKey": "f39b38fb-42ac-4635-af22-4a9b3bbd2407",
  "receiverName": "Nguyễn An",
  "receiverPhone": "0912345678",
  "receiverAddress": "12 Đường Sách, TP.HCM",
  "items": [{ "listingId": "b1", "quantity": 2 }],
  "services": { "ID_USER_NGUOI_BAN": "standard" }
}
```

Có thể bỏ services để tất cả seller dùng standard. Họ tên và địa chỉ trim, tối đa 120/1000 ký tự; điện thoại sau trim cần 9–15 ký tự gồm số, dấu + hoặc khoảng trắng và ít nhất một chữ số. items cần 1–20 dòng, listingId string không rỗng, không trùng sau trim, quantity nguyên 1–99; used chỉ quantity=1. Chỉ new/used được mua. paymentMethod mặc định cod, giá trị khác trả 400.

Server bỏ qua giá/title/seller/buyer/tổng/phí giả gửi kèm, dùng JWT và dữ liệu Listing + Edition + Book + Author để tạo snapshot. Phí lấy tại backend/src/utils/shipping.js: standard=25000, fast=40000 cho mỗi seller; nhiều sách cùng seller chỉ một phí. services không đúng định dạng, dịch vụ lạ hoặc seller không có trong đơn trả 400. Tin tự bán trả 403; digital trả 400 và hướng dẫn chuyển khoản qua /digital-orders; tin không có/chưa approved/hết kho/đã mua trả 409 kèm listingId. Lỗi tạo đơn trả 500 và không lộ lỗi nội bộ.

Response order dùng _id, buyerId, thông tin người nhận, paymentMethod, itemsTotal, shippingTotal, total, createdAt, updatedAt; subOrders chứa snapshot và shipment ban đầu pending. Không trả passwordHash hay email seller. Xem đơn dùng các API theo quyền bên dưới.

Cả sách mới/cũ đều $inc âm với điều kiện stock >= quantity; used đồng thời đổi approved → sold. Đơn mẹ, đơn con và tồn kho nằm trong cùng transaction; một bước lỗi thì hủy toàn bộ. Cần MongoDB replica set; standalone trả 503 kèm hướng dẫn cấu hình. Unique buyerId/idempotencyKey chống đặt trùng; key 16–128 ký tự chữ/số/-/_. Cùng key khác nội dung trả 409; requestHash do server tính. Gửi lại key của đơn đã hủy vẫn trả đơn đã hủy, không tạo lần mua mới. [Chi tiết](HARDENING.md).

## Xem đơn, hủy và vận chuyển

| Method / path | Body / query | Quyền / kết quả |
|---|---|---|
| GET /shipping/services | Không | Công khai; {items:[{id,name,fee,days}]}; cùng cấu hình với tính phí đặt hàng. |
| GET /orders/mine | page,limit,tab? hoặc status? | User; đơn do mình mua, phân trang và số đếm từng mục. Khi lọc bằng tab, chỉ trả các đơn con khớp mục đó. |
| GET /orders/:id | Không | Buyer/admin xem đủ; seller chỉ các đơn con của mình, không trả tổng tiền của đơn mẹ; người ngoài 403. |
| GET /sub-orders/shop | page,limit,status? | User; chỉ đơn con có sellerId của mình, kể cả người bán sách cũ chưa có shop. orderId được populate riêng thông tin người nhận, không lộ phần người bán khác. |
| GET /admin/orders | page,limit,status? | Admin; mọi đơn mẹ và đơn con. status lọc các đơn mẹ có ít nhất một đơn con thuộc trạng thái đó. |
| GET /admin/sub-orders | page,limit,status? | Admin; đơn con có thông tin người nhận; tab vận chuyển dùng status=shipping. |
| PATCH /sub-orders/:id/cancel | {reason?:string} | Buyer: chỉ pending. Seller: pending/confirmed và reason bắt buộc. Hủy thành công hoàn kho. |
| PATCH /sub-orders/:id/confirm | Không | Chỉ seller của đơn; pending → confirmed; trackingCode = BM + 8 ký tự hex in hoa. |
| PATCH /sub-orders/:id/ship | Không | Chỉ seller của đơn; confirmed → shipping. |
| PATCH /admin/sub-orders/:id/shipping | {status:"delivered" hoặc "returned",note?:string} | Admin; delivered từ shipping; returned từ shipping/delivered/completed, hoàn kho và loại khỏi doanh thu. |
| PATCH /sub-orders/:id/received | Không | Chỉ buyer của đơn; delivered → completed. |

Các PATCH trả 200 {subOrder}. reason/note trim, tối đa 1000 ký tự; seller hủy cần lý do không rỗng. Sai quyền 403; trạng thái không cho phép hoặc request đồng thời đã đổi trước trả 409; ID sai 400, không tồn tại 404. page=1–100000, limit=1–50 (mặc định 10); response danh sách {items,total,page,limit,pages}. status là một trong bảy trạng thái hợp lệ. Không nhận sellerId/buyerId để mở rộng quyền từ query/body.

Chuyển trạng thái chỉ định nghĩa tại backend/src/utils/order-status.js:

```text
pending → confirmed → shipping → delivered → completed
pending / confirmed → cancelled
shipping / delivered / completed → returned
```

Mỗi chuyển dùng findOneAndUpdate kèm status hiện tại và thêm một sự kiện. Đổi trạng thái và hoàn kho nằm trong cùng transaction; bấm lại/đồng thời trả 409 và không cộng kho lần nữa. Một dòng hoàn lỗi thì cả trạng thái lẫn các dòng đã hoàn bị rollback. Order.total giữ snapshot lúc đặt; doanh thu chỉ lấy SubOrder đang completed, không tính đơn cancelled/returned.

`tab` nhận `all`, `pending`, `to-ship`, `to-receive`, `completed`, `cancelled`. `to-ship` lọc confirmed; `to-receive` gộp shipping/delivered/completed thành mục Nhận hàng. Bộ lọc completed riêng được giữ để tương thích API cũ, không còn tab riêng trên giao diện. Không gửi đồng thời tab và status; giá trị sai trả 400. Tham số status cũ vẫn hoạt động và giữ đầy đủ đơn con như trước.

GET /orders/mine bổ sung `counts` với sáu key trên, tính toàn bộ đơn của tài khoản trước phân trang. Một đơn nhiều shop chỉ đếm một lần trong mỗi mục, nhưng có thể xuất hiện ở nhiều mục nếu các shop có trạng thái khác nhau. Order.total vẫn là snapshot tổng lúc đặt; giao diện ở tab cụ thể chỉ cộng tiền sách và phí giao của những đơn con đang hiển thị.

Frontend /don-hang giữ năm tab cho đơn COD và hiển thị thêm đơn ebook từ /digital-orders/mine. Ebook chờ thanh toán nằm ở Chờ xác nhận, paid ở Nhận hàng, cancelled/expired ở Đã hủy. Admin có mục Đơn ebook để đối soát và đánh dấu đã nhận tiền. Không có chức năng trao đổi sách; link cũ về trang chủ.

## Thanh toán ebook VietQR

| Method / path | Body/query | Quyền / kết quả |
|---|---|---|
| POST /digital-orders | {listingIds:[string]} | User; một đơn được chứa ebook nhiều shop, dùng tài khoản chung của sàn. Ebook trả phí nhận QR; tổng bằng 0 được paid/cấp quyền ngay và không có QR. |
| GET /digital-orders/mine | page,status?,tab? | User; chỉ đơn của mình, phân trang 10 và counts theo trạng thái. |
| GET /digital-orders/:id/status | Không | Chủ đơn; {status}; pending quá hạn đổi expired. |
| POST /digital-orders/:id/cancel | Không | Chủ đơn, chỉ pending_payment chưa hết hạn; thành công {order}, sai trạng thái 409. |
| GET /library | Không | User; {items} theo EbookAccess của mình, giữ quyền kể cả tin đã ẩn/gỡ. |
| POST /webhooks/bank-transaction | JSON SePay; Authorization: Apikey <secret> | Chỉ khớp tiền vào, mã đơn, đủ tiền và accountNumber trùng tài khoản sàn. Giao dịch không khớp vẫn trả 200 và được lưu BankTransaction theo transactionId duy nhất. |
| GET /admin/digital-orders | page,status? | Admin; danh sách để đối soát. |
| PATCH /admin/digital-orders/:id/mark-paid | {bankTransactionId,paidAmount} | Chỉ admin; bắt buộc ID chưa dùng và số tiền đủ; cùng transaction như webhook. Không dùng cho cancelled; trùng 409. |
| GET /admin/bank-transactions | resolved=true/false, page | Admin; 10 giao dịch/trang, mặc định lấy giao dịch chưa khớp mới nhất. |

DigitalOrder.status: pending_payment/paid/cancelled/expired. QR 30 phút; đơn expired nhận đủ tiền muộn vẫn được cấp quyền. Không có API user tự mark-paid. Response cho buyer đã lọc, không trả buyerId/cartKey/bankTransactionId; admin vẫn xem dữ liệu đối soát. Tài khoản chung lấy từ bốn biến `PAYMENT_BANK_ID`, `PAYMENT_BANK_NAME`, `PAYMENT_ACCOUNT_NO`, `PAYMENT_ACCOUNT_NAME`; thiếu cấu hình trả 503 cho đơn có phí. [Cấu hình và giới hạn](PAYMENT_VIETQR.md).
