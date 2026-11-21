# Checkpoint Giai đoạn 0

> Kết quả của mốc Giai đoạn 0, không phải kết quả kiểm thử bản hiện tại. Xem [VERIFICATION.md](../VERIFICATION.md) và [đặt hàng bước 1](../ORDERS_STEP1.md).

- Baseline: 10/10 Playwright cũ đạt trước thay đổi.
- Sau sửa và refactor: build thành công; 18/18 Playwright đạt, gồm nguyên 10 bài cũ và 8 bài hồi quy mới.
- URL kiểm thử: http://127.0.0.1:5180. Đây là server sở hữu bởi phiên làm việc; server người dùng ở cổng 5173 không bị dừng.
- Các module mới: identity.js, validation.js, hooks/useStored.js, hooks/useBookMarket.js, pages/*, components/Modal.jsx, ErrorBoundary.jsx, Auth/PostForm/Reader/PageTitle.
- Hồi quy: seller trùng tên không nhập làm một; yêu thích/thư viện lọc khả dụng; giỏ không tính tin mất hiệu lực; stale add/checkout bị chặn; thứ tự đóng Modal, Escape và callback mới; quota storage và Error Boundary; trim form, prefix ISBN; màu trạng thái từ chối/hủy.
- Vẫn là demo localStorage ở checkpoint này; API thật bắt đầu tại Giai đoạn 1. Test lịch sử được giữ trong ZIP checkpoint; các test kết nối API được bổ sung riêng khi tích hợp.

Chạy từ root: `npm run build`; mở dev server bằng `npm run dev`, rồi `npm run test:e2e`. Nếu dùng cổng khác, đặt PLAYWRIGHT_BASE_URL trước.
