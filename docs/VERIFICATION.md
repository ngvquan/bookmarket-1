# Kiểm chứng BookMarket

## Hồ sơ, địa chỉ, yêu thích và thông báo — 08/11/2026

Đã thêm trang `/ho-so` để đổi tên và quản lý tối đa 3 địa chỉ; checkout chọn địa chỉ đã lưu hoặc lưu địa chỉ mới. Yêu thích chuyển từ dữ liệu trình duyệt sang trường `users.favorites`. Collection `notifications` lưu thay đổi trạng thái đơn, có số chưa đọc và đánh dấu đã đọc tại `/thong-bao`. Frontend build đạt; backend đạt 99 test/8 file khi chạy tuần tự trên replica set test; ca Chrome tích hợp đổi tên, địa chỉ, yêu thích và thông báo đạt.

## Upload ảnh và PDF ebook — 08/11/2026

Đã ghép phần phù hợp từ source tham khảo: tối đa 5 ảnh/tin, PDF tối đa 100 MB, đọc thử tối đa 2 trang và đọc/tải file đầy đủ có kiểm tra quyền. Luồng mua giả lập cũ không được đưa lại; quyền file đầy đủ dùng `DigitalOrder + EbookAccess` sau thanh toán VietQR. Ebook mới ở pending cho đến khi upload PDF thành công; ebook mẫu legacy chưa có file vẫn đọc PDF minh họa. Backend đạt 98 test/8 file, test riêng digital đạt 20/20, frontend build đạt và ca Chrome upload ảnh/PDF + đọc thử đạt.

## Ghép tính năng marketplace từ source tham khảo — 08/11/2026

Đã ghép bốn phần phù hợp vào code hiện tại: theo dõi shop/bảng tin, người bán phản hồi đánh giá, tự ẩn/hiện tin có phân biệt quyền admin và gợi ý sách cùng tác giả/thể loại. Không đưa lại trao đổi sách hoặc ebook session. Frontend build đạt; backend đạt 97 test/8 file trên replica set test; ca Chrome theo dõi shop và ẩn/hiện tin đạt. Hai database QA dùng để test/xuất schema đã xóa, database chính không bị sửa. Bản xuất hiện có 18 collection.

## ISBN bắt buộc và gợi ý phiên bản để so sánh giá — 07/11/2026

POST tạo listing mới bắt buộc ISBN 10/13; PATCH vẫn cho phép sửa tin legacy thiếu ISBN. Thêm GET `/listings/suggestions` có xác thực, tìm tối đa 5 phiên bản theo tiền tố ISBN hoặc tên + tác giả, tách sách giấy/PDF. Form đăng sách gọi API sau 350 ms, cho chọn phiên bản và tự điền metadata; frontend không gửi editionId, backend vẫn resolve bằng ISBN và trả 409 nếu metadata không khớp. Tin được chọn dùng chung editionId nên xuất hiện trong nhóm so sánh giá.

Frontend build đạt. Toàn bộ backend đạt 90 test/7 file trên DB test replica set; test mới kiểm tra xác thực API gợi ý, ISBN bắt buộc, tìm không dấu, ghép đúng editionId và offerCount. Ba ca Chrome bị ảnh hưởng trực tiếp đều đạt: CRUD tin, chọn Nhà giả kim theo tên/tác giả để thêm offer so sánh, và đăng/sửa sách cũ. Database QA đã xóa; database chính không bị sửa.

## VietQR tài khoản chung của sàn và đối soát — 07/11/2026

Đã bỏ `Shop.paymentBank`; đăng ký shop còn 3 bước và hoàn tất theo liên hệ + địa chỉ. Một DigitalOrder có thể chứa ebook của nhiều shop, nhưng QR luôn dùng bốn biến tài khoản chung ở backend. Webhook bắt buộc `accountNumber` khớp tài khoản sàn. Giao dịch không khớp được lưu BankTransaction để admin chọn đối soát; ebook miễn phí paid/cấp quyền ngay không cần QR. Response buyer đã bỏ buyerId/cartKey/bankTransactionId, thư viện tải Listing theo một truy vấn batch.

Frontend build đạt. Toàn bộ backend đạt 93 test/7 file trên database test replica set cổng 27018, gồm ca nhiều shop, thiếu cấu hình, sai/thiếu accountNumber, lưu và giải quyết BankTransaction, response riêng tư và ebook miễn phí. Database chính không bị sửa. Chưa thử chuyển tiền, quét QR hoặc webhook SePay thật.

