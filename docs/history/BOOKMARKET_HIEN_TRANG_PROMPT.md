# Prompt bàn giao hiện trạng BookMarket

> Tài liệu lịch sử: nội dung bên dưới mô tả bản **trước Giai đoạn 0–1**, được giữ để đối chiếu, không phải yêu cầu thực thi hay hiện trạng mới. Xem [README hiện tại](../../README.md), [API](../API.md) và [đơn hàng/vận chuyển](../ORDERS_SHIPPING.md). Backend/auth/catalog, checkout đơn giấy và vận chuyển demo đã được bổ sung; chỉ ebook/trao đổi còn mô phỏng.

Tôi đang phát triển đồ án sinh viên tên **BookMarket**, một sàn thương mại điện tử sách. Tôi gửi kèm mã nguồn hiện tại. Hãy dùng nội dung dưới đây để hiểu đúng dự án trước khi tư vấn hoặc chỉnh sửa. Thông tin này mô tả trạng thái mã nguồn đã có; các phần định hướng tương lai được ghi riêng, không được coi là đã triển khai.

## 1. Mục tiêu và phạm vi hiện tại

- BookMarket hướng tới bốn mô hình: sách mới, sách cũ, trao đổi sách và sách điện tử.
- Hiện tại đã có **website frontend demo hoạt động độc lập**, sử dụng dữ liệu mẫu và localStorage.
- Concept nghiệp vụ và cách tổ chức tìm kiếm/tin đăng tham khảo AbeBooks: nhiều người bán độc lập, thông tin từng bản sách rõ ràng, tìm theo tác giả/tên/ISBN, so sánh các tin cùng phiên bản.
- Đây là thương hiệu BookMarket riêng, không phải website của AbeBooks, không kết nối API hoặc đồng bộ dữ liệu với AbeBooks/BIBLIO.
- Giao diện tiếng Việt, màu xanh lá, trắng và kem; tiêu đề serif; bố cục gọn, dễ sử dụng nhưng vẫn đầy đủ nội dung, không tối giản đến mức sơ sài.
- Responsive cho desktop, máy tính bảng và điện thoại.
- Bản hiện tại **chưa có backend, cơ sở dữ liệu hoặc phân quyền bảo mật thực sự**.

## 2. Mã nguồn nào đang được dùng

- Workspace trên máy: `Z:\book-maind`.
- Mã website đang phát triển nằm tại `frontend/`.
- Thư mục gốc có `package.json` để chạy các script cho frontend và `README.md` hướng dẫn.
- Trong workspace còn có các ZIP/thư mục cũ của một ứng dụng Expo/React Native. Đó là mã cũ, được giữ nguyên; không phải ứng dụng web React/Vite hiện đang chạy.
- Bản đóng gói gần nhất: `BookMarket-source-light.zip`, dung lượng 85.130 byte, khoảng 83,1 KiB; chứa 26 file mã nguồn/cấu hình/tài liệu/kiểm thử.
- ZIP có thư mục gốc `BookMarket/`, bao gồm mã frontend hiện tại và script chạy ở root. Không chứa node_modules, dist, ảnh kiểm thử, dữ liệu trình duyệt hoặc các ZIP cũ.
- Khi đọc source, ưu tiên `frontend/` và README; không lấy ZIP Expo cũ làm nền cho các thay đổi của website này.

## 3. Công nghệ thực tế đang có

- React, JavaScript và JSX; package khai báo React/React DOM `^19.1.0`.
- Vite `^6.3.5`, plugin React `^4.5.0`.
- React Router DOM `^7.6.0`, dùng BrowserRouter.
- CSS thuần, chia các file giao diện chung, bìa sách và concept marketplace.
- `lucide-react` cho icon.
- `pdf-lib` để tạo PDF demo ngay trên trình duyệt; module PDF được tải khi cần đọc.
- `@playwright/test` cho kiểm thử trình duyệt.
- React state và hook `useStored` tự viết để lưu localStorage.
- Font tải từ Google Fonts, có font dự phòng.
- Chưa sử dụng Axios, Express, MongoDB, Mongoose, JWT, bcrypt hoặc multer trong ứng dụng web hiện tại.
- Không dùng TypeScript, Redux, microservices, Redis, Docker hoặc message queue.

## 4. Cấu trúc source

