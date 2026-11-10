# Cài đặt và chạy bằng BAT trên Windows

Máy cần cài **Node.js từ 20.19 trở lên** và **MongoDB Community Server**. MongoDB Compass chỉ là giao diện xem dữ liệu, không thay thế MongoDB Server. Cần mạng cho lần cài thư viện đầu tiên. Giải nén ZIP trước khi chạy; hai file BAT nằm cạnh `package.json` ở thư mục BookMarket.

## Cài lần đầu

Bấm đúp **setup.bat**. Script kiểm tra Node/npm, chạy npm run setup, tạo backend/.env với JWT_SECRET ngẫu nhiên nếu chưa có, rồi khởi động replica set local ở cổng 27018 nếu cấu hình dùng cổng này. Không thay service MongoDB cũ cổng 27017.

Nếu database cấu hình trong MONGO_URI còn trống và có thư mục database/schema.json trong gói, script khôi phục dữ liệu cùng index. Nếu không có thư mục database đi kèm, script thêm dữ liệu mẫu vào database trống. Database đã có collection được giữ nguyên; setup không tự nhập lại, seed lại hoặc chạy migration. File .env hiện có được giữ lại, chỉ bổ sung JWT_SECRET nếu thiếu.

Đợi hiện **Cai dat xong**, rồi đóng cửa sổ. Nếu có lỗi, cửa sổ giữ lại thông báo để xem. Nếu lần nhập database bị gián đoạn, script báo lỗi và yêu cầu chọn database mới trong backend/.env trước khi thử lại, tránh dùng nhầm dữ liệu nhập dở.

## Chạy mỗi lần

Bấm đúp **run.bat**. Script khởi động MongoDB local nếu cần, kiểm tra kết nối replica set, rồi khởi động backend và frontend trong hai cửa sổ có log. Server BookMarket đã chạy sẽ được dùng lại. Cổng bị ứng dụng khác chiếm sẽ báo lỗi, không tự dừng ứng dụng đó.

Mở **http://localhost:5173**. Để dừng frontend/backend, bấm Ctrl+C trong từng cửa sổ server. MongoDB tiếp tục chạy nền. Khi máy khởi động lại, bấm run.bat để chạy lại.

PORT backend được đọc từ backend/.env; frontend dùng cổng 5173 và proxy tới cổng backend đó khi khởi động mới. Nếu thay PORT trong lúc frontend đang chạy, hãy dừng frontend và chạy lại run.bat. Với MongoDB ở máy khác, script dùng URI đã cấu hình và không tự mở MongoDB local.

## Lỗi thường gặp

- Không thấy Node/npm: cài Node.js rồi mở lại file BAT.
- Không tìm thấy mongod.exe: cài MongoDB Community Server, chọn cài service MongoDB hoặc thêm thư mục bin chứa mongod.exe vào PATH; chỉ cài Compass là chưa đủ.
- Chưa có thư viện hoặc .env: chạy setup.bat trước.
- Database không hỗ trợ transaction: dùng replica set như cấu hình mặc định. Không đổi URI sang MongoDB standalone cổng 27017.
- Cổng 4000/5173 đang dùng: đóng chương trình đang chiếm cổng rồi chạy lại, hoặc đổi PORT backend và khởi động lại cả hai server.

## File hỗ trợ

setup.bat và run.bat gọi scripts/windows-local.ps1. backend/scripts/setup-local-database.mjs đọc cấu hình, kiểm tra kết nối và chuẩn bị database; không in JWT_SECRET hoặc URI có mật khẩu. Hai file BAT có thể chạy từ terminal với --no-pause để nhận mã thoát 0 khi thành công, 1 khi thất bại.
