import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import {
  HomeOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  UserOutlined,
  FileTextOutlined,
  SettingOutlined,
} from "@ant-design/icons";

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const isAdmin = user?.role === "admin";

  const navItems = [
    { path: "/", icon: <HomeOutlined />, label: "首页" },
    { path: "/apps", icon: <AppstoreOutlined />, label: "应用管理" },
    { path: "/history", icon: <HistoryOutlined />, label: "历史记录" },
  ];

  const adminMenuItems = [
    { path: "/admin/users", icon: <UserOutlined />, label: "用户管理" },
    { path: "/admin/template", icon: <FileTextOutlined />, label: "系统模板管理" },
    { path: "/admin/prompts", icon: <FileTextOutlined />, label: "Prompt 管理" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa" }}>
      {/* 侧边栏 */}
      <aside style={{
        position: "fixed", left: 0, top: 0,
        width: 240, height: "100vh",
        background: "#ffffff",
        borderRight: "1px solid #e5e5e5",
        display: "flex", flexDirection: "column",
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: "32px 24px", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40,
              background: "#2c2c2c", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px",
            }}>AS</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>APP STORE</div>
              <div style={{ fontSize: 11, color: "#999", letterSpacing: "0.3px" }}>PLATFORM</div>
            </div>
          </div>
        </div>

        {/* 导航 */}
        <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
          {/* 普通导航项 */}
          {navItems.map((item) => (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", marginBottom: 4,
                borderRadius: 8, fontSize: 14, fontWeight: isActive(item.path) ? 600 : 500,
                color: isActive(item.path) ? "#1a1a1a" : "#666",
                background: isActive(item.path) ? "#f0f0f0" : "transparent",
                cursor: "pointer", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.path))
                  (e.currentTarget as HTMLElement).style.background = "#f7f7f7";
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.path))
                  (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span style={{ fontSize: 18, display: "flex", alignItems: "center", color: isActive(item.path) ? "#165DFF" : "#86909C" }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}

          {/* 管理后台菜单 */}
          {isAdmin && (
            <>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", marginTop: 8, marginBottom: 4,
                  borderRadius: 8, fontSize: 13, fontWeight: 600,
                  color: "#86909C",
                  letterSpacing: "0.5px",
                }}
              >
                <SettingOutlined style={{ fontSize: 14, color: "#86909C" }} />
                <span>管理后台</span>
              </div>
              {adminMenuItems.map((item) => {
                const isSubActive = location.pathname === item.path;
                return (
                  <div
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 16px 10px 32px", marginBottom: 2,
                      borderRadius: 6, fontSize: 13, fontWeight: isSubActive ? 600 : 500,
                      color: isSubActive ? "#1677ff" : "#666",
                      background: isSubActive ? "#e6f4ff" : "transparent",
                      cursor: "pointer", transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubActive)
                        (e.currentTarget as HTMLElement).style.background = "#f7f7f7";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSubActive)
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <span style={{ fontSize: 14, display: "flex", alignItems: "center", color: isSubActive ? "#165DFF" : "#86909C" }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </>
          )}
        </nav>

        {/* 用户信息 */}
        <div style={{ padding: "20px 24px", borderTop: "1px solid #f0f0f0" }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: 8, borderRadius: 8, cursor: "pointer",
            }}
            onClick={() => { clearAuth(); navigate("/login"); }}
            title="点击退出登录"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f7f7f7"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(135deg, #2c2c2c, #1a1a1a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 14, fontWeight: 600,
            }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{user?.username}</div>
              <div style={{ fontSize: 11, color: "#999" }}>
                {user?.role === "admin" ? "管理员" : "普通用户"}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 主内容 */}
      <main style={{ marginLeft: 240, flex: 1, padding: "40px 48px", minHeight: "100vh" }}>
        <Outlet />
      </main>
    </div>
  );
}