## Bỏ trao đổi và thanh toán ebook VietQR — 07/11/2026

Làm A trước B: bỏ enum/field/nhánh UI/API trao đổi, xóa RequestsPage, thêm migration remove-exchange có dry-run/backup/apply. Build A đạt; npm run test:api với database riêng đạt 72 test trước khi bắt đầu B. Migration thật trên DB chính mới được dry-run (34 tin trao đổi, 216 tin có wanted cần gỡ), chưa apply. Migration apply đã thử trên bản sao dữ liệu và có backup; chạy lại không ghi thêm.

B thêm DigitalOrder/EbookAccess, VietQR Quick Link SVG, webhook SePay JSON/API Key theo tài liệu chính thức đã đọc, transaction paid + quyền, sparse unique giao dịch, unique partial đơn chờ, thư viện DB, QR/polling/đếm ngược/hủy/mở lại và admin đối soát. Thống kê thêm doanh thu ebook paid tách với sách mới/cũ. Không thêm dependency, không sửa backend/.env thật. Đã xóa useSessionDemo và nhánh DEMO-. Reader vẫn là trình đọc PDF mẫu.

Backend cuối đạt 88 test/7 file, gồm 15 test thanh toán: snapshot/giá DB, không tự mua/mua lại, pending dùng lại khi đồng thời, cấu hình/secret, webhook lặp, thiếu tiền/sai mã/tiền ra/sai tài khoản, mã thêm khoảng trắng/chữ thường, hết hạn và tiền muộn, hủy/phân quyền, thư viện riêng, admin mark-paid, rollback khi cấp quyền lỗi, giỏ chồng ebook và tin bị gỡ lúc đang chờ. Có test migration/hardening hiểu partial unique và quan hệ quyền/đơn paid. Toàn bộ test dùng DB test replica set, không gọi ngân hàng thật.

E2E chạy bộ 41 ca: 40 đạt trong lượt toàn bộ, một ca giỏ hàng cũ thất bại vì thiếu trang seed mở rộng. Đã sửa fixture tự tạo và dọn các tin thử; chạy lại nhóm 3 ca catalog/giỏ trên DB test mới đạt cả 3, xác nhận fixture không làm lệch các ca sau. Trước đó các ca VietQR, giỏ hỗn hợp COD → chuyển khoản, giữ ebook khi chưa paid, mở lại QR, dừng polling khi đóng, thư viện sau reload, admin mark-paid, hủy và redirect link cũ đều đạt. Các ca đơn hàng, chat, đăng ký shop và đánh giá cũng đạt ở lượt toàn bộ. Ảnh QR được mock để kiểm tra UI; không kiểm chứng quét QR thật. Ảnh desktop/mobile không tràn trang; build cuối đạt.

database/ được tạo từ bản sao snapshot, lọc/gỡ trao đổi bằng migration trên DB test. Bản chuyển máy có 16 collection, 594 bản ghi, 216 listings; hai collection thanh toán hiện rỗng, không bịa giao dịch từ thư viện cục bộ. Đã restore vào DB test khác, kiểm tra đủ bản ghi/index và harden dry-run không có issue. Schema/CSV/báo cáo có field và index cả collection rỗng. Seed trên DB test tạo 14 listings/10 users và quyền ebook mẫu cho demo; seed có mã SEED-LIBRARY riêng, không phải thanh toán ngân hàng thật.

Chưa kiểm chứng tài khoản ngân hàng thật, quét QR/chuyển tiền thật, ngrok public hoặc webhook gửi trực tiếp từ SePay vì chưa có cấu hình của người dùng. Không triển khai upload/phân phối PDF thật, hoàn tiền hoặc chuyển tiền cho shop. Cách cấu hình/test và toàn bộ file thay đổi: [PAYMENT_VIETQR.md](PAYMENT_VIETQR.md), [CHANGELOG_VIETQR.md](CHANGELOG_VIETQR.md).

## Setup và run bằng BAT trên Windows — 05/11/2026

Thêm setup.bat/run.bat, scripts/windows-local.ps1 và backend/scripts/setup-local-database.mjs. Setup cài thư viện bằng lệnh sẵn có, giữ .env, tự nhập database đi kèm vào DB trống hoặc seed bản source-only. Database đã có collection không bị ghi đè/seed lại. Run kiểm tra MongoDB, dùng lại server BookMarket đang hoạt động và báo lỗi nếu cổng bị ứng dụng khác chiếm. Script đóng gói đã bao gồm hai BAT ở thư mục gốc.

