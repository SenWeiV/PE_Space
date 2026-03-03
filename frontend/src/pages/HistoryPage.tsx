import { Button, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { downloadAppFile, downloadOutput, listAllFiles, listAllRuns, type AllRunRecord, type HistoryFile } from "@/api/apps";
import { useAuthStore } from "@/store/authStore";

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [runs, setRuns] = useState<AllRunRecord[]>([]);
  const [files, setFiles] = useState<HistoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [runsRes, filesRes] = await Promise.all([listAllRuns(), listAllFiles()]);
        setRuns(runsRes.data.runs);
        setFiles(filesRes.data.files);
      } catch {
        message.error("加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDownloadRun = async (record: AllRunRecord) => {
    if (!record.output_filename) return;
    setDownloading(record.run_id);
    try {
      await downloadOutput(record.app_id, record.run_id, record.output_filename);
    } catch {
      message.error("文件不存在或已删除");
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadFile = async (file: HistoryFile) => {
    const key = `${file.app_id}/${file.path}`;
    setDownloading(key);
    try {
      await downloadAppFile(file.app_id, file.path, file.name);
    } catch {
      message.error("文件不存在或已删除");
    } finally {
      setDownloading(null);
    }
  };

  const runColumns: ColumnsType<AllRunRecord> = [
    {
      title: "时间",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 150,
      render: (ts: string) => dayjs(ts).format("MM-DD HH:mm:ss"),
    },
    {
      title: "App",
      dataIndex: "app_name",
      key: "app_name",
      width: 130,
      render: (name: string, record: AllRunRecord) => (
        <Typography.Link onClick={() => navigate(`/apps/${record.app_id}`)}>
          {name}
        </Typography.Link>
      ),
    },
    ...(isAdmin
      ? [{
          title: "用户",
          dataIndex: "username",
          key: "username",
          width: 90,
          render: (u: string) => (
            <span style={{ fontSize: 12, color: "#666", background: "#f5f5f5", padding: "2px 8px", borderRadius: 4 }}>
              {u}
            </span>
          ),
        }]
      : []),
    {
      title: "结果摘要",
      dataIndex: "summary",
      key: "summary",
      render: (summary: string) => <span style={{ color: "#444" }}>{summary || "-"}</span>,
    },
    {
      title: "参数",
      dataIndex: "inputs",
      key: "inputs",
      width: 200,
      render: (inputs: Record<string, unknown>) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {Object.entries(inputs || {}).map(([k, v]) => (
            <Tag key={k} style={{ fontSize: 11, margin: 0 }}>
              {k}：{String(v).slice(0, 20)}{String(v).length > 20 ? "…" : ""}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: "",
      key: "action",
      width: 80,
      render: (_: unknown, record: AllRunRecord) =>
        record.output_filename ? (
          <Button
            size="small"
            type="primary"
            ghost
            loading={downloading === record.run_id}
            onClick={() => handleDownloadRun(record)}
          >
            下载
          </Button>
        ) : (
          <span style={{ color: "#ccc", fontSize: 12 }}>无文件</span>
        ),
    },
  ];

  const fileColumns: ColumnsType<HistoryFile> = [
    {
      title: "修改时间",
      dataIndex: "modified_at",
      key: "modified_at",
      width: 150,
      render: (ts: string) => dayjs(ts).format("MM-DD HH:mm:ss"),
    },
    {
      title: "App",
      dataIndex: "app_name",
      key: "app_name",
      width: 130,
      render: (name: string, record: HistoryFile) => (
        <Typography.Link onClick={() => navigate(`/apps/${record.app_id}`)}>
          {name}
        </Typography.Link>
      ),
    },
    {
      title: "文件名",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "大小",
      dataIndex: "size",
      key: "size",
      width: 80,
      render: (size: number) => formatSize(size),
    },
    {
      title: "",
      key: "action",
      width: 80,
      render: (_: unknown, record: HistoryFile) => (
        <Button
          size="small"
          type="primary"
          ghost
          loading={downloading === `${record.app_id}/${record.path}`}
          onClick={() => handleDownloadFile(record)}
        >
          下载
        </Button>
      ),
    },
  ];

  const hasRuns = runs.length > 0;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          历史记录
        </Typography.Title>
        {!loading && !hasRuns && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            暂无运行记录，以下为 App 产出的文件列表
          </Typography.Text>
        )}
      </div>

      {hasRuns ? (
        <Table
          rowKey="run_id"
          columns={runColumns}
          dataSource={runs}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{
            emptyText: (
              <div style={{ padding: "48px 20px", color: "#999" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                <div>暂无运行记录</div>
              </div>
            ),
          }}
        />
      ) : (
        <Table
          rowKey={(r) => `${r.app_id}/${r.path}`}
          columns={fileColumns}
          dataSource={files}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{
            emptyText: (
              <div style={{ padding: "48px 20px", color: "#999" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                <div>暂无产出文件</div>
              </div>
            ),
          }}
        />
      )}
    </div>
  );
}