```text
BookMarket/
  package.json                 # Script setup/dev/build/test chuyển vào frontend
  README.md                    # Hướng dẫn chạy, demo, giới hạn và kiểm thử
  frontend/
    package.json
    package-lock.json
    index.html
    vite.config.js
    playwright.config.js
    .gitignore
    public/
      favicon.svg
    src/
      main.jsx                 # Điểm vào React, BrowserRouter, import CSS
      App.jsx                  # State chính, routes, auth demo, giỏ/checkout,
                               # chi tiết, seller/admin, trao đổi, trình đọc PDF
      Home.jsx                 # Trang chủ theo concept nhà bán độc lập
      Catalog.jsx              # Danh sách/lưới và bộ lọc trong URL
      SearchPanel.jsx          # Tìm tác giả/tên/ISBN, tìm kiếm nâng cao
      Sellers.jsx              # Danh bạ người bán và gian sách công khai
      CartGroups.jsx           # Giỏ hàng chia theo người bán
      components.jsx           # Cover, BookCard, BookFacts, OfferComparison,
                               # Modal, Empty, Status, Success, SectionHeading
      data.js                  # Dữ liệu ban đầu, danh mục, tiền tệ, tìm không dấu
      marketplace.js           # Metadata, bổ sung dữ liệu cũ, lọc sách,
                               # tìm tin cùng ISBN, nhóm giỏ và phí giao
      pdf.js                   # Tạo ebook demo nguyên bản bằng pdf-lib
      styles.css               # Giao diện và responsive chung
      covers.css               # Minh họa bìa sách bằng CSS
      marketplace.css          # Giao diện tìm kiếm/tin bán/gian sách
    tests/
      demo.spec.js
      storefront.spec.js
      marketplace.spec.js
```

Một số component và nghiệp vụ vẫn nằm chung trong App.jsx. Có thể tách dần khi cần, nhưng phải giữ các luồng đang hoạt động và tránh viết lại toàn bộ dự án.

## 5. Các màn hình và đường dẫn hiện có

- `/`: trang chủ.
- `/sach-moi`: sách mới.
- `/sach-cu`: sách cũ.
- `/trao-doi`: sách trao đổi.
- `/digital`: cửa hàng ebook.
- `/tim-kiem`: tìm kiếm trên tất cả loại sách.
- `/tim-kiem-nang-cao`: form tìm kiếm nâng cao.
- `/nha-ban`: danh bạ nhà bán sách.
- `/nha-ban/:name`: gian sách công khai, hiện nhận diện người bán bằng tên.
- `/yeu-thich`: sách yêu thích.
- `/thu-vien`: ebook đã mua trong phiên dữ liệu demo.
- `/don-hang`: danh sách đơn đã tạo trong trình duyệt.
- `/yeu-cau`: yêu cầu trao đổi.
- `/gian-hang`: quản lý shop/tin đăng/đơn của người bán demo.
- `/quan-tri`: trang quản trị demo.
- Đường dẫn không tồn tại có màn hình 404.

Đăng nhập/đăng ký, chi tiết sách, giỏ hàng, checkout, đăng/sửa sách và đọc PDF đang là **modal**, không phải tất cả đều có route riêng. Chưa có trang chi tiết sản phẩm với URL độc lập.

## 6. Chức năng frontend đã hoạt động

### 6.1. Trang chủ và tìm kiếm

- Trang chủ có form riêng cho tác giả, tên sách, ISBN/từ khóa; các khu sách mới, sách cũ, nhà bán nổi bật, trao đổi và ebook.
- Có bộ lọc thể loại cho sách gợi ý.
- Ô tìm kiếm trên header tìm trên cả bốn loại sách.
- Tìm tên/tác giả/người bán không phân biệt dấu và hoa/thường.
- Tìm kiếm nâng cao kết hợp tác giả, tên, từ khóa/ISBN, nhà xuất bản, loại bìa, tình trạng và khoảng giá.
- Danh mục có lọc thể loại, tình trạng, loại bìa, người bán, giá tối đa và sắp xếp giá/tên.
- Điều kiện tìm kiếm được lưu trong query string; có thể bỏ từng điều kiện hoặc xóa bộ lọc.
- Kết quả mặc định là danh sách từng tin bán; chuyển được sang dạng lưới.

### 6.2. Tin bán, ISBN và nhiều seller

