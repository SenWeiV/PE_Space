import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

// 请求拦截：自动附加 JWT
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：401 跳转登录（排除登录接口自身，避免死循环）
// 409 表示登录互踢（账号在其他地方登录）
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url || "";
    if (status === 409 && err.response?.data?.detail) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      alert(err.response.data.detail);
      window.location.href = "/login";
    } else if (status === 401 && !url.includes("/auth/login")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default client;
