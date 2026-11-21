# Chạy bản mã nguồn kèm database

File ZIP chứa frontend, backend, ảnh bìa, tài liệu, dữ liệu MongoDB Extended JSON và metadata index trong thư mục `database/`. Đây là bản dữ liệu xuất từ database đang dùng, gồm cả tài khoản, gian hàng và tin nhắn; không phải dữ liệu seed mới.

## Cài đặt trên máy khác

**Cách nhanh trên Windows:** cài Node.js 20.19+ và MongoDB Community Server, giải nén rồi bấm `setup.bat`. Script tự cài thư viện, tạo `.env`, khởi động replica set và nhập thư mục `database/` vào database đích nếu còn trống. Sau đó bấm `run.bat`, mở http://localhost:5173. Không cần làm thêm các bước nhập thủ công bên dưới nếu setup đã thành công. [Chi tiết](WINDOWS_SETUP.md).

1. Cài Node.js 20.19+ và MongoDB; phần đơn hàng cần replica set.
2. Giải nén ZIP, mở terminal tại thư mục `BookMarket` có `package.json`.
3. Cài các thư viện và tạo cấu hình local:

```powershell
npm run setup
node scripts/setup-env.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-mongo-replica.ps1
```

4. Nhập database vào một database mới, rỗng:

```powershell
node backend/scripts/restore-packaged-database.mjs "mongodb://127.0.0.1:27018/bookmarket_restore?replicaSet=bookmarket-rs"
```

Script khôi phục đủ các collection, ObjectId, ngày tháng và index. Script từ chối ghi vào database đã có collection, không xóa/ghi đè dữ liệu cũ. Nếu tên trên đã tồn tại, chọn tên mới như `bookmarket_restore_2`.

5. Mở `backend/.env`, sửa `MONGO_URI` cho đúng tên vừa khôi phục:

```text
MONGO_URI=mongodb://127.0.0.1:27018/bookmarket_restore?replicaSet=bookmarket-rs
```

Giữ JWT_SECRET ngẫu nhiên vừa được tạo. Bản ZIP không kèm `.env` hoặc JWT_SECRET của máy gốc.

6. Kiểm tra schema/index của dữ liệu vừa khôi phục; script mặc định chỉ xem trước:

```powershell
npm run migrate:hardening
npm run migrate:hardening -- --apply
```

Lệnh apply tự sao lưu trước khi cập nhật; dữ liệu đã đúng thì không đổi bản ghi. Với ZIP rất cũ, làm theo hướng dẫn migration đi kèm đúng phiên bản trước. Xem [HARDENING.md](HARDENING.md).

7. Chạy backend trong terminal thứ nhất:

```powershell
npm run dev:api
```

8. Chạy frontend trong terminal thứ hai, vẫn tại thư mục `BookMarket`:

```powershell
npm run dev
```

Mở http://localhost:5173. Kiểm tra API tại http://localhost:4000/health.

Không cần chạy seed để dùng database đi kèm. Tài khoản và mật khẩu đã có được giữ nguyên qua passwordHash; cần đăng nhập lại trên máy mới. Tài khoản demo mặc định: `reader@bookmarket.local` hoặc `admin@bookmarket.local`, mật khẩu `BookMarket123!` nếu trước đó chưa đổi; admin đăng nhập ở `/quan-tri`. Shop cũ thiếu liên hệ/địa chỉ cần hoàn tất hồ sơ trước khi đăng new/digital.

## Dữ liệu trong gói

- `database/data/*.json`: dữ liệu từng collection theo Extended JSON.
- `database/schema.json`: số bản ghi, cấu trúc field và index.
- `database/CAU_TRUC_DATABASE.md`: báo cáo cấu trúc dữ liệu.
- `database/DANH_SACH_FIELD.csv`: danh sách field để mở bằng Excel.

Giỏ hàng lưu trong trình duyệt. Hồ sơ, tối đa 3 địa chỉ nhận hàng, yêu thích và thông báo đơn nằm trong MongoDB theo tài khoản nên được khôi phục cùng database. Quyền ebook/thư viện nằm trong `ebookaccesses`.
