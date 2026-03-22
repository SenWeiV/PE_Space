import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true, 
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        // 把浏览器到 Vite 的 TCP 源地址传给后端，便于 IP 白名单识别（同机常为 127.0.0.1）
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq, req) => {
            const xff = req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"];
            if (xff) return;
            const ra = req.socket?.remoteAddress?.replace(/^::ffff:/, "") || "";
            if (ra) proxyReq.setHeader("X-Forwarded-For", ra);
          });
        },
      },
    },
  },
});
