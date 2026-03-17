import { BarChartOutlined, TeamOutlined } from "@ant-design/icons";
import { Drawer, Table, Tabs, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import client from "@/api/client";

interface AppStat {
  id: number;
  name: string;
  slug: string;
  status: string;
  owner: string;
  created_at: string;
  view_count: number;
  view_users: number;
  run_count: number;
  run_users: number;
}

interface UserStat {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  upload_count: number;
  view_count: number;
  run_count: number;
}

interface UsageDetail {
  username: string;
  app_id: number;
  app_name: string;
  view_count: number;
  run_count: number;
}

const APP_ICONS = ["📊", "🎨", "🔧", "📝", "🎯", "🔍", "💡", "🚀", "⚡", "🛠"];

export default function StatsPage() {
  const [appStats, setAppStats] = useState<AppStat[]>([]);
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [usageDetail, setUsageDetail] = useState<UsageDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppStat | null>(null);

  useEffect(() => {
    setLoading(true);
    client.get<{ apps: AppStat[]; users: UserStat[]; usage_detail: UsageDetail[] }>("/stats")
      .then((res) => {
        setAppStats(res.data.apps);
        setUserStats(res.data.users);
        setUsageDetail((res.data.usage_detail || []).filter(d => d.username !== "anonymous"));
      })
      .finally(() => setLoading(false));
  }, []);

  // 先按运行次数降序，再按访问次数降序
  const sortedApps = useMemo(
    () => [...appStats].sort((a, b) => b.run_count - a.run_count || b.view_count - a.view_count),
    [appStats],
  );

  // 选中 app 的用户明细
  const selectedAppUsers = useMemo(() => {
    if (!selectedApp) return [];
    return usageDetail
      .filter((d) => d.app_id === selectedApp.id && d.username !== "anonymous")
      .sort((a, b) => (b.view_count + b.run_count) - (a.view_count + a.run_count));
  }, [selectedApp, usageDetail]);

  const statusColor: Record<string, string> = {
    running: "green",
    stopped: "default",
    error: "red",
  };
  const statusLabel: Record<string, string> = {
    running: "运行中",
    stopped: "已停止",
    error: "错误",
  };
  const roleColor: Record<string, string> = {
    admin: "purple",
    user: "blue",
    annotator: "orange",
  };
  const roleLabel: Record<string, string> = {
    admin: "管理员",
    user: "普通用户",
    annotator: "标注账号",
  };

  const appColumns = [
    { title: "应用名称", dataIndex: "name", ellipsis: true },
    {
      title: "状态",
      dataIndex: "status",
      render: (v: string) => <Tag color={statusColor[v] ?? "default"}>{statusLabel[v] ?? v}</Tag>,
    },
    { title: "所有者", dataIndex: "owner" },
    {
      title: "创建时间",
      dataIndex: "created_at",
      render: (v: string) => dayjs(v).format("YYYY-MM-DD"),
    },
    {
      title: "访问次数",
      dataIndex: "view_count",
      sorter: (a: AppStat, b: AppStat) => a.view_count - b.view_count,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "访问人数",
      dataIndex: "view_users",
      sorter: (a: AppStat, b: AppStat) => a.view_users - b.view_users,
    },
    {
      title: "运行次数",
      dataIndex: "run_count",
      sorter: (a: AppStat, b: AppStat) => a.run_count - b.run_count,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "运行人数",
      dataIndex: "run_users",
      sorter: (a: AppStat, b: AppStat) => a.run_users - b.run_users,
    },
  ];

  const userColumns = [
    { title: "用户名", dataIndex: "username" },
    {
      title: "角色",
      dataIndex: "role",
      render: (r: string) => <Tag color={roleColor[r] ?? "default"}>{roleLabel[r] ?? r}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "is_active",
      render: (v: boolean) => <Tag color={v ? "green" : "red"}>{v ? "正常" : "禁用"}</Tag>,
    },
    {
      title: "上传应用数",
      dataIndex: "upload_count",
      sorter: (a: UserStat, b: UserStat) => a.upload_count - b.upload_count,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "访问次数",
      dataIndex: "view_count",
      sorter: (a: UserStat, b: UserStat) => a.view_count - b.view_count,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "运行次数",
      dataIndex: "run_count",
      sorter: (a: UserStat, b: UserStat) => a.run_count - b.run_count,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
  ];

  const detailColumns = [
    { title: "用户名", dataIndex: "username", filters: [...new Set(usageDetail.map(d => d.username))].map(u => ({ text: u, value: u })), onFilter: (value: any, record: UsageDetail) => record.username === value },
    { title: "应用名称", dataIndex: "app_name", ellipsis: true, filters: [...new Set(usageDetail.map(d => d.app_name))].map(n => ({ text: n, value: n })), onFilter: (value: any, record: UsageDetail) => record.app_name === value },
    {
      title: "访问次数",
      dataIndex: "view_count",
      sorter: (a: UsageDetail, b: UsageDetail) => a.view_count - b.view_count,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "运行次数",
      dataIndex: "run_count",
      sorter: (a: UsageDetail, b: UsageDetail) => a.run_count - b.run_count,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "合计",
      key: "total",
      sorter: (a: UsageDetail, b: UsageDetail) => (a.view_count + a.run_count) - (b.view_count + b.run_count),
      render: (_: any, r: UsageDetail) => <span style={{ fontWeight: 600 }}>{r.view_count + r.run_count}</span>,
    },
  ];

  const totalViews = appStats.reduce((s, a) => s + a.view_count, 0);
  const totalViewUsers = new Set(usageDetail.filter(d => d.view_count > 0).map(d => d.username)).size;

  return (
    <div>
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#fafafa",
        padding: "32px 0 20px",
        marginBottom: 4,
        borderBottom: "1px solid #f0f0f0",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.5px", margin: 0 }}>
          使用统计
        </h1>
      </div>

      {/* 概览卡片 - 第一行 */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, marginTop: 20, flexWrap: "wrap" }}>
        {[
          { label: "应用总数", value: appStats.length, icon: "📦" },
          { label: "用户总数", value: userStats.length, icon: "👥" },
          { label: "平台访问总次数", value: totalViews, icon: "👁" },
          { label: "平台访问总人数", value: totalViewUsers, icon: "🧑‍💻" },
        ].map((item) => (
          <div key={item.label} style={{
            flex: "1 1 140px",
            background: "#fff",
            border: "1px solid #f0f0f0",
            borderRadius: 12,
            padding: "20px 24px",
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a", lineHeight: 1 }}>{item.value}</div>
            <div style={{ fontSize: 13, color: "#999", marginTop: 6 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* 应用使用排行 - 第二行：每个 app 一张卡片，按使用次数降序 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>应用使用排行</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {sortedApps.length === 0 ? (
            <div style={{ color: "#999", fontSize: 13 }}>暂无应用</div>
          ) : (
            sortedApps.map((app) => {
              const icon = APP_ICONS[app.id % APP_ICONS.length];
              return (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  style={{
                    flex: "0 0 auto",
                    minWidth: 160,
                    background: "#fff",
                    border: "1px solid #f0f0f0",
                    borderRadius: 12,
                    padding: "16px 20px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#d0d0d0";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#f0f0f0";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span style={{
                      fontSize: 14, fontWeight: 600, color: "#1a1a1a",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120,
                    }}>{app.name}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a", lineHeight: 1 }}>
                    {app.run_count}<span style={{ fontSize: 13, fontWeight: 400, color: "#999", marginLeft: 4 }}>次运行</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 6 }}>
                    访问 {app.view_count} 次
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 点击 app 卡片后的用户明细 Drawer */}
      <Drawer
        title={selectedApp ? `${selectedApp.name} - 使用详情` : ""}
        open={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        width={480}
      >
        {selectedApp && (
          <div>
            {/* app 概览信息 */}
            <div style={{
              display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap",
            }}>
              {[
                { label: "访问次数", value: selectedApp.view_count },
                { label: "访问人数", value: selectedApp.view_users },
                { label: "运行次数", value: selectedApp.run_count },
              ].map((item) => (
                <div key={item.label} style={{
                  flex: "1 1 90px",
                  background: "#f9f9f9",
                  borderRadius: 8,
                  padding: "12px 16px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a" }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* 用户明细列表 */}
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>用户使用明细</div>
            {selectedAppUsers.length === 0 ? (
              <div style={{ color: "#bbb", fontSize: 13, textAlign: "center", padding: "20px 0" }}>暂无使用记录</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedAppUsers.map((u) => (
                  <div key={u.username} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "#f9f9f9", borderRadius: 8, padding: "12px 16px",
                    border: "1px solid #f0f0f0",
                  }}>
                    <div style={{ fontWeight: 500, fontSize: 14, color: "#1a1a1a" }}>{u.username}</div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#666" }}>
                      <span>访问 <b style={{ color: "#1a1a1a" }}>{u.view_count}</b></span>
                      <span>运行 <b style={{ color: "#1a1a1a" }}>{u.run_count}</b></span>
                      <span>合计 <b style={{ color: "#1a1a1a" }}>{u.view_count + u.run_count}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Tabs
        defaultActiveKey="apps"
        items={[
          {
            key: "apps",
            label: (
              <span>
                <BarChartOutlined /> 应用统计
              </span>
            ),
            children: (
              <Table
                rowKey="id"
                dataSource={appStats}
                columns={appColumns}
                loading={loading}
                pagination={{ pageSize: 20 }}
                locale={{
                  emptyText: (
                    <div style={{ padding: "48px 20px", color: "#999" }}>
                      <Typography.Text type="secondary">暂无数据</Typography.Text>
                    </div>
                  ),
                }}
              />
            ),
          },
          {
            key: "users",
            label: "用户统计",
            children: (
              <Table
                rowKey="id"
                dataSource={userStats}
                columns={userColumns}
                loading={loading}
                pagination={{ pageSize: 20 }}
                locale={{
                  emptyText: (
                    <div style={{ padding: "48px 20px", color: "#999" }}>
                      <Typography.Text type="secondary">暂无数据</Typography.Text>
                    </div>
                  ),
                }}
              />
            ),
          },
          {
            key: "detail",
            label: (
              <span>
                <TeamOutlined /> 使用明细
              </span>
            ),
            children: (
              <Table
                rowKey={(r) => `${r.username}-${r.app_id}`}
                dataSource={usageDetail}
                columns={detailColumns}
                loading={loading}
                pagination={{ pageSize: 20 }}
                locale={{
                  emptyText: (
                    <div style={{ padding: "48px 20px", color: "#999" }}>
                      <Typography.Text type="secondary">暂无数据</Typography.Text>
                    </div>
                  ),
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
