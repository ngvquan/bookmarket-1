# Thanh toán ebook bằng VietQR

## Mô hình hiện tại

BookMarket dùng **một tài khoản ngân hàng của sàn** cho toàn bộ đơn ebook. Tài khoản này chỉ được cấu hình ở backend, không nằm trong hồ sơ shop và không được nhận từ request của người mua.

```env
PAYMENT_BANK_ID=970415
PAYMENT_BANK_NAME=VietinBank
PAYMENT_ACCOUNT_NO=0123456789
PAYMENT_ACCOUNT_NAME=BOOKMARKET
PAYMENT_QR_TEMPLATE=compact2
PAYMENT_WEBHOOK_SECRET=mot-secret-ngau-nhien-it-nhat-32-ky-tu
```

Nếu thiếu một trong bốn biến ngân hàng, `POST /digital-orders` có tổng tiền lớn hơn 0 trả mã 503 với thông báo `Thanh toán chuyển khoản chưa được cấu hình`. Không ghi thông tin thật vào `.env.example` hoặc commit file `.env`.

## Luồng thanh toán

1. Người mua có thể chọn ebook của nhiều shop trong một lần đặt. Server lấy giá từ Listing và tạo một DigitalOrder.
2. Server tạo mã chuyển khoản `BM...` và VietQR trỏ tới tài khoản chung của sàn. Đơn lưu snapshot ngân hàng để QR cũ không đổi khi cấu hình mới thay đổi.
3. Ngân hàng/SePay gọi `POST /webhooks/bank-transaction` với API key.
4. Webhook chỉ khớp khi là tiền vào, có đúng mã đơn, đủ tiền và `accountNumber` tồn tại, khớp tuyệt đối `PAYMENT_ACCOUNT_NO`.
5. Trong một MongoDB transaction, đơn đổi sang `paid`, tạo EbookAccess cho từng ebook và đánh dấu BankTransaction liên quan đã xử lý.
6. Frontend hỏi trạng thái mỗi 3 giây; khi server trả `paid`, ebook được bỏ khỏi giỏ và xuất hiện trong thư viện.

Một tài khoản không thể mua ebook của chính mình hoặc ebook đã sở hữu. Cùng bộ ebook đang chờ thanh toán sẽ dùng lại đơn cũ. QR hết hạn sau 30 phút; khoản tiền đúng đến muộn vẫn có thể khớp đơn `expired`. Đơn `cancelled` không được tự động cấp quyền.

### Ebook miễn phí

Đơn có tổng tiền bằng 0 không cần cấu hình ngân hàng, không tạo QR và được chuyển sang `paid` ngay trong transaction. Quyền đọc được cấp tức thời và mã giao dịch nội bộ có dạng `FREE-<orderId>`.

## Webhook và giao dịch chưa khớp

Endpoint webhook chạy trực tiếp trên backend, ví dụ `https://ten-mien-backend/webhooks/bank-transaction`; không thêm `/api` nếu reverse proxy không cấu hình tiền tố đó. Header:

```text
Authorization: Apikey <PAYMENT_WEBHOOK_SECRET>
```

Giao dịch không khớp vẫn trả HTTP 200 để nhà cung cấp không gửi lại vô hạn. Server lưu một bản ghi BankTransaction theo `transactionId` duy nhất với một trong các lý do:

- `outgoing`: tiền ra;
- `no_code`: không tìm thấy mã BM;
- `no_order`: mã không thuộc đơn nào;
- `not_enough`: số tiền nhỏ hơn tổng đơn;
- `wrong_account`: thiếu hoặc sai số tài khoản nhận;
- `order_cancelled`: đơn đã hủy.

Admin mở **Quản trị → Đơn ebook**, chọn một giao dịch chưa khớp hoặc nhập ID/số tiền thủ công rồi xác nhận cho đúng đơn. Khi thành công, việc đổi đơn sang paid, cấp quyền và đặt BankTransaction thành `resolved=true` cùng `orderId` nằm trong một transaction. Một ID giao dịch không thể dùng cho hai đơn.

API đối soát:

- `GET /admin/bank-transactions?resolved=false&page=1`: danh sách 10 giao dịch/trang;
- `GET /admin/digital-orders`: danh sách đơn ebook;
- `PATCH /admin/digital-orders/:id/mark-paid`: body `{bankTransactionId, paidAmount}`.

## Dữ liệu trả cho người mua

Các response đơn ebook phía người mua chỉ có `_id`, `items` đã lọc (`listingId`, `title`, `author`, `price`), `total`, `status`, `transferCode`, `qrImageUrl`, `bank`, `expiresAt`, `paidAt`, `createdAt`. Không trả `buyerId`, `cartKey` hay `bankTransactionId`. Admin vẫn nhận dữ liệu cần thiết để đối soát.

## MongoDB và chạy thử

DigitalOrder có `transferCode` unique, `bankTransactionId` unique/sparse và partial unique index cho `buyerId + cartKey` khi đang chờ. BankTransaction có `transactionId` unique. EbookAccess unique theo `buyerId + listingId`. Thanh toán dùng transaction nên MongoDB phải chạy replica set; xem script `scripts/start-mongo-replica.ps1`.

Khi thử local qua ngrok:

```text
ngrok http 4000
```

Cấu hình URL HTTPS nhận được cộng `/webhooks/bank-transaction` trong SePay, chọn JSON, tiền vào và API Key. Dùng ebook giá nhỏ, kiểm tra đúng tài khoản, số tiền, nội dung, trạng thái DigitalOrder, EbookAccess và BankTransaction. Test tự động không thay thế việc thử một giao dịch thật với SePay.

## Migration

Trước khi áp dụng trên database đã có dữ liệu, sao lưu rồi chạy xem trước:

```powershell
npm run migrate:hardening
npm run migrate:hardening -- --apply
```

Lệnh `--apply` tự tạo backup trước khi ghi. Migration gỡ `shops.paymentBank` cũ và tính lại trạng thái hoàn tất shop chỉ theo liên hệ + địa chỉ.

## Giới hạn chưa làm

- Chưa chia tiền hoặc tự động chuyển tiền từ sàn cho từng shop.
- Chưa tự động hoàn tiền cho người mua.
- Chưa có rate limiting cho webhook/API thanh toán.
- Thư viện ebook chưa phân trang.
- Ebook mới hỗ trợ upload PDF tối đa 100 MB, đọc thử tối đa 2 trang và bảo vệ file đầy đủ bằng JWT + EbookAccess. File đang lưu trên ổ đĩa backend, chưa dùng object storage/CDN hoặc mã hóa DRM.
