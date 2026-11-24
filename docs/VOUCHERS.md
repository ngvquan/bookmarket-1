# Voucher từ người bán

Người bán có thể bấm **Gửi voucher cho người mua này** trên đơn bán, hoặc mở **Kênh người bán → Voucher** để tìm và chọn những khách từng đặt hàng tại shop. Có thể chọn tất cả khách đang hiện (tối đa 50) để gửi một lần. Mục **Nhập email** dành cho người mua khác; mỗi dòng một email, tối đa 50. Chọn mức giảm theo tiền hoặc phần trăm, đơn tối thiểu và hạn dùng. Mỗi người mua nhận một voucher có mã riêng trong **Tài khoản → Voucher của tôi** và chọn tại bước thanh toán. Lô gửi nhiều người được kiểm tra toàn bộ trước khi tạo; người nhận trùng, không hợp lệ hoặc của chính người bán làm cả lô bị từ chối.

- Mỗi voucher thuộc một người bán, một người mua và chỉ dùng một lần. Mỗi đơn chỉ chọn một voucher.
- Giảm giá tính trên tiền sách của chính người bán phát voucher; không giảm phí giao hàng hay sách từ shop khác.
- Máy chủ kiểm tra lại chủ sở hữu, hạn dùng, đơn tối thiểu và giá sách trong giỏ trước khi tạo đơn. Đơn COD lưu tiền giảm trong đơn mẹ và đơn con. Hủy đơn con được giảm giá trả lại voucher.
- Đơn ebook giữ voucher khi QR đang chờ thanh toán. Số tiền QR là số tiền sau giảm. Thanh toán thành công dùng voucher; hủy hoặc QR hết hạn trả lại voucher.
- Nếu khoản chuyển tiền ebook đến muộn sau khi voucher đã dùng ở đơn khác, giao dịch được đưa vào mục đối soát của quản trị viên (`voucher_unavailable`), không cấp ebook hai lần bằng một voucher.

API: `GET /vouchers/mine`, `GET /vouchers/seller`, `GET /vouchers/seller/buyers`, `POST /vouchers/seller`, `POST /vouchers/seller/bulk`, `PATCH /vouchers/seller/:id/revoke`, `POST /vouchers/quote`. `POST /vouchers/seller` nhận `buyerEmail` hoặc `buyerId`; `POST /vouchers/seller/bulk` nhận mảng `buyerEmails` hoặc `buyerIds` từ 2 đến 50 người cùng điều kiện giảm giá. ID người mua phải thuộc đơn hàng của shop. `POST /orders` và `POST /digital-orders` nhận thêm `voucherId` tùy chọn. Giá giảm được lấy từ database; client không được gửi số tiền giảm.

Frontend phát triển có thể đặt `API_PROXY_TARGET=http://127.0.0.1:4000` trước khi khởi động Vite để thử toàn bộ voucher và thanh toán trên cùng database local. Cấu hình Vite mặc định gửi API mua hàng tới backend đã triển khai; backend đó hiện chưa có route voucher, nên cần triển khai mã backend này trước khi voucher hoạt động cùng luồng thanh toán QR trên website đang dùng.
