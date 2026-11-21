// Vite phục vụ frontend và chuyển /api tới Express khi phát triển local.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        // Mac dinh dung backend Render de don tao tu localhost va webhook SePay
        // cung doc mot MongoDB Atlas. Co the dat API_PROXY_TARGET ve local khi can.
        target:
          process.env.API_PROXY_TARGET ||
          "https://bookmarket-api-ngvquan.onrender.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
        configure(proxy) {
          // Khi backend đang khởi động lại, trả lỗi JSON thay vì trang/text lỗi của proxy.
          proxy.on("error", (_error, _request, response) => {
            if (
              !response?.writeHead ||
              response.headersSent ||
              response.writableEnded
            )
              return;
            response.writeHead(503, {
              "Content-Type": "application/json; charset=utf-8",
            });
            response.end(
              JSON.stringify({
                message:
                  "Không kết nối được backend. Vui lòng thử lại sau giây lát.",
              }),
            );
          });
        },
      },
    },
  },
});