Kiểm chứng trên fixture nằm trong đường dẫn có dấu cách và ký tự &: nhập đủ 14 collection/628 bản ghi vào database test, chạy setup lần hai không tăng bản ghi và giữ nguyên hash .env. Bản không kèm database seed được 13 users/18 listings vào database test trống. Các nhánh chưa setup, thiếu Node/npm và PORT backend trùng 5173 trả lỗi rõ ràng. Lệnh npm cài thư viện được thay bằng stub ở fixture để tránh cài lại hoặc thay lockfile; các bước tạo cấu hình, khởi động MongoDB, restore và seed chạy thật. Hai database test đã được dọn, dữ liệu chính giữ nguyên.

run.bat chạy thật với các server chính đang hoạt động, nhận đúng API/frontend và không mở bản trùng. Kiểm tra cú pháp PowerShell/Node đạt. Phép thử riêng mở backend mới bị kiểm tra tự động chặn với lý do blocked by policy, nên chưa xác nhận nhánh mở hai cửa sổ server mới bằng chạy thực tế. Không cần build lại frontend cho thay đổi script này. [Cách dùng](WINDOWS_SETUP.md).

## Đánh giá chỉ dành cho khách đã mua — 05/11/2026

Thêm Review và collection reviews, API đọc công khai/kiểm tra quyền/gửi đánh giá; chỉ buyer có đơn con completed chứa đúng listingId được gửi. Unique buyerId/listingId chặn trùng, kể cả đồng thời. Public response không lộ ID đơn, email hay thông tin người nhận. React có form 1–5 sao và nhận xét ở chi tiết sách hoặc lịch sử đơn hoàn thành; dùng được với tin used đã sold/hết kho. Bỏ ghép rating mẫu, tính điểm trung bình thật từ reviews. Không migrate hoặc tạo đánh giá giả cho đơn cũ.

Toàn bộ 71 test backend (6 file) đạt, gồm 6 ca mới kiểm tra điều kiện theo trạng thái, quyền tài khoản, liên kết đơn, dữ liệu sai, request đồng thời, sách sold, hoàn/hủy và trung bình/phân trang. Có 5 ca UI liên quan đã đạt: 3 ca đánh giá mới và 2 ca hồi quy tab/phân trang. Sau chỉnh khoảng cách mobile, chạy lại 4 ca gồm 3 ca đánh giá và ca chuyển tab, đều đạt; build đạt. Ca đánh giá từ lịch sử ban đầu thất bại do locator label chọn sao; đổi sang combobox theo tên truy cập và chạy lại đạt. Kiểm tra ảnh desktop/mobile không tràn trang. Test chạy trên database riêng; không tạo đơn/đánh giá trên database chính. Backend chính tự khởi tạo collection/index reviews, frontend/API trả thành công trên cổng 5173/4000.

File và cách tự thử được ghi trong [REVIEWS.md](REVIEWS.md). Không cần migration cho dữ liệu hiện có.

## Gộp Chờ nhận hàng và Hoàn thành — 05/11/2026

Hai tab được gộp thành Nhận hàng, gồm shipping/delivered/completed. Giữ nguyên nhãn trạng thái từng đơn và nút xác nhận đã nhận; hoàn tất đơn không làm đơn rời tab. API tính số đếm trên nhóm trạng thái gộp, không cộng trùng đơn nhiều shop. Ebook mô phỏng xuất hiện ở Tất cả và Nhận hàng; URL tab=completed cũ tự chuyển về tab=to-receive. Không thay dữ liệu hoặc luồng tồn kho/doanh thu.

32 test backend đơn hàng, 2 test trình duyệt về tab/phân trang và build đạt. Ca backend kiểm tra đơn chỉ còn completed vẫn xuất hiện trong nhóm gộp; ca giao diện kiểm tra hoàn thành tại chỗ, số đếm, URL cũ và điện thoại. Các test dùng database riêng.

## Chia mục đơn hàng người mua — 05/11/2026

