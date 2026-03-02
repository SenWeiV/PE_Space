import { Form, Input, message } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm();

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError("");
    try {
      const res = await login(values.username, values.password);
      setAuth(res.data.user, res.data.access_token);
      navigate("/");
    } catch (e: any) {
      setError(e.response?.data?.detail || "用户名或密码错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#fafafa",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', 'Inter', 'PingFang SC', sans-serif",
    }}>
      <div style={{ width: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, background: "#2c2c2c", borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 700, color: "#fff",
            margin: "0 auto 16px", letterSpacing: "-0.5px",
          }}>AS</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.5px" }}>
            APP STORE
          </div>
          <div style={{ fontSize: 13, color: "#999", marginTop: 4 }}>欢迎登录</div>
        </div>

        {/* 表单卡片 */}
        <div style={{
          background: "#fff", borderRadius: 12,
          border: "1px solid #e5e5e5", padding: 32,
        }}>
          {error && (
            <div style={{
              background: "#fff1f0", border: "1px solid #fecaca",
              borderRadius: 8, padding: "10px 14px",
              fontSize: 13, color: "#ef4444", marginBottom: 20,
            }}>
              {error}
            </div>
          )}

          <Form form={form} onFinish={handleLogin} layout="vertical" requiredMark={false}>
            <Form.Item
              name="username"
              label={<span style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>用户名</span>}
              rules={[{ required: true, message: "请输入用户名" }]}
              style={{ marginBottom: 16 }}
            >
              <Input
                size="large"
                placeholder="请输入用户名"
                style={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 14 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>密码</span>}
              rules={[{ required: true, message: "请输入密码" }]}
              style={{ marginBottom: 24 }}
            >
              <Input.Password
                size="large"
                placeholder="请输入密码"
                style={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 14 }}
              />
            </Form.Item>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "13px 0",
                background: loading ? "#666" : "#2c2c2c",
                color: "#fff", border: "none", borderRadius: 8,
                fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
