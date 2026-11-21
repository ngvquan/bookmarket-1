# Hướng dẫn đọc code BookMarket

Tài liệu này dành cho người mới biết React. Hãy chạy dự án trước, bấm một chức năng trên giao diện rồi mở các file theo luồng bên dưới.

## Sơ đồ thư mục

```text
frontend/src/
├── pages/        Các trang gắn với URL
├── components/   Các phần giao diện dùng lại
├── hooks/        State và logic React
├── services/     Gọi API backend
├── utils/        Hàm JavaScript nhỏ, không phụ thuộc giao diện
├── data/         Dữ liệu cấu hình giao diện
└── styles/       CSS

backend/src/
├── routes/       Nhận request và trả response
├── models/       Schema MongoDB/Mongoose
├── middleware/   Xác thực và kiểm tra quyền
├── utils/        Validate và nghiệp vụ dùng lại
└── app.js         Ghép middleware với các route
```

`frontend/src/main.jsx` là điểm bắt đầu của giao diện. `frontend/src/App.jsx` ghép route, header, footer và modal. `backend/src/server.js` kết nối MongoDB rồi chạy Express; `backend/src/app.js` gắn các API.

## Luồng 1: đăng nhập

1. `frontend/src/components/Auth.jsx` đọc email và mật khẩu từ form.
2. `frontend/src/App.jsx` gọi `authenticate` do hook thị trường cung cấp.
3. `frontend/src/hooks/useRemoteMarket.js` gọi hàm trong `frontend/src/services/api.js`.
4. `frontend/src/services/http.js` gửi request, đọc lỗi và lưu JWT vào `localStorage`.
5. `backend/src/routes/auth.js` kiểm tra dữ liệu, so mật khẩu bằng bcrypt và ký JWT.
6. Những request sau đi qua `backend/src/middleware/auth.js`; middleware xác minh JWT rồi gắn tài khoản vào `req.user`.

JWT chứng minh request đang thuộc tài khoản nào. JWT không mã hóa mật khẩu; bcrypt mới là phần băm mật khẩu trước khi lưu MongoDB.

## Luồng 2: xem sách và thêm vào giỏ

1. Router trong `frontend/src/App.jsx` mở `HomePage.jsx` hoặc `CatalogPage.jsx`.
2. Các trang dùng `BookCard` để hiển thị sách.
3. Dữ liệu sách được `useRemoteMarket.js` tải qua `listingService` trong `services/api.js`.
4. Backend nhận request tại `backend/src/routes/listings.js`, đọc `Listing` và dữ liệu phiên bản sách rồi trả JSON.
5. Khi bấm thêm giỏ, `addToCart` trong `frontend/src/hooks/useBookMarket.js` tải lại tin mới nhất, kiểm tra còn bán rồi cập nhật hook `useStored.js`.
6. Giỏ được lưu trong `localStorage`; giá và tồn kho vẫn được backend kiểm tra lại khi đặt hàng.

## Luồng 3: đặt hàng

1. Modal giỏ và checkout ở `frontend/src/App.jsx` gọi `placeOrder` do `useBookMarket.js` cung cấp.
2. Logic thật nằm trong `frontend/src/hooks/useCheckout.js`: hook tải lại giá, tồn kho, phí giao và tạo `idempotencyKey`. Key này ngăn việc bấm hoặc gửi lại tạo hai đơn.
3. `orderService` trong `frontend/src/services/api.js` gửi `POST /orders`.
4. `backend/src/routes/orders.js` validate request rồi gọi phần nghiệp vụ tạo đơn.
5. Backend lấy giá từ MongoDB, chia đơn theo người bán, trừ kho và lưu đơn trong một transaction.
6. Nếu kết nối mất giữa chừng, payload tạm trong `sessionStorage` cho phép kiểm tra lại cùng key thay vì tạo đơn mới.

Ebook đi qua `POST /digital-orders`, VietQR và thư viện riêng. Không gộp luồng ebook với đơn COD nếu đang học luồng cơ bản.

## Thứ tự nên đọc

1. `frontend/src/main.jsx`
2. `frontend/src/App.jsx`
3. `frontend/src/pages/HomePage.jsx` và `CatalogPage.jsx`
4. `frontend/src/hooks/useBookMarket.js` để xem cách các phần của chợ sách được ghép lại
5. Các hook theo chức năng: `useBookActions.js`, `useFavorites.js`, `useShippingServices.js`, `useListingEditor.js`, `useSavedListings.js`, `useCheckout.js`
6. `frontend/src/services/http.js`, sau đó `services/api.js`
7. `backend/src/app.js` và `middleware/auth.js`
8. `backend/src/routes/auth.js`, `listings.js`, `orders.js`
9. Cuối cùng mới đọc models, transaction, ebook, webhook và chat.

Không nên xóa các cờ khóa request, `idempotencyKey`, transaction hoặc kiểm tra quyền chỉ vì chúng trông dài. Chúng bảo vệ dữ liệu khi người dùng bấm hai lần, mạng chập chờn hoặc gửi request trực tiếp ngoài giao diện.