Thêm sáu tab Tất cả / Chờ xác nhận / Chờ giao hàng / Chờ nhận hàng / Hoàn thành / Đã hủy, không có Refund. API lọc đúng đơn con theo tab, đếm từng đơn mẹ một lần trong mỗi mục và giới hạn theo tài khoản. Tab Chờ nhận hàng gộp shipping/delivered. Giao diện lưu tab/trang trên URL, tự cập nhật mỗi 5 giây, bỏ phản hồi cũ khi chuyển tab và quay về trang hợp lệ nếu trang cuối hết đơn. Tổng ở tab cụ thể chỉ cộng phần đơn đang hiển thị. Không đổi schema hoặc dữ liệu cũ.

32 test backend đơn hàng đạt. Nhóm 5 test trình duyệt đạt: hai ca mới kiểm tra nhiều shop, số đếm, hủy/nhận, cập nhật nền, tải lại, phân trang, phản hồi chậm và điện thoại; ba ca hồi quy giỏ hỗn hợp, phí giao, hủy/hoàn hàng. Build frontend đạt. Kiểm tra ảnh desktop/mobile không tràn trang. Test dùng database riêng, không tạo đơn trên database chính.

## Ô tổng kho giảm khi đơn hoàn tất — 05/11/2026

Theo xác nhận người dùng, phần cần sửa là ô Sách còn trong kho ở Thống kê. Tách `catalog.availableBooks` (còn bán), `reservedBooks` (đang giữ cho đơn xử lý) và `inventoryBooks` (tổng hai số). Giao diện dùng inventoryBooks, bổ sung dòng Sách đang giữ cho đơn. Không thay thao tác $inc nguyên tử khi giữ hàng, không trừ lần thứ hai lúc completed và không sửa stock của các đơn cũ.

33 test API đơn hàng/thống kê và 3 test giao diện đạt, build đạt. Ca giao diện kiểm chứng tổng kho 3 khi ban đầu và khi đặt giữ 1 cuốn, giảm 2 sau completed, tăng lại 3 sau returned; số còn bán ở database đã là 2 ngay khi giữ hàng. Việc chuyển trạng thái ở các tài khoản khác được tự cập nhật lên ô thống kê. Các test dùng database riêng, không đặt đơn trên database chính.

## Tự cập nhật tồn kho và biểu đồ tĩnh — 05/11/2026

Đọc dữ liệu chính cho thấy cuốn trong đơn hoàn tất đã giảm stock từ 3 trong backup xuống 2; thống kê của shop trả tổng 4 cuốn còn bán ở hai tin. Không sửa hoặc trừ lại kho trong database chính. Sửa SellerStats tự tải số thực mỗi 5 giây khi tab hiển thị, khi focus/online và tránh request chồng nhau; cập nhật nền không làm nhấp nháy trạng thái đang tải. Bỏ chọn mốc bằng chuột/phím, chấm, đường dọc và phần chi tiết mốc để biểu đồ chỉ hiển thị.

Test trình duyệt trên database riêng xác nhận: kho 3 → 2 sau đặt, hoàn tất vẫn 2, hoàn hàng lên 3; doanh thu 0 → 60000 → 0, màn hình tự đổi mà không bấm làm mới. Biểu đồ không có điểm/đường chọn kể cả khi hover. Nhóm 3 test thống kê và luồng đơn đều đạt; build đạt. Giữ nguyên quy tắc kho trừ lúc đặt thành công, doanh thu tính khi hoàn tất.

## Khôi phục tải phí giao khi API gián đoạn — 05/11/2026

Đã tái hiện phản hồi 502 text/plain làm lỗi parse JSON và khóa checkout dù API đã hoạt động trở lại. Sửa proxy Vite trả JSON 503 khi không kết nối backend; API client giữ status khi parse lỗi. Riêng GET phí giao thử tối đa 3 lần, khóa request trùng, kiểm tra cấu trúc dữ liệu và cho thử lại thủ công hoặc khi kết nối/focus trở lại. Không tự gửi lại POST đặt hàng. Phí chưa tải được không hiển thị là miễn phí.

Ba test trình duyệt đạt: lỗi gateway tạm thời tự khôi phục; gián đoạn kéo dài vẫn khóa checkout và nút thử lại hoạt động; JSON sai cấu trúc không làm sập giỏ. Build đạt. Kiểm tra proxy thật qua Vite riêng trỏ cổng không có backend: HTTP 503 với JSON hợp lệ. API chính qua cổng 5173 trả 200, standard=25000 và fast=40000. Các kiểm tra chỉ đọc API/giỏ trình duyệt, không tạo đơn hoặc sửa database. Vite kiểm thử riêng đã dừng.

