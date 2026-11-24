// Vite chuyển riêng chatbot đến backend local, còn mua hàng đến backend triển khai.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function proxyError(proxy) {
  proxy.on("error", (_error, _request, response) => {
    if (!response?.writeHead || response.headersSent || response.writableEnded)
      return;
    response.writeHead(503, {
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify({
      message: "Không kết nối được backend. Vui lòng thử lại sau giây lát.",
    }));
  });
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/ai": {
        // AI local dùng Ollama trên máy; các API mua hàng vẫn dùng backend đang chạy.
        target: process.env.AI_PROXY_TARGET || "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
        configure: proxyError,
      },
      "/api/voice": {
        target: "http://127.0.0.1:4001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        configure: proxyError,
      },
      "/api": {
        // Giữ backend triển khai để đơn hàng và webhook VietQR tiếp tục hoạt động.
        target:
          process.env.API_PROXY_TARGET ||
          "https://bookmarket-api-ngvquan.onrender.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
        configure: proxyError,
      },
    },
  },
});
