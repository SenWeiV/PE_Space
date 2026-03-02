import { Badge, Button, Card, Descriptions, Space, Spin, Typography, message, Popconfirm } from "antd";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteApp, getApp, getAppLogs, restartApp, stopApp, type AppItem } from "@/api/apps";
import dayjs from "dayjs";

const STATUS_MAP: Record<string, { status: string; text: string }> = {
  pending: { status: "default", text: "待上传" },
  building: { status: "processing", text: "构建中" },
  running: { status: "success", text: "运行中" },
  stopped: { status: "warning", text: "已停止" },
  failed: { status: "error", text: "构建失败" },
};

export default function AppDetailPage() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppItem | null>(null);
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(true);
  const logRef = useRef<HTMLPreElement>(null);

  const fetchApp = async () => {
    const res = await getApp(Number(appId));
    setApp(res.data);
  };

  const fetchLog = async () => {
    const res = await getAppLogs(Number(appId));
    setLog(res.data.log || "");
    // 滚到底部
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    Promise.all([fetchApp(), fetchLog()]).finally(() => setLoading(false));

    // 构建中时自动轮询
    const timer = setInterval(async () => {
      const res = await getApp(Number(appId));
      setApp(res.data);
      if (res.data.status === "building") {
        await fetchLog();
      } else {
        clearInterval(timer);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [appId]);

  const handleStop = async () => {
    await stopApp(Number(appId));
    message.success("已停止");
    fetchApp();
  };

  const handleRestart = async () => {
    await restartApp(Number(appId));
    message.success("已重启");
    fetchApp();
  };

  const handleDelete = async () => {
    await deleteApp(Number(appId));
    message.success("已删除");
    navigate("/apps");
  };

  if (loading) return <Spin />;
  if (!app) return <Typography.Text>App 不存在</Typography.Text>;

  const s = STATUS_MAP[app.status] || { status: "default", text: app.status };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {app.name}
        </Typography.Title>
        <Space>
          {app.status === "running" && (
            <>
              <Button type="primary" href={app.access_url!} target="_blank">
                访问应用
              </Button>
              <Button onClick={handleStop}>停止</Button>
            </>
          )}
          {app.status === "stopped" && (
            <Button type="primary" onClick={handleRestart}>重启</Button>
          )}
          <Popconfirm title="确认删除？" onConfirm={handleDelete}>
            <Button danger>删除</Button>
          </Popconfirm>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={2}>
          <Descriptions.Item label="状态">
            <Badge status={s.status as any} text={s.text} />
          </Descriptions.Item>
          <Descriptions.Item label="作者">{app.owner.username}</Descriptions.Item>
          <Descriptions.Item label="路径">/apps/{app.slug}</Descriptions.Item>
          <Descriptions.Item label="端口">{app.host_port || "-"}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(app.created_at).format("YYYY-MM-DD HH:mm")}
          </Descriptions.Item>
          <Descriptions.Item label="描述">{app.description || "-"}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="构建日志">
        <pre
          ref={logRef}
          style={{
            background: "#1e1e1e",
            color: "#d4d4d4",
            padding: 16,
            borderRadius: 6,
            minHeight: 200,
            maxHeight: 500,
            overflow: "auto",
            fontSize: 12,
            lineHeight: 1.5,
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {log || "暂无日志"}
        </pre>
      </Card>
    </div>
  );
}