## Bỏ chờ duyệt sách — 05/11/2026

POST listing và sửa tin đang bán hiển thị ngay. Admin không còn tab duyệt, vẫn được ẩn/hiện tin; sửa tin đã bị admin ẩn không tự công khai lại. Mặc định model và seed không tạo hàng chờ mới. API giữ pending như giá trị tương thích dữ liệu cũ. Script publish:books mặc định dry-run; --apply sao lưu trước khi chỉ đổi listing pending sang approved, không tác động trạng thái đơn pending. Đã chuyển 8 tin cũ trong database chính, backup tại exports/backups/before-publish-books-2026-11-05T01-56-48-189Z.json. Test API 63/63, UI đăng/sửa không cần duyệt và quản trị 3/3 đạt; build thành công.

## Sửa sách biến mất sau thêm giỏ — 05/11/2026

Đã tái hiện trên trình duyệt: xem trang catalog thứ hai để cache hơn 12 cuốn, về trang chủ và thêm cuốn đầu vào giỏ; cuốn bị đẩy khỏi 12 thẻ đang hiện. Sửa cập nhật tại vị trí cũ, giữ offerCount khi đọc API chi tiết; không đổi backend hoặc tồn kho khi thêm giỏ. Bỏ toast thêm giỏ, ô lối tắt Gian hàng và dòng phụ trong Success. Test hồi quy trước sửa thất bại đúng lỗi; sau sửa kiểm tra thứ tự thẻ, số bản bán, hai sách trong giỏ và reload đều đạt. Hai test catalog/responsive và thao tác giỏ trên điện thoại cũng đạt. Tất cả chỉ đọc API, không tạo tài khoản/đơn hoặc sửa dữ liệu chính.

## Shop, transaction, idempotency và migration — 05/11/2026

- API: bộ 60 test trên 5 file đạt; bổ sung 2 test cạnh tranh cùng key/khác tin và thử lại sau rollback cũng đạt. Chạy lại nhóm orders/database sau thay đổi cuối: 34/34 đạt, tổng 62 ca đã kiểm tra.
- Giao diện: 29 ca được kiểm tra trên Chrome. Lượt tổng có 28 đạt/1 lỗi do test cũ so tổng catalog với 50 tin đầu. Sửa test đọc đủ các trang rồi chạy lại đạt. Chạy lại 3 luồng form/đơn bị ảnh hưởng bởi giới hạn input cuối cùng đều đạt.
- Shop: API chặn POST/PATCH new/digital khi hồ sơ chưa đủ; từ chối tự gán cờ; hoàn tất hồ sơ mở quyền đăng. Used không bắt buộc shop; riêng tư và unique owner vẫn đạt.
- Transaction: cạnh tranh kho new/used; lỗi metadata/đơn mẹ/đơn con; lỗi hoàn kho dòng thứ hai rollback cả trạng thái và kho dòng đầu. Không chạy các thao tác kiểm thử mua/hủy trên database chính.
- Idempotency: 5 request cùng key tạo 1 đơn; cùng key khác nội dung bị 409; khác buyer tách biệt; rollback không chiếm key. Mất response sau server commit, thử lại ngay hoặc reload đều trả đơn cũ, chỉ một lần trừ kho.
- Doanh thu: trước completed bằng 0; completed tăng theo tiền sách; admin returned sau completed loại doanh thu/số cuốn và hoàn kho một lần.
- Migration: dry-run không ghi; apply tạo backup trước cập nhật/index; giữ ID; chạy lại không đổi; duplicate/ref sai dừng trước khi ghi.
- Bản đang dùng: sao lưu standalone sang `exports/backups/before-hardening-20261105-080600/`, chép sang replica set `bookmarket-rs` cổng 27018. Đối chiếu đủ dữ liệu và index của 13 collection/608 bản ghi trước migration. Apply cập nhật 27 hồ sơ shop theo dữ liệu thật; không tạo thông tin giả. Backup trước apply: `exports/backups/hardening-2026-11-05T01-06-32-895Z.json`.
- Sau apply: dry-run 0 thay đổi, 0 lỗi, index khớp schema. Database standalone gốc cổng 27017 còn nguyên; backend/.env trỏ bản replica set. JWT secret được giữ nguyên.
- Đối chiếu lần cuối: tất cả bản ghi giữ nguyên ngoài field hoàn tất shop; 1 shop đủ hồ sơ, 26 shop cần bổ sung. Không tạo đơn giả trong database chính. Build cuối thành công, 1834 modules; frontend 5173, backend 4000 và catalog qua proxy đều HTTP 200. Dừng riêng hai server QA sau kiểm tra, giữ frontend/backend chính và replica set chạy.

