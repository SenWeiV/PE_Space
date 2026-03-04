import { Drawer, Dropdown, Input, Modal, Select, Spin, Tag, message, type MenuProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { deleteApp, listApps, restartApp, stopApp, type AppItem } from "@/api/apps";
import UploadModal from "@/components/UploadModal";
import { useAuthStore } from "@/store/authStore";
import dayjs from "dayjs";

const STATUS_DOT: Record<string, { color: string; text: string; tagColor: string }> = {
  pending:  { color: "#d0d0d0", text: "待上传",   tagColor: "default" },
  building: { color: "#f59e0b", text: "构建中",   tagColor: "processing" },
  running:  { color: "#22c55e", text: "运行中",   tagColor: "success" },
  stopped:  { color: "#9ca3af", text: "已停止",   tagColor: "warning" },
  failed:   { color: "#ef4444", text: "构建失败", tagColor: "error" },
};

const APP_ICONS = ["📊", "🎨", "🔧", "📝", "🎯", "🔍", "💡", "🚀", "⚡", "🛠"];

function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*>\s]+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

function AppCard({
  app, canManage, onStop, onRestart, onDelete, onDetail,
}: {
  app: AppItem;
  canManage: boolean;
  onStop: () => void;
  onRestart: () => void;
  onDelete: () => void;
  onDetail: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const s = STATUS_DOT[app.status] || { color: "#d0d0d0", text: app.status, tagColor: "default" };
  const icon = APP_ICONS[app.id % APP_ICONS.length];
  const isRunning = app.status === "running";

  const handleCardClick = () => {
    if (isRunning && app.access_url) {
      window.open(app.access_url, "_blank");
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = window.location.origin + app.access_url;
    navigator.clipboard.writeText(url).then(() => message.success("链接已复制"));
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "detail",
      label: "查看详情",
      onClick: ({ domEvent }) => { domEvent.stopPropagation(); onDetail(); },
    },
  ];
  if (canManage && isRunning) {
    menuItems.push({
      key: "stop",
      label: "停止应用",
      onClick: ({ domEvent }) => { domEvent.stopPropagation(); onStop(); },
    });
  }
  if (canManage && app.status === "stopped") {
    menuItems.push({
      key: "restart",
      label: "启动应用",
      onClick: ({ domEvent }) => { domEvent.stopPropagation(); onRestart(); },
    });
  }
  if (canManage) {
    menuItems.push({ type: "divider" });
    menuItems.push({
      key: "delete",
      label: <span style={{ color: "#ef4444" }}>删除应用</span>,
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        Modal.confirm({
          title: "确认删除该应用？",
          content: "删除后无法恢复",
          okText: "删除",
          okButtonProps: { danger: true },
          onOk: onDelete,
        });
      },
    });
  }

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
        display: "flex",
        flexDirection: "column",
      }}
      onClick={handleCardClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 复制链接（右上角，仅 running） */}
      {isRunning && (
        <button
          onClick={handleCopy}
          style={{
            position: "absolute", top: 14, right: 14,
            padding: "3px 10px",
            background: "#f5f5f5", color: "#555",
            border: "1px solid #e5e5e5", borderRadius: 20,
            fontSize: 11, fontWeight: 500, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "#ebebeb";
            el.style.borderColor = "#d0d0d0";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "#f5f5f5";
            el.style.borderColor = "#e5e5e5";
          }}
        >
          🔗 复制链接
        </button>
      )}

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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.3px", margin: 0, paddingRight: 8 }}>
          {app.name}
        </h3>
        <span style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: s.color,
            boxShadow: isRunning ? `0 0 6px ${s.color}` : "none",
            display: "inline-block",
          }} />
          <span style={{ fontSize: 12, color: "#999" }}>{s.text}</span>
        </span>
      </div>

      {/* 描述（剥除 Markdown 后截断显示） */}
      {app.description && (
        <p style={{
          fontSize: 13, color: "#666", margin: "0 0 10px",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          lineHeight: 1.5,
        }}>
          {stripMarkdown(app.description)}
        </p>
      )}

      {/* 元信息 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
        <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
          <span style={{ color: "#999", minWidth: 44 }}>作者</span>
          <span style={{ color: "#1a1a1a", fontWeight: 500 }}>{app.owner.username}</span>
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
          <span style={{ color: "#999", minWidth: 44 }}>时间</span>
          <span style={{ color: "#1a1a1a", fontWeight: 500 }}>{dayjs(app.created_at).format("YYYY-MM-DD HH:mm")}</span>
        </div>
      </div>

      {/* 底部：三点菜单 */}
      <div
        style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
          <button
            style={{
              padding: "4px 12px",
              background: "transparent", color: "#aaa",
              border: "1px solid #e5e5e5", borderRadius: 6,
              fontSize: 18, cursor: "pointer", lineHeight: 1,
              letterSpacing: 1, transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "#c0c0c0";
              el.style.color = "#555";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "#e5e5e5";
              el.style.color = "#aaa";
            }}
          >···</button>
        </Dropdown>
      </div>
    </div>
  );
}

