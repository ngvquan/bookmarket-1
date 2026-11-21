# Chạy BookMarket dưới dạng app Android

## 1. Chuẩn bị

- Cài Node.js 20.19 trở lên để build frontend.
- Cài Android Studio cùng Android SDK để build và chạy app Android.
- Cài JDK 21 (hoặc JDK mà phiên bản Android Studio hiện tại đề nghị).
- Backend phải được deploy bằng HTTPS và điện thoại phải truy cập được backend đó.

Mở `.env.mobile`, thay `https://your-backend.example.com` bằng URL backend thật. Không thêm dấu `/` ở cuối URL.

Backend cần cho phép hai origin sau trong cấu hình CORS:

```text
https://localhost
capacitor://localhost
```

## 2. Build và đồng bộ Android

Chạy các lệnh sau trong thư mục `frontend`:

```powershell
npm install
```

Lệnh này cài dependency của React, Vite và Capacitor theo `package-lock.json`.

```powershell
npm run build:mobile
```

Lệnh này đọc `.env.mobile` và build giao diện production vào thư mục `dist`.

```powershell
npm run cap:sync
```

Lệnh này chép bản build trong `dist` và cấu hình Capacitor sang project Android.

```powershell
npm run cap:android
```

Lệnh này mở project Android bằng Android Studio để chạy trên máy ảo hoặc điện thoại.

Mỗi khi sửa giao diện web, chạy lại `npm run build:mobile` rồi `npm run cap:sync` trước khi chạy Android.

## 3. Chạy trên điện thoại thật

1. Trên điện thoại Android, bật Tùy chọn nhà phát triển và Gỡ lỗi USB.
2. Cắm cáp USB, chấp nhận hộp thoại cho phép gỡ lỗi trên điện thoại.
3. Mở Android Studio bằng `npm run cap:android`.
4. Chọn điện thoại trong danh sách thiết bị rồi nhấn nút Run.

## 4. Xuất APK để gửi bạn bè

Trong thư mục `frontend/android`, chạy:

Nếu `JAVA_HOME` của Windows đang sai nhưng Android Studio được cài tại `D:\Android`, đặt JDK cho terminal hiện tại:

```powershell
$env:JAVA_HOME='C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot'
$env:GRADLE_OPTS='-Djavax.net.ssl.trustStoreType=Windows-ROOT'
```

Lệnh này chỉ chọn JDK đi kèm Android Studio cho cửa sổ PowerShell hiện tại, không sửa cấu hình toàn hệ thống.

```powershell
.\gradlew.bat assembleDebug
```

Lệnh này tạo APK debug có thể cài trực tiếp mà không cần Google Play.

File APK nằm tại:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Người nhận cần cho phép cài ứng dụng không rõ nguồn gốc trên Android. APK debug chỉ phù hợp để chạy thử và gửi bạn bè, không dùng để phát hành chính thức.

Nếu Gradle báo `PKIX path building failed`, biến `GRADLE_OPTS` phía trên cho Gradle dùng kho chứng chỉ tin cậy của Windows mà không tắt kiểm tra SSL.

## 5. Các điểm web có thể lỗi trong WebView (chưa sửa)

- Link `<a download>` và tải PDF có thể mở trong WebView nhưng không lưu đúng thư mục Download; khi cần nên dùng plugin Filesystem/Browser của Capacitor.
- Chọn hoặc upload ảnh/PDF phụ thuộc quyền truy cập file của Android; cần test trên nhiều phiên bản Android trước khi thêm plugin Camera/File Picker.
- `blob:` URL dùng để đọc hoặc tải ebook có thể bị Android thu hồi khi app chuyển nền; có thể cần lưu file tạm bằng Filesystem.
- Link mở ứng dụng ngân hàng từ VietQR có thể bị giữ trong WebView; có thể cần App Launcher hoặc Browser để mở deep link bên ngoài.
- Nút Back vật lý có thể thoát app thay vì đóng modal/quay route trong một số màn hình; có thể cần lắng nghe sự kiện backButton.
- Font Google cần Internet ở lần mở đầu; nếu muốn app ổn định khi offline nên đóng gói font trong project.
- JWT hiện lưu bằng `localStorage`; chạy thử được nhưng app production nên chuyển sang Secure Storage.

Các mục trên mới là cảnh báo và đề xuất, chưa thay đổi logic hiện tại.

## 6. Checklist kiểm tra

### Chrome trên máy tính

- [ ] Chạy `npm run dev`, mở Chrome và nhấn F12.
- [ ] Bật Device Toolbar, chọn màn hình Android có chiều rộng dưới 760px.
- [ ] Kiểm tra không có cuộn ngang.
- [ ] Kiểm tra thanh tab dưới có đủ 5 mục và không che nội dung.
- [ ] Kiểm tra huy hiệu giỏ hàng và tin nhắn.
- [ ] Kiểm tra input không tự zoom khi nhập.
- [ ] Kiểm tra header, modal, giỏ hàng, đăng nhập và checkout.

### Điện thoại Android thật

- [ ] Kiểm tra nội dung không bị tai thỏ hoặc thanh điều hướng che.
- [ ] Kiểm tra Trang chủ, Danh mục, Giỏ hàng, Tin nhắn và Tài khoản.
- [ ] Đăng nhập rồi đóng/mở lại app để kiểm tra phiên đăng nhập.
- [ ] Upload thử ảnh và PDF.
- [ ] Đọc thử và tải thử ebook PDF.
- [ ] Mở thử VietQR hoặc ứng dụng ngân hàng.
- [ ] Thử nút Back vật lý trên route và khi modal đang mở.
- [ ] Tắt/bật mạng để kiểm tra thông báo lỗi API.
- [ ] Cài file `app-debug.apk` trên một điện thoại khác.
