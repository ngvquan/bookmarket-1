# Cách chạy

Yêu cầu: Node.js 20+, MongoDB và Android Studio nếu chạy app Android.

## Chạy web

Mở terminal tại thư mục dự án:

```bash
cd backend
npm install
```

Tạo `backend/.env` từ `backend/.env.example`, điền cấu hình MongoDB và JWT, sau đó chạy:

```bash
npm run dev
```

Mở terminal khác:

```bash
cd frontend
npm install
npm run dev
```

Mở địa chỉ Vite hiện trong terminal, thường là `http://localhost:5173`.

## Chạy Android

```bash
cd frontend
npm install
npm run build:mobile
npm run cap:sync
npm run cap:android
```

Trong Android Studio, chọn máy ảo hoặc điện thoại rồi bấm **Run**.
