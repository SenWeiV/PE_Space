import { Popconfirm, Spin, message } from "antd";
import { useEffect, useState } from "react";
import { deleteApp, listApps, restartApp, stopApp, type AppItem } from "@/api/apps";
import UploadModal from "@/components/UploadModal";
import { useAuthStore } from "@/store/authStore";
import dayjs from "dayjs";

const STATUS_DOT: Record<string, { color: string; text: string }> = {
  pending:  { color: "#d0d0d0", text: "待上传" },
  building: { color: "#f59e0b", text: "构建中" },
  running:  { color: "#22c55e", text: "运行中" },
  stopped:  { color: "#9ca3af", text: "已停止" },
  failed:   { color: "#ef4444", text: "构建失败" },
};

const APP_ICONS = ["📊", "🎨", "🔧", "📝", "🎯", "🔍", "💡", "🚀", "⚡", "🛠"];

function AppCard({
  app, canDelete, onStop, onRestart, onDelete,
}: {
  app: AppItem;
  canDelete: boolean;
  onStop: () => void;
  onRestart: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const s = STATUS_DOT[app.status] || { color: "#d0d0d0", text: app.status };
  const icon = APP_ICONS[app.id % APP_ICONS.length];
  const isRunning = app.status === "running";

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${hovered ? "#d0d0d0" : "#e5e5e5"}`,
        borderRadius: 12,
        padding: 24,
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.08)" : "none",
        cursor: isRunning ? "pointer" : "default",
        position: "relative",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (isRunning && app.access_url) window.open(app.access_url, "_blank"); }}
    >
      {/* 图标 */}
      <div style={{
        width: 56, height: 56, borderRadius: 12,
        background: "linear-gradient(135deg, #2c2c2c, #1a1a1a)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, marginBottom: 16,
      }}>
        {icon}
      </div>

      {/* 名称 + 状态 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontSize: 17, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.3px", margin: 0 }}>
          {app.name}
        </h3>
        <span style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 8, flexShrink: 0 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: s.color,
            boxShadow: app.status === "running" ? `0 0 6px ${s.color}` : "none",
            display: "inline-block",
          }} />
          <span style={{ fontSize: 12, color: "#999" }}>{s.text}</span>
        </span>
      </div>

      {/* 元信息 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
          <span style={{ color: "#999", minWidth: 44 }}>作者</span>
          <span style={{ color: "#1a1a1a", fontWeight: 500 }}>{app.owner.username}</span>
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
          <span style={{ color: "#999", minWidth: 44 }}>时间</span>
          <span style={{ color: "#1a1a1a", fontWeight: 500 }}>{dayjs(app.created_at).format("YYYY-MM-DD HH:mm")}</span>
        </div>
      </div>

      {/* 操作按钮（hover 显示） */}
      {hovered && (
        <div
          style={{ display: "flex", gap: 8, marginTop: 16 }}
          onClick={(e) => e.stopPropagation()}
        >
          {app.status === "running" && (
            <button onClick={onStop} style={btnStyle("#f0f0f0", "#1a1a1a")}>停止</button>
          )}
          {app.status === "stopped" && (
            <button onClick={onRestart} style={btnStyle("#2c2c2c", "#fff")}>启动</button>
          )}
          {canDelete && (
            <span onClick={(e) => e.stopPropagation()}>
              <Popconfirm title="确认删除？" onConfirm={onDelete}>
                <button style={btnStyle("#fff1f0", "#ef4444", "1px solid #fecaca")}>删除</button>
              </Popconfirm>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function btnStyle(bg: string, color: string, border = "none"): React.CSSProperties {
  return {
    padding: "6px 14px", background: bg, color, border,
    borderRadius: 6, fontSize: 12, fontWeight: 500,
    cursor: "pointer", transition: "opacity 0.15s",
  };
}

export default function AppsListPage() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { user } = useAuthStore();

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await listApps({ page: 1, size: 50 });
      setApps(res.data.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
    const timer = setInterval(fetchApps, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleStop = async (id: number) => {
    await stopApp(id); message.success("已停止"); fetchApps();
  };
  const handleRestart = async (id: number) => {
    await restartApp(id); message.success("已启动"); fetchApps();
  };
  const handleDelete = async (id: number) => {
    await deleteApp(id); message.success("已删除"); fetchApps();
  };

  return (
    <div>
      {/* 头部 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.5px", margin: "0 0 8px" }}>
            应用管理
          </h1>
          <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
            查看和管理所有应用，点击运行中的卡片可直接访问
          </p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          style={{
            padding: "12px 24px", background: "#2c2c2c", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#1a1a1a"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#2c2c2c"; }}
        >
          <span>＋</span> 上传 App
        </button>
      </div>

      {/* 内容 */}
      {loading && apps.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80 }}><Spin /></div>
      ) : apps.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          {/* 空状态 - 不显示任何内容 */}
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 24,
        }}>
          {apps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              canDelete={user?.role === "admin" || user?.id === app.owner.id}
              onStop={() => handleStop(app.id)}
              onRestart={() => handleRestart(app.id)}
              onDelete={() => handleDelete(app.id)}
            />
          ))}
        </div>
      )}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => { setUploadOpen(false); setTimeout(fetchApps, 1000); }}
      />
    </div>
  );
}