Các mục bên dưới là kết quả tại thời điểm lịch sử tương ứng; giới hạn transaction/idempotency cũ đã được thay thế bằng bản trên. Hướng dẫn tự thử và danh sách file: [HARDENING.md](HARDENING.md).

## Hoàn tất Giai đoạn 2–3 — 03/11/2026

| Kiểm tra | Kết quả thực tế |
|---|---|
| npm run build (bản cuối) | Thành công, 1814 modules, 4.45 giây; CSS 82.86 kB/gzip 16.76, JS chính 390.63 kB/gzip 119.70, PDF lazy 434.11 kB/gzip 179.78. |
| npm run test:api | 35/35 đạt, 17.01 giây; giữ nguyên 12 bài cũ và 23 bài về đơn/kho/quyền/vận chuyển/cleanup. |
| npm run test:e2e (bản cuối) | 16/16 Playwright đạt, 58.0 giây, Chrome headless. Mốc trước thêm test seller hủy cũng đã đạt 15/15. |
| Kho đồng thời | Used: đúng một 201/một 409; new vượt kho không âm. Lỗi dòng cuối/lỗi lưu mẹ/con/metadata hoàn các dòng đã giữ. |
| Hủy và hoàn | Hai request đồng thời: một 200/một 409; stock chỉ cộng lại một lần, used trở lại approved. Buyer không hủy confirmed; seller cần lý do. |
| Quyền đọc và ghi | Buyer/admin đủ đơn; seller chỉ đơn con mình, không thấy tổng mẹ; người ngoài 403. Seller B không confirm/ship/cancel đơn A; user không cập nhật hãng demo. |
| Timeline | pending → confirmed (có mã BM) → shipping → delivered → completed; nhánh returned hoàn kho; chuyển sai 409. |
| Frontend | Checkout thật/giữ ebook trong giỏ, phí fast, đơn tồn tại sau reload, buyer hủy, seller hủy confirmed có lý do, seller giao, admin giao/hoàn, buyer nhận và timeline. 409 hiện nút cập nhật giỏ. |
| Cleanup | Chạy script thật trên DB test: xác nhận sai không sửa dữ liệu; xác nhận đúng backup rồi xóa tài khoản/shop/tin không có đơn, giữ user có đơn, bỏ refreshsessions/isActive/searchText. Không chạy xóa DB phát triển chính. |
| Import và đóng gói | 214 import tương đối đều có file đích; gói source kiểm CRC và đối chiếu byte từng file, không kèm exports/archives/dependencies/build/.env/ZIP cũ. |
| Backend thật sau cập nhật | /health 200, /api/shipping/services qua Vite 200, trả đúng standard/fast. Khởi động lại API 4000, frontend 5173 vẫn chạy. |
| Dữ liệu chính | Hash SHA-256 toàn bộ document của 11 collection trước/sau khởi động khớp: 50 users, 1 admin, 14 shops, 13 authors, 2 publishers, 4 categories, 16 books, 16 editions, 18 listings; orders/suborders vẫn rỗng. Export mới đủ 11 collection vào exports/BookMarket-database-current. |

API suite dùng bookmarket_test_fullorders, dọn DB sau suite. E2E dùng bookmarket_test_fullui riêng, API 4001/Vite 5180; seed/reset riêng QA giữa các lần chạy, đã dừng riêng server QA và xóa DB QA sau khi xong. Không đặt đơn, trừ kho hoặc dọn user trên bookmarket_foundation để thử tính năng. Những mục dưới là kết quả lịch sử trước mốc hoàn thành này, không phải giới hạn hiện tại.

Chưa thử Firefox/Safari, crash/mất kết nối trong lúc giữ/bù kho hoặc phục hồi backup. Không có transaction/idempotency/tác vụ đối soát bền vững. Ebook/trao đổi còn demo; không có thanh toán thật, hãng thật, email, upload hay đánh giá. Không thêm dependency.

## Giai đoạn 2 bước 1 — models và đặt hàng, 03/11/2026

