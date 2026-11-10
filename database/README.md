# Xuất/nhập database BookMarket

Tại thư mục gốc, chạy `npm run export:db` (hoặc tại backend chạy `node scripts/export-database.js`). Script chỉ đọc database cấu hình trong backend/.env, xuất sang exports/BookMarket-database-current. Thư mục bản xuất chín collection trước đó được giữ nguyên:

- CAU_TRUC_DATABASE.md: số bản ghi/field, kiểu dữ liệu và sơ đồ.
- DANH_SACH_FIELD.csv: mở bằng Excel, chỉ chứa cấu trúc.
- schema.json: metadata và index.
- data/*.json: dữ liệu Extended JSON của từng collection; giữ ObjectId/Date.

Sau khi chạy backend mới, có 19 collection: users, admins, shops, authors, publishers, categories, books, editions, listings, orders, suborders, conversations, messages, reviews, digitalorders, ebookaccesses, banktransactions, follows, notifications. Script xuất các collection thực sự có trong DB, kể cả rỗng. Không có .env/JWT/payment secret; bản xuất có tài khoản, liên hệ và tin nhắn nên giữ riêng. MONGO_URI hiện tại dùng replica set local cổng 27018. [Cách khôi phục và migration](PACKAGED_BACKUP.md).

Nếu dùng MongoDB Database Tools, mở PowerShell/CMD, không chạy bên trong mongosh. Xuất riêng collection listings thành JSON:

```powershell
mongoexport --uri="mongodb://127.0.0.1:27018/bookmarket_foundation?replicaSet=bookmarket-rs" --collection=listings --jsonArray --out="listings.json"
```

Xuất toàn database thành bản sao lưu BSON nén (khôi phục bằng mongorestore):

```powershell
mongodump --uri="mongodb://127.0.0.1:27018/bookmarket_foundation?replicaSet=bookmarket-rs" --archive="bookmarket-backup.archive.gz" --gzip
```

Tham khảo [mongoexport](https://www.mongodb.com/docs/database-tools/mongoexport/) và [mongodump](https://www.mongodb.com/docs/database-tools/mongodump/mongodump-examples/).

Trong MongoDB Compass, tạo database mới như bookmarket_restore, tạo các collection đúng tên file rồi dùng Add Data → Import JSON or CSV File để chọn JSON tương ứng. Hoặc dùng MongoDB Database Tools, ví dụ:

```text
mongoimport --uri="mongodb://127.0.0.1:27018/bookmarket_restore?replicaSet=bookmarket-rs" --collection=authors --file=data/authors.json --jsonArray
```

Lặp lại cho đủ file đã xuất; các ID đã nằm trong JSON nên quan hệ được giữ nếu nhập đầy đủ. JSON không tự tạo index; schema.json có metadata index, ứng dụng tạo index model khi khởi động trên DB đã nhập.

Đây là xuất JSON, không phải archive BSON dùng với mongorestore. Quá trình xuất chỉ đọc database gốc. Bản dữ liệu trước migration nằm riêng trong exports/backups; không trộn JSON schema cũ vào database đang chạy. Chưa khẳng định thao tác nhập dữ liệu đã được thử nếu không có kết quả tương ứng trong VERIFICATION.md.
