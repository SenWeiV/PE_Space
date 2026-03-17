import { AutoComplete, Button, DatePicker, Input, Spin, Tag, message } from "antd";
import { DownloadOutlined, FileExcelOutlined, FileTextOutlined, FileOutlined, ClockCircleOutlined, AppstoreOutlined, UserOutlined, SearchOutlined, FilterOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { downloadAppFile, listGroupedRuns, type GroupedRun, type GroupedRunFile } from "@/api/apps";
import { useAuthStore } from "@/store/authStore";

const { RangePicker } = DatePicker;

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const fileIcon = (name: string) => {
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv"))
    return <FileExcelOutlined style={{ color: "#52c41a", marginRight: 4 }} />;
  if (name.endsWith(".jsonl") || name.endsWith(".json"))
    return <FileTextOutlined style={{ color: "#1677ff", marginRight: 4 }} />;
  return <FileOutlined style={{ color: "#999", marginRight: 4 }} />;
};

const CATEGORY_STYLE: Record<string, { color: string; label: string }> = {
  result: { color: "green", label: "结果" },
  detail: { color: "blue", label: "明细" },
  output: { color: "default", label: "产出" },
};

export default function HistoryPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [groups, setGroups] = useState<GroupedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // ── 筛选状态 ──
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [userKeyword, setUserKeyword] = useState("");
  const [appKeyword, setAppKeyword] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await listGroupedRuns();
        setGroups(res.data.groups);
      } catch {
        message.error("加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── 从数据中提取去重的用户名和工具名，作为联想候选 ──
  const allUsernames = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((r) => { if (r.username) set.add(r.username); });
    return Array.from(set).sort();
  }, [groups]);

  const allAppNames = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((r) => { if (r.app_name) set.add(r.app_name); });
    return Array.from(set).sort();
  }, [groups]);

  // ── 模糊匹配的联想选项 ──
  const userOptions = useMemo(() => {
    if (!userKeyword.trim()) return allUsernames.map((v) => ({ value: v }));
    const kw = userKeyword.trim().toLowerCase();
    return allUsernames
      .filter((name) => name.toLowerCase().includes(kw))
      .map((v) => ({ value: v }));
  }, [allUsernames, userKeyword]);

  const appOptions = useMemo(() => {
    if (!appKeyword.trim()) return allAppNames.map((v) => ({ value: v }));
    const kw = appKeyword.trim().toLowerCase();
    return allAppNames
      .filter((name) => name.toLowerCase().includes(kw))
      .map((v) => ({ value: v }));
  }, [allAppNames, appKeyword]);

  // ── 筛选逻辑 ──
  const filtered = useMemo(() => {
    let list = groups;

    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf("day");
      const end = dateRange[1].endOf("day");
      list = list.filter((r) => {
        if (!r.timestamp) return false;
        const t = dayjs(r.timestamp);
        return t.isAfter(start) && t.isBefore(end);
      });
    }

    if (userKeyword.trim()) {
      const kw = userKeyword.trim().toLowerCase();
      list = list.filter((r) => r.username?.toLowerCase().includes(kw));
    }

    if (appKeyword.trim()) {
      const kw = appKeyword.trim().toLowerCase();
      list = list.filter((r) => r.app_name?.toLowerCase().includes(kw));
    }

    return list;
  }, [groups, dateRange, userKeyword, appKeyword]);

  useEffect(() => { setPage(1); }, [dateRange, userKeyword, appKeyword]);

  const handleDownload = async (appId: number, file: GroupedRunFile) => {
    const key = `${appId}/${file.path}`;
    setDownloading(key);
    try {
      await downloadAppFile(appId, file.path, file.name);
    } catch {
      message.error("文件不存在或已删除");
    } finally {
      setDownloading(null);
    }
  };

  const getVisibleFiles = (record: GroupedRun) => {
    const resultFiles = record.files.filter(f => f.category === "result");
    const detailFiles = record.files.filter(f => f.category === "detail");
    const outputFiles = record.files.filter(f => f.category === "output");
    const allFile = detailFiles.find(f => f.name.includes("_all"));
    const shownDetail = allFile ? [allFile] : detailFiles;
    return [...resultFiles, ...shownDetail, ...outputFiles];
  };

  const hasFilter = !!(dateRange || userKeyword || appKeyword);
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const clearFilters = () => {
    setDateRange(null);
    setUserKeyword("");
    setAppKeyword("");
  };

  return (
    <div>
      {/* 头部 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#fafafa",
        padding: "32px 0 16px",
        borderBottom: "1px solid #f0f0f0",
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.5px", margin: "0 0 4px" }}>
          历史记录
        </h1>
        <p style={{ fontSize: 14, color: "#888", margin: "0 0 16px" }}>
          每次运行的所有产出文件汇总在一条记录中
        </p>

        {/* 筛选栏 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <FilterOutlined style={{ fontSize: 13, color: "#999" }} />
          <RangePicker
            value={dateRange}
            onChange={(vals) => setDateRange(vals)}
            placeholder={["开始日期", "结束日期"]}
            style={{ width: 260 }}
            allowClear
          />
          <AutoComplete
            value={userKeyword}
            options={userOptions}
            onSelect={(val) => setUserKeyword(val)}
            onChange={(val) => setUserKeyword(val)}
            style={{ width: 170 }}
          >
            <Input
              prefix={<UserOutlined style={{ color: "#bbb" }} />}
              placeholder="搜索用户"
              allowClear
            />
          </AutoComplete>
          <AutoComplete
            value={appKeyword}
            options={appOptions}
            onSelect={(val) => setAppKeyword(val)}
            onChange={(val) => setAppKeyword(val)}
            style={{ width: 170 }}
          >
            <Input
              prefix={<SearchOutlined style={{ color: "#bbb" }} />}
              placeholder="搜索工具"
              allowClear
            />
          </AutoComplete>
          {hasFilter && (
            <button onClick={clearFilters} style={{
              padding: "2px 10px", fontSize: 12, color: "#999", background: "none",
              border: "1px solid #e5e5e5", borderRadius: 4, cursor: "pointer",
            }}>
              清除筛选
            </button>
          )}
          {!loading && (
            <span style={{ fontSize: 12, color: "#bbb", marginLeft: "auto" }}>
              {hasFilter ? `${filtered.length} / ${groups.length} 条` : `共 ${groups.length} 条`}
            </span>
          )}
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* 内容 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 80 }}><Spin /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#999" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>{hasFilter ? "🔍" : "📭"}</div>
          <div style={{ fontSize: 15 }}>{hasFilter ? "没有匹配的记录" : "暂无运行记录"}</div>
          {hasFilter && (
            <button onClick={clearFilters} style={{
              marginTop: 12, padding: "4px 16px", fontSize: 13, color: "#1677ff",
              background: "none", border: "1px solid #1677ff", borderRadius: 6, cursor: "pointer",
            }}>
              清除筛选
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {paged.map((record) => {
              const files = getVisibleFiles(record);
              return (
                <div
                  key={`${record.app_id}_${record.ts_key}`}
                  style={{
                    background: "#fff",
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: "16px 20px",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#d0d0d0";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#eee";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* 元信息行 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: files.length > 0 ? 12 : 0, flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#888" }}>
                      <ClockCircleOutlined style={{ fontSize: 12 }} />
                      {record.timestamp ? dayjs(record.timestamp).format("YYYY-MM-DD HH:mm") : "-"}
                    </span>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 13, fontWeight: 600, color: "#1a1a1a",
                      background: "#f5f5f5", padding: "2px 10px", borderRadius: 6,
                    }}>
                      <AppstoreOutlined style={{ fontSize: 11, color: "#999" }} />
                      {record.app_name}
                    </span>
                    {record.username && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 12, color: "#666",
                        background: "#f0f7ff", padding: "2px 8px", borderRadius: 6,
                        border: "1px solid #e0edff",
                      }}>
                        <UserOutlined style={{ fontSize: 10 }} />
                        {record.username}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: "#bbb", marginLeft: "auto" }}>
                      {files.length} 个文件
                    </span>
                  </div>

                  {/* 文件列表 */}
                  {files.length > 0 && (
                    <div style={{
                      display: "flex", flexDirection: "column", gap: 6,
                      background: "#fafafa", borderRadius: 8, padding: "10px 12px",
                    }}>
                      {files.map((file) => {
                        const cat = CATEGORY_STYLE[file.category] || CATEGORY_STYLE.output;
                        return (
                          <div
                            key={file.path}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}
                          >
                            <Tag
                              color={cat.color}
                              style={{ margin: 0, fontSize: 11, lineHeight: "18px", flexShrink: 0 }}
                            >
                              {cat.label}
                            </Tag>
                            <span style={{
                              fontSize: 13, color: "#333", flex: 1,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              display: "flex", alignItems: "center",
                            }}>
                              {fileIcon(file.name)}
                              {file.name}
                            </span>
                            <span style={{ fontSize: 11, color: "#aaa", whiteSpace: "nowrap", flexShrink: 0 }}>
                              {formatSize(file.size)}
                            </span>
                            <Button
                              size="small"
                              type="text"
                              icon={<DownloadOutlined />}
                              loading={downloading === `${record.app_id}/${file.path}`}
                              onClick={() => handleDownload(record.app_id, file)}
                              style={{ color: "#1677ff", padding: "0 6px", flexShrink: 0 }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
              padding: "24px 0 16px",
            }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={pageBtnStyle(page <= 1)}
              >
                上一页
              </button>
              <span style={{ fontSize: 13, color: "#666", padding: "0 12px" }}>
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={pageBtnStyle(page >= totalPages)}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 500,
    border: "1px solid #e5e5e5",
    borderRadius: 6,
    background: disabled ? "#fafafa" : "#fff",
    color: disabled ? "#ccc" : "#333",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