- Mỗi tin có ID riêng, người bán riêng, giá riêng, số lượng/tình trạng riêng.
- Cùng tên sách có thể xuất hiện trong nhiều tin bán của nhiều seller.
- ISBN dùng để nhận diện phiên bản sách trong demo. Sách cùng tên nhưng khác ISBN không tự động bị gộp.
- Bảng so sánh các bản cùng phiên bản hiện áp dụng cho sách giấy loại `new`/`used`, cùng ISBN sau khi chuẩn hóa, còn khả dụng và khác ID tin.
- Bảng so sánh cho phép chuyển bản đang xem hoặc thêm bản của seller được chọn vào giỏ.
- Chưa có collection/bảng riêng cho tác phẩm, phiên bản và offer. Metadata vẫn nằm trên từng object tin sách; việc tìm các offer cùng ISBN là thao tác frontend.
- ISBN là tùy chọn khi đăng sách. Form kiểm tra định dạng cơ bản, chưa tra cứu dữ liệu xuất bản hay xác minh ISBN với dịch vụ bên ngoài.

Ví dụ mẫu có sẵn: *Nhà giả kim* với cùng ISBN minh họa:

- Nhã Nam: 63.200đ, sách mới, ID `b2`.
- Tiệm sách Mùa Thu: 74.000đ, sách mới, ID `offer-b2-muathu`.
- Gác sách An Nhiên: 42.000đ, sách cũ, ID `offer-b2-old`.

Ba tin được thêm giỏ và quản lý số lượng độc lập. ISBN, nhà xuất bản và năm của dữ liệu mẫu chỉ phục vụ trình diễn, không khẳng định thông tin xuất bản thực tế.

### 6.3. Chi tiết, yêu thích và gian sách công khai

- Chi tiết hiển thị bìa, tên, tác giả, mô tả, nhà xuất bản, năm, loại bìa, ISBN, giá, tình trạng và người bán.
- Bìa hiện là minh họa CSS, không phải ảnh bìa xuất bản chính thức hay ảnh upload của seller.
- Có lưu/bỏ yêu thích và giữ lại sau reload.
- Có danh bạ nhà bán với ô tìm theo tên.
- Có gian sách công khai của từng người bán, danh sách sách và lọc theo loại sách.

### 6.4. Giỏ hàng, phí giao và đơn hàng

- Thêm/xóa sản phẩm; tăng giảm số lượng sách mới theo tồn kho demo.
- Sách cũ và ebook giới hạn một bản/tin trong giỏ.
- Sách trao đổi không tham gia luồng mua hàng hoặc giỏ hàng.
- Giỏ nhóm theo người bán. Hiện khóa nhóm là tên shop/người bán, chưa phải shopId/sellerId từ database.
- Phí giao mẫu: 25.000đ cho mỗi người bán có sách giấy. Nhiều sách từ cùng người bán chỉ tính một phí; hai người bán có sách giấy tính hai phí. Ebook không tính giao hàng.
- Đơn có sách giấy yêu cầu tên, số điện thoại và địa chỉ. Đơn chỉ ebook không yêu cầu giao hàng.
- Cho phép giỏ hỗn hợp sách giấy + ebook và nhiều người bán.
- Sách giấy dùng COD mô phỏng; ebook dùng nút thanh toán giả lập, không thu tiền thật.
- Khi tạo đơn: lưu snapshot thông tin từng item, số lượng, giá và trạng thái; lưu tổng tiền và `shippingGroups`.
- Item sách giấy bắt đầu `pending`; seller demo có thể chuyển `confirmed`, rồi `completed`.
- Item ebook hoàn tất ngay và được thêm vào thư viện.
- Sách mới giảm stock, sách cũ chuyển cờ sold và bị gỡ khỏi danh mục khả dụng.
- Có chặn mua lại ebook đã có trong thư viện demo và kiểm tra một số thay đổi tồn kho ở thời điểm tạo đơn.
- Chưa có giao dịch database, khóa đồng thời hoặc chống mua trùng sách cũ giữa nhiều người/trình duyệt. Chưa có quy trình hoàn tiền/hủy đơn thực tế.
- Checkout hiện chưa bắt buộc đăng nhập. Không được mô tả các đơn/thư viện này là đã tách biệt an toàn theo tài khoản.

### 6.5. Trao đổi sách