export default function AppsListPage() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailApp, setDetailApp] = useState<AppItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { user } = useAuthStore();

  const filteredApps = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (kw && !a.name.toLowerCase().includes(kw) && !a.owner.username.toLowerCase().includes(kw)) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
  }, [apps, search, statusFilter]);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await listApps({ page: 1, size: 100 });
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
    await deleteApp(id); message.success("已删除");
    setDetailApp(null);
    fetchApps();
  };

  const canManage = (app: AppItem) =>
    user?.role === "admin" || user?.id === app.owner.id;

  const s = detailApp ? (STATUS_DOT[detailApp.status] || { text: detailApp.status, tagColor: "default" }) : null;

  return (
    <div>
      {/* 头部（sticky） */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#fafafa",
        padding: "32px 0 20px",
        marginBottom: 4,
        borderBottom: "1px solid #f0f0f0",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.5px", margin: "0 0 4px" }}>
            应用管理
          </h1>
          <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
            查看和管理所有应用
          </p>
        </div>
        {apps.length > 0 && (
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
        )}
      </div>

      {/* 筛选栏（有应用时才显示） */}
      {apps.length > 0 && <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        <Input.Search
          placeholder="搜索应用名或创建者..."
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 240 }}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 140 }}
          options={[
            { value: "all", label: "全部状态" },
            { value: "running", label: "运行中" },
            { value: "stopped", label: "已停止" },
            { value: "building", label: "构建中" },
            { value: "failed", label: "构建失败" },
          ]}
        />
        {(search || statusFilter !== "all") && (
          <span style={{ fontSize: 13, color: "#999" }}>
            {filteredApps.length} / {apps.length} 个应用
          </span>
        )}
      </div>}

      {/* 内容 */}
      {loading && apps.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80 }}><Spin /></div>
      ) : filteredApps.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{
            width: 80, height: 80, margin: "0 auto 24px",
            background: "#f0f0f0", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40,
          }}>📱</div>
          <h3 style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", margin: "0 0 8px" }}>
            {apps.length === 0 ? "暂无应用" : "没有匹配的应用"}
          </h3>
          {apps.length === 0 && (
            <>
              <p style={{ color: "#666", marginBottom: 24 }}>上传你的第一个 App 吧</p>
              <button
                onClick={() => setUploadOpen(true)}
                style={{
                  padding: "12px 24px", background: "#2c2c2c", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >＋ 上传 App</button>
            </>
          )}
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 24,
        }}>
          {filteredApps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              canManage={canManage(app)}
              onStop={() => handleStop(app.id)}
              onRestart={() => handleRestart(app.id)}
              onDelete={() => handleDelete(app.id)}
              onDetail={() => setDetailApp(app)}
            />
          ))}
        </div>
      )}

      {/* 详情 Drawer */}
      <Drawer
        title={detailApp?.name}
        open={!!detailApp}
        onClose={() => setDetailApp(null)}
        width={520}
        extra={detailApp && s && <Tag color={s.tagColor}>{s.text}</Tag>}
      >
        {detailApp && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ color: "#999", width: 64 }}>创建者</span>
                <span style={{ fontWeight: 500 }}>{detailApp.owner.username}</span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ color: "#999", width: 64 }}>创建时间</span>
                <span>{dayjs(detailApp.created_at).format("YYYY-MM-DD HH:mm")}</span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ color: "#999", width: 64 }}>更新时间</span>
                <span>{dayjs(detailApp.updated_at).format("YYYY-MM-DD HH:mm")}</span>
              </div>
              {detailApp.status === "running" && detailApp.access_url && (
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ color: "#999", width: 64 }}>访问地址</span>
                  <a href={detailApp.access_url} target="_blank" rel="noreferrer">
                    {window.location.origin + detailApp.access_url}
                  </a>
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>应用说明</div>
              {detailApp.description ? (
                <div style={{ fontSize: 14, color: "#333", lineHeight: 1.8 }}>
                  <ReactMarkdown>{detailApp.description}</ReactMarkdown>
                </div>
              ) : (
                <div style={{ color: "#999", fontSize: 13 }}>暂无说明（上传包含 README.md 的 zip 后自动读取）</div>
              )}
            </div>

            {canManage(detailApp) && (
              <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 20, marginTop: 20, display: "flex", gap: 8 }}>
                {detailApp.status === "running" && (
                  <button
                    onClick={() => { handleStop(detailApp.id); setDetailApp(null); }}
                    style={btnStyle("#f0f0f0", "#666")}
                  >停止</button>
                )}
                {detailApp.status === "stopped" && (
                  <button
                    onClick={() => { handleRestart(detailApp.id); setDetailApp(null); }}
                    style={btnStyle("#2c2c2c", "#fff")}
                  >启动</button>
                )}
                <button
                  onClick={() => Modal.confirm({
                    title: "确认删除该应用？",
                    content: "删除后无法恢复",
                    okText: "删除",
                    okButtonProps: { danger: true },
                    onOk: () => handleDelete(detailApp.id),
                  })}
                  style={btnStyle("#fff1f0", "#ef4444", "1px solid #fecaca")}
                >删除应用</button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => { setUploadOpen(false); setTimeout(fetchApps, 1000); }}
      />
    </div>
  );
}

function btnStyle(bg: string, color: string, border = "none"): React.CSSProperties {
  return {
    padding: "5px 12px", background: bg, color, border,
    borderRadius: 6, fontSize: 12, fontWeight: 500,
    cursor: "pointer", transition: "opacity 0.15s",
  };
}
