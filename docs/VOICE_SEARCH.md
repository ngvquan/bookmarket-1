# Tìm sách bằng giọng nói

Trên localhost, nút micro ghi âm tối đa 10 giây rồi gửi tới máy chủ giọng nói cục bộ ở cổng 4001. Máy chủ dùng Whisper small để phát hiện tiếng Việt hoặc tiếng Anh, PhoWhisper small cho tiếng Việt và Whisper small cho tiếng Anh. Khi phát hiện ngôn ngữ chưa chắc chắn, máy chủ thử nhận diện theo cả hai ngôn ngữ và chọn dựa trên xác suất ngôn ngữ cùng chất lượng bản chép; không dùng danh sách từ cố định. Văn bản nhận diện được điền vào ô và tự tìm kiếm theo đúng văn bản đó; hệ thống không dùng gợi ý tên sách để sửa câu nói. Nếu không có sách khớp, trang hiển thị kết quả rỗng. Dấu câu do model tự thêm được bỏ đi.

Khởi động máy chủ giọng nói từ thư mục dự án:

```powershell
& 'E:\BookMarket\voice-env\Scripts\python.exe' .\backend\scripts\voice-server.py
```

Sau đó chạy frontend và mở http://127.0.0.1:5173. Kiểm tra http://127.0.0.1:5173/api/voice/status trả `{"local":true}`. Bấm micro, nói câu cần tìm rồi bấm lần nữa hoặc đợi 10 giây; kết quả tìm kiếm tự mở. Trình duyệt cần được cấp quyền dùng micro. Tiếng Việt và tiếng Anh đều được tự nhận diện, không cần chọn ngôn ngữ.

Nhận diện giọng nói bằng mô hình có thể nghe sai từ; hệ thống chỉ hiển thị đúng văn bản mô hình trả về, không thể bảo đảm mọi từ đều trùng tuyệt đối với lời nói.

Máy khác cần cài `faster-whisper` và cả hai model; có thể chỉ định thư mục bằng `VOICE_MODEL_PATH` và `VOICE_VI_MODEL_PATH`. Website triển khai trên mạng không có sẵn máy chủ giọng nói cục bộ này.