- Người dùng đăng nhập demo để đăng sách/gửi yêu cầu.
- Khi đề nghị, chọn một cuốn của mình đã được duyệt, chưa trao đổi và chưa bị sử dụng trong yêu cầu đang xử lý.
- Gửi kèm lời nhắn; tránh lặp đề nghị đang xử lý cho cùng sách.
- Có `pending`, `accepted`, `rejected`, `cancelled`, `completed`.
- Có thao tác chấp nhận, từ chối, hủy đề nghị.
- Hoàn thành khi cả hai cờ xác nhận `mine` và `theirs` đều được bật; sau đó hai sách chuyển exchanged.
- Hiện có nút **thử vai người nhận/đối tác xác nhận** để một người trình diễn toàn bộ quy trình. Đây không phải giao dịch giữa hai phiên đăng nhập độc lập đã được xác thực.
- Không tích hợp thanh toán, vận chuyển hoặc chat thời gian thực cho trao đổi.

### 6.6. Ebook và thư viện

- Mua ebook bằng thanh toán giả lập; thư viện lưu danh sách ID ebook đã mua.
- Có mở trình đọc và tải PDF.
- PDF được `pdf-lib` tạo trên trình duyệt từ nội dung mẫu nguyên bản bằng tiếng Anh; tạo Blob URL và mở bằng iframe.
- PDF mẫu không phải toàn văn của những sách thương mại đang dùng làm ví dụ trong danh mục.
- Chưa có upload PDF riêng cho từng ebook; ebook mới đăng chưa gắn với file thực do seller tải lên.
- Chưa có endpoint riêng tư, JWT, kiểm tra quyền sở hữu từ server hoặc cơ chế bảo vệ ebook thật.

### 6.7. Quản lý người bán

- Có đăng nhập demo, tạo/sửa shop với tên và mô tả.
- Có đăng/sửa/xóa tin sách mới, cũ, trao đổi, ebook trong phạm vi demo.
- Sách mới và ebook yêu cầu có shop trong UI; sách cũ và trao đổi không yêu cầu shop.
- Form có ISBN tùy chọn, nhà xuất bản, năm, loại bìa, tên, tác giả, thể loại, mô tả và các trường theo loại sách.
- Tin mới/sửa chuyển chờ duyệt. Sau duyệt mới xuất hiện trong danh mục công khai.
- Có đánh dấu sách cũ đã bán.
- Có màn hình sản phẩm, đơn chứa sản phẩm của mình, thống kê cơ bản và thông tin gian hàng.
- Có hạn chế sửa tin đang gắn với trao đổi đang xử lý; hạn chế xóa tin đã gắn với đơn/yêu cầu để giữ tham chiếu.
- Chủ sở hữu hiện được mô phỏng bằng `owner: "me"`, không phải userId thật.

### 6.8. Quản trị demo

- Có tổng số tin, số chờ duyệt và số đơn.
- Duyệt/từ chối/ẩn tin, xem toàn bộ tin và đơn demo.
- Chưa có quản lý người dùng, khóa/mở tài khoản, quản lý khóa shop hoặc phân quyền admin thực sự.
- Trang `/quan-tri` đang mở sẵn để demo, chưa được bảo vệ bằng đăng nhập admin.

## 7. Tác nhân và phân quyền: cần hiểu chính xác

Về phân tích nghiệp vụ/Use Case, có thể mô tả **4 tác nhân**:

1. Khách vãng lai.
2. Người dùng/người mua.
3. Người bán — seller.
4. Quản trị viên — admin.

Định hướng khi làm backend: chỉ có hai role `user` và `admin`; seller là user có shop, không cần tạo role seller riêng. Một tài khoản có thể vừa mua, vừa đăng bán sách cũ, vừa trao đổi và sở hữu shop.

Tuy nhiên, **đó chưa phải phân quyền đã được triển khai đầy đủ trong code**:

- Form đăng nhập/đăng ký chỉ tạo profile local; nhận email hợp lệ và mật khẩu tối thiểu 6 ký tự, không đối chiếu tài khoản server, không lưu mật khẩu.
- Profile demo được tạo với `role: "user"`; chưa có tài khoản admin xác thực.
- Shop là object local, chưa liên kết bằng `user.shopId` thực.
- Một số thao tác được kiểm tra có profile/shop trong UI, nhưng không có middleware/server chống truy cập trái phép.
- Dữ liệu sách, đơn, thư viện, shop và trao đổi dùng chung bộ localStorage của trình duyệt. Đổi email đăng nhập demo không tạo vùng dữ liệu riêng cho từng người.
- Không có bộ tài khoản mẫu admin/seller được xác thực thật.