| Kiểm tra | Kết quả thực tế |
|---|---|
| npm run build | Thành công, 1809 modules, 4.13 giây; frontend không đổi. |
| npm run test:api | 26/26 đạt: 12 bài cũ + 14 bài đặt hàng, 13.83 giây ở lần chạy cuối. |
| DB kiểm thử | bookmarket_test_ordersstep1; suite xóa DB sau khi chạy. Lần đầu chọn tên có thêm dấu gạch dưới bị guard chặn trước khi kết nối; đã đổi tên đúng mẫu rồi chạy thành công. |
| Kho đồng thời sách cũ | Promise.all hai request: đúng một 201, một 409; một Order/SubOrder, tin sold. |
| Kho đồng thời sách mới | Tồn 3, hai request mỗi request mua 2: một 201, một 409, tồn cuối 1. |
| Bù kho nhiều dòng | Dòng cuối thiếu hàng: hoàn stock sách mới và trả used về approved; không lưu đơn. |
| Lỗi ghi/metadata | Giả lập lỗi metadata, lưu Order và lưu SubOrder thứ hai: trả 500, dọn đơn đã ghi, hoàn kho. |
| Snapshot/phí/quyền | Giá, tên sách/shop giữ snapshot; bỏ giá/seller/buyer/phí giả; cùng seller một phí; standard/fast tính ở server; từ chối thiếu token, admin, tự mua, tin không hợp lệ. |
| Backend chính | Khởi động lại thành công; /health 200; POST /api/orders qua proxy frontend không token trả 401. Không tạo đơn thử trên DB chính. |
| Dữ liệu trước/sau khởi động | Count và SHA-256 toàn bộ document của cả chín collection cũ khớp; thêm orders/suborders rỗng. |
| npm run export:db | Xuất 11 collection vào exports/BookMarket-database-current; orders/suborders mỗi collection 0 bản ghi. |
| Playwright | Chưa chạy lại trong bước này. Kết quả Playwright ở các mục dưới là của mốc trước. |

Các ca lỗi ghi dùng vi.spyOn; ca mua đồng thời dùng cập nhật trên MongoDB thật, không mock kho. Chưa kiểm chứng phục hồi sau khi kill process/mất kết nối trong lúc ghi hoặc bù kho. Chưa có API hủy/xem đơn, frontend đơn giấy hay luồng vận chuyển; các phần đó sẽ có test ở bước sau. Không có dependency mới.

## Sắp xếp thư mục — 03/11/2026

Kết quả chạy sau khi chuyển backend vào src/scripts và gom frontend theo pages/components/data/utils/styles:

| Kiểm tra | Kết quả thực tế |
|---|---|
| npm run build | Thành công, 1809 modules, 4.75 giây. |
| npm run test:api | 12/12 đạt, 11.00 giây; DB riêng bookmarket_test_structure. |
| npm run test:e2e | 12/12 đạt, 27.1 giây, Chrome headless; DB riêng bookmarket_test_structure_ui. |
| Kiểm tra import tương đối | 158 import trong source/fixture/test backend/frontend, không thiếu file. |
| Seed và migrate theo đường dẫn mới | Seed 18 tin; migrate convertedListings=0, movedAdmins=0; backup đúng exports/backups. Chạy trên DB test. |
| npm run export:db | Thành công; xuất đủ chín collection của bookmarket_foundation đúng exports/BookMarket-database-nine. |
| API 4000 và proxy 5173 | Health thành công; ISBN Nhà giả kim trả 3 offer, 3 seller, 1 editionId. |

Database chính vẫn có 50 users, 1 admin, 14 shops, 13 authors, 2 publishers, 4 categories, 16 books, 16 editions, 18 listings. Không seed/migrate dữ liệu chính trong lần sắp xếp thư mục này. Các ZIP cũ và source Expo nằm trong archives; tài liệu mốc cũ trong docs/history. Các kết quả phần dưới là mốc migration trước khi sắp xếp thư mục.

Ngày 02/11/2026 (giờ Việt Nam), Windows/PowerShell, Node 20.20.2. Không lấy kết quả của phiên bản cũ để khẳng định phiên bản mới.