Trước đây đã thảo luận việc patch phân quyền nhưng chưa triển khai. Yêu cầu “patch” sau đó được làm rõ là đóng gói ZIP nhẹ, không phải bổ sung backend/phân quyền. Không được coi phần phân quyền thật đã hoàn thành.

## 8. Trạng thái và lưu dữ liệu thực tế

- Dùng `useStored` trong App.jsx với tiền tố `bookmarket-v1-`.
- Các key chính: `books`, `favorites`, `cart`, `orders`, `library`, `requests`, `profile`, `shop`.
- `initialBooks` trong data.js là dữ liệu nền; `upgradeCatalog` trong marketplace.js bổ sung metadata và hai offer Nhà giả kim, tránh thêm lặp theo ID.
- Nâng cấp dữ liệu cũ giữ các trạng thái và dữ liệu đã lưu như sold, thư viện và yêu thích.
- `books` hiện chứa cả bốn type `new`, `used`, `exchange`, `digital` trong cùng mảng frontend.
- Tin sách dùng các cờ như `pending`, `rejected`, `sold`, `exchanged`; chưa phải model Mongoose với enum status đầy đủ.
- Tình trạng sách cũ hiện là chuỗi tiếng Việt như “Như mới”, “Còn tốt”, “Đã cũ”; chưa dùng enum backend `like_new/good/worn`.
- Yêu cầu trao đổi nằm trong mảng requests; thư viện là mảng ID; đơn là object chứa snapshot các item.
- Không có các collection users/shops/products/orders/userEbooks/exchangeBooks/exchangeRequests trong MongoDB.
- Xóa localStorage là mất dữ liệu demo cục bộ. Không có đồng bộ giữa thiết bị hoặc server.

## 9. Những phần chưa có hoặc chưa đủ cho production

- Node.js/Express backend và MongoDB/Mongoose.
- API/axios service layer, JWT, bcrypt, session/token và tài khoản đa người dùng thật.
- Middleware auth/admin/seller/ownership.
- Kiểm tra seller chỉ truy cập dữ liệu của mình từ server.
- Upload ảnh, PDF, xác thực loại file, giới hạn dung lượng và lưu trữ riêng tư.
- Bảo vệ endpoint PDF theo quyền đã mua.
- Chống đặt trùng sách cũ, cập nhật tồn kho nguyên tử, chống gửi nhiều yêu cầu xung đột.
- Thanh toán thật, đối soát/hoa hồng, xử lý hoàn tiền.
- Tích hợp đơn vị giao hàng hoặc tracking thật.
- Đánh giá sản phẩm/người bán do khách thực sự gửi; số đánh giá hiện tại là mẫu.
- Quản lý tài khoản/khóa shop đầy đủ, nhật ký quản trị và gửi thông báo/email thật.
- Phân trang/lazy loading cho catalog lớn, tìm kiếm server-side, SEO chi tiết sản phẩm và triển khai production đã xác minh.
- Database schema/migration/seed server, biến môi trường backend và hướng dẫn vận hành backend.

## 10. Định hướng backend ban đầu, chưa triển khai

Nếu sau này tôi yêu cầu làm full-stack, ưu tiên Express + MongoDB/Mongoose, JWT + bcrypt, multer, Axios; JavaScript, cấu trúc dễ đọc, phù hợp đồ án sinh viên.

Thiết kế dữ liệu tham khảo ban đầu gồm users, shops, products, exchangeBooks, orders, userEbooks và exchangeRequests. Có thể đề xuất điều chỉnh để phân biệt tác phẩm/phiên bản/tin bán nếu cần, nhưng phải giải thích lợi ích và chi phí thay đổi. Không được khẳng định schema đề xuất này đang tồn tại.

Những yêu cầu nghiệp vụ cần giữ:

- Seller là user có shop; role chính vẫn user/admin.
- Một cuốn cùng phiên bản có thể được nhiều seller đăng với giá và tồn kho riêng.
- Mỗi item đơn phải biết seller/shop, giá snapshot, số lượng và trạng thái riêng.
- Sách cũ mỗi tin một cuốn, cần chống mua trùng ở server.
- Trao đổi không vào giỏ, không có giá; hai bên xác nhận mới hoàn thành.
- Ebook mua bằng thanh toán mô phỏng, không mua trùng, vào thư viện sau giao dịch thành công.
- PDF thật phải ở vùng private; endpoint kiểm tra JWT và quyền mua/sở hữu/admin trước khi trả file. Frontend lấy blob kèm token rồi mở trình đọc.
- Chưa cần cổng thanh toán thật, microservices, chat realtime, AI gợi ý, đấu giá, audiobook hoặc DRM.

Đây là định hướng cho giai đoạn tiếp theo nếu được yêu cầu, không phải lời xác nhận backend đã có hoặc yêu cầu tự động viết lại cả hệ thống ngay.

## 11. Chạy và build

Cần Node.js phù hợp với Vite; README hiện ghi Node.js 20.19+ hoặc 22.12+.

Ở thư mục gốc sau khi giải nén:

```powershell
npm run setup
npm run dev
```

Hoặc trong frontend:

```powershell
cd frontend
npm install
npm run dev
```

Mặc định mở `http://localhost:5173`; nếu cổng bận, dùng URL Vite in ra terminal.

```powershell
npm run build
```

Kết quả build nằm tại `frontend/dist`. Khi host static cần fallback về index.html cho BrowserRouter. Chưa có URL production được xác minh trong bản bàn giao này.

## 12. Kiểm thử đã có

Lần kiểm tra gần nhất trước khi đóng ZIP: **build thành công và 10/10 bài Playwright đạt**. Có kiểm tra giao diện 360–1440px; rà 13 route tại các độ rộng 1440/1024/768/390/360px không phát hiện lỗi JavaScript hoặc tràn ngang trong lần rà đó.

10 bài kiểm thử trong source bao gồm:

1. Trang chủ, điều hướng và responsive.
2. Tìm/lọc/sắp xếp/yêu thích sau reload.
3. Giỏ hỗn hợp, trạng thái từng item, thư viện và PDF Blob.
4. Trao đổi chỉ hoàn tất khi cả hai cùng xác nhận.
5. Tạo shop, đăng/duyệt/sửa/xóa tin.
6. Lọc gợi ý trang chủ và tìm toàn bộ loại sách qua header.
7. Tìm tác giả/tên và kết hợp bộ lọc.
8. Ba offer cùng phiên bản, ID/giá/phí giao/đơn độc lập theo seller.
9. Tìm ISBN, gian sách công khai và dạng lưới trên mobile.
10. Nâng cấp dữ liệu cũ, giữ thư viện/yêu thích/sold, không thêm offer lặp.

Chạy dev server trước, sau đó chạy ở root:

```powershell
npm run test:e2e
```

Cấu hình mặc định dùng Google Chrome. Có thể đổi channel sang msedge hoặc cài Chromium cho CI. Đổi URL test bằng biến `PLAYWRIGHT_BASE_URL`, ví dụ:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:5174'
npm run test:e2e
```

Các test chứng minh luồng frontend demo trong phạm vi đã kiểm tra; không chứng minh có bảo mật backend, xử lý đa người dùng hay thanh toán thực.

## 13. Yêu cầu khi tiếp nhận và phát triển tiếp

- Đọc source và README trước, đối chiếu với mô tả này; nếu khác, chỉ rõ bằng vị trí code.
- Luôn phân biệt: chức năng frontend đang chạy, mô phỏng trong trình duyệt, kiểm soát UI và bảo mật server chưa có.
- Giữ các luồng New/Used/Exchange/Digital, ISBN và nhiều seller đang chạy.
- Giữ phong cách sàn sách độc lập, gọn, rõ tìm kiếm/phiên bản/người bán; không tự quay về giao diện trang trí quá nhiều.
- Tận dụng source hiện tại, sửa đúng phạm vi tôi yêu cầu, không tự đổi framework hoặc viết lại toàn bộ.
- Không yêu cầu tôi gửi lại những thông tin đã có trong source.
- Nếu triển khai backend, ưu tiên làm từng phần có thể kiểm chứng; mô tả rõ API/data model và thay đổi frontend liên quan.
- Khi sửa, ghi rõ file thay đổi, cách chạy và cách kiểm tra; chỉ khẳng định các test/check thực sự đã chạy.
- Khi đóng gói code, giữ source, package-lock, cấu hình, test và tài liệu; bỏ node_modules, dist, test-results, thông tin bí mật và ZIP cũ.

**Nhiệm vụ của bạn khi nhận prompt và source này:** hiểu đúng hiện trạng, kiểm tra các file liên quan đến yêu cầu tiếp theo của tôi, rồi thực hiện trên nền BookMarket hiện tại. Không diễn giải trạng thái “demo chạy được” thành “full-stack đã hoàn thiện”.