| Kiểm tra | Kết quả thực tế |
|---|---|
| npm run build | Thành công, Vite 1804 modules, 6.95 giây. |
| npm run test:api | 12/12 Vitest + supertest, 12.93 giây. |
| npm run test:e2e | 12/12 Playwright, 29.8 giây, Chrome headless. |
| npm audit backend / frontend | 0 vulnerabilities ở cả hai tại thời điểm chạy. Không thêm dependency. |
| Migration database chính | 18 listing được liên kết editionId, một admin chuyển collection; giữ các tài khoản/seller/listing ID. |
| Migration chạy lại | convertedListings=0, movedAdmins=0, cả chín count không đổi. |
| Seed hai lần liên tiếp | Giữ 50 user, 18 tin; không đổi dữ liệu có sẵn. |
| Đối chiếu backup trước migration | Metadata, giá, kho, status và seller ID của đủ 18 tin khớp; email/hash của 50 user, ID/hash admin giữ nguyên. |
| API chính qua proxy frontend | /api/listings ISBN Nhà giả kim 200, 3 offer, 3 seller, đúng 1 editionId. |
| Admin trên backend chính | /admin/auth/login 200, /admin/auth/me 200; dùng tài khoản admin trên /auth/login trả 401. |

Kết quả database chính:

| Collection | Bản ghi |
|---|---:|
| users | 50 |
| admins | 1 |
| shops | 14 |
| authors | 13 |
| publishers | 2 |
| categories | 4 |
| books | 16 |
| editions | 16 |
| listings | 18 |

## Nội dung test

12 bài API gồm 8 luồng cơ bản (auth/hash/JWT, login/me/expiry, ownership A/B, admin moderation, search/filter/sort/page, sold không sửa, shop owner/unique và manual validation) cùng 4 bài về schema mới:

- Admin collection riêng, user cùng email không có quyền admin, không public register admin, admin không dùng chức năng seller.
- Offer chung edition không lặp metadata; sửa giá riêng được, sửa metadata ISBN của seller khác bị 409.
- Nhiều edition của một book, sửa một phiên bản không đổi book của phiên bản khác; không ISBN không tự gộp edition; title sort và metadata filter sau khi join.
- Migration giữ hash/ID/sold, bỏ legacy field/session, chạy lại không tạo trùng.

12 bài E2E kiểm tra public catalog/offer/metadata/responsive/gian sách, giỏ không hợp lệ và badge, register/token/me/logout, chặn role giả/user thường vào admin, admin login riêng/restore/phân trang, shop/listing CRUD + admin duyệt từ browser context khác, checkout/PDF/thư viện mô phỏng, trao đổi hai xác nhận, token sai không refresh, API outage/retry, Modal/ErrorBoundary và ISBN prefix/phân trang.

Viewport 1440/1024/768/390/360 px. Chưa kiểm thử Firefox/Safari hoặc production.

## Môi trường kiểm thử độc lập

API suite dùng bookmarket_test_nine, chỉ chấp nhận database tên bookmarket_test hoặc bookmarket_test_*. Suite xóa database test sau cùng; không xóa database chính.

E2E dùng MongoDB bookmarket_test_ui_nine, API 4001, Vite 5180. Seed bản mẫu vào DB này, không tạo tài khoản thử trong bookmarket_foundation. Chạy backend bằng biến MONGO_URI trỏ DB test và PORT=4001; Vite đặt API_PROXY_TARGET=http://127.0.0.1:4001. Lệnh E2E:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5180'
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e
```

Sau kiểm thử dừng riêng server QA và xóa database QA do phiên này tạo. Backend 4000 và website 5173 vẫn phục vụ database chính.

Build cuối: CSS 81.70 kB (gzip 16.48), JS chính 379.55 kB (gzip 116.84), PDF lazy 434.11 kB (gzip 179.78). ZIP source là gói riêng, không chứa build/dependencies/.env/exports/test-results.

Backup trước chuyển đổi nằm trong exports/backups; source cũ giữ trong archives/packages/BookMarket-before-nine-collections.zip. Đã kiểm nội dung backup và bảo toàn dữ liệu sau migration; chưa chạy thử phục hồi backup. Xuất JSON mới dùng backend/scripts/export-database.js, có metadata chín collection.

Ở mốc migration cũ này chưa có đơn hàng server. POST /orders được bổ sung sau, xem mục Giai đoạn 2 bước 1 ở đầu file. Chưa có transaction nhiều document, thanh toán/vận chuyển/upload/bảo vệ PDF hoặc exchange server; không gán test mô phỏng frontend thành kiểm thử giao dịch thật.
