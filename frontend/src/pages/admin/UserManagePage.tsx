import { PlusOutlined, TeamOutlined } from "@ant-design/icons";
import {
  Button, DatePicker, Form, Input, InputNumber, Modal,
  Popconfirm, Select, Space, Table, Tag, Typography, message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import client from "@/api/client";
import type { User } from "@/api/auth";
import dayjs from "dayjs";

export default function UserManagePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchResult, setBatchResult] = useState<User[]>([]);
  const [batchResultOpen, setBatchResultOpen] = useState(false);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchUsers = async () => {
    setLoading(true);
    const res = await client.get<User[]>("/admin/users");
    setUsers(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (values: any) => {
    try {
      const payload = {
        ...values,
        expires_at: values.expires_at ? values.expires_at.toISOString() : null,
      };
      await client.post("/admin/users", payload);
      message.success("创建成功");
      setCreateOpen(false);
      form.resetFields();
      fetchUsers();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "创建失败");
    }
  };

  const handleBatchCreate = async (values: any) => {
    try {
      const payload = {
        project_name: values.project_name,
        start_index: values.start_index ?? 1,
        count: values.count,
        password: values.password,
        expires_at: values.expires_at ? values.expires_at.toISOString() : null,
      };
      const res = await client.post<User[]>("/admin/users/batch", payload);
      message.success(`成功创建 ${res.data.length} 个标注账号`);
      setBatchOpen(false);
      batchForm.resetFields();
      setBatchResult(res.data);
      setBatchResultOpen(true);
      fetchUsers();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "批量创建失败");
    }
  };

  const handleToggleActive = async (user: User) => {
    await client.put(`/admin/users/${user.id}`, { is_active: !user.is_active });
    message.success(user.is_active ? "已禁用" : "已启用");
    fetchUsers();
  };

  const handleDelete = async (userId: number) => {
    try {
      await client.delete(`/admin/users/${userId}`);
      message.success("已删除");
      fetchUsers();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "删除失败");
    }
  };

  const filteredUsers = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return users.filter((u) => {
      if (kw && !u.username.toLowerCase().includes(kw)) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "disabled" && u.is_active) return false;
      if (statusFilter === "expired") {
        if (!u.expires_at || !dayjs(u.expires_at).isBefore(dayjs())) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

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

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "用户名", dataIndex: "username" },
    {
      title: "角色",
      dataIndex: "role",
      render: (r: string) => (
        <Tag color={roleColor[r] ?? "default"}>{roleLabel[r] ?? r}</Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "is_active",
      render: (v: boolean) => <Tag color={v ? "green" : "red"}>{v ? "正常" : "禁用"}</Tag>,
    },
    {
      title: "过期时间",
      dataIndex: "expires_at",
      render: (v?: string) => {
        if (!v) return <span style={{ color: "#aaa" }}>永不过期</span>;
        const expired = dayjs(v).isBefore(dayjs());
        return (
          <span style={{ color: expired ? "#ff4d4f" : "#52c41a" }}>
            {dayjs(v).format("YYYY-MM-DD")}
            {expired ? " (已过期)" : ""}
          </span>
        );
      },
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      render: (v: string) => dayjs(v).format("YYYY-MM-DD"),
    },
    {
      title: "操作",
      render: (_: any, record: User) => (
        <Space size="small">
          <Button size="small" onClick={() => handleToggleActive(record)}>
            {record.is_active ? "禁用" : "启用"}
          </Button>
          <Popconfirm
            title="确认删除该用户？"
            description="删除后无法恢复"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

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
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.5px", margin: 0 }}>用户管理</h1>
        <Space>
          <Button icon={<TeamOutlined />} onClick={() => setBatchOpen(true)}>
            批量创建标注账号
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}
            style={{ background: "#000", borderColor: "#000" }}>
            创建用户
          </Button>
        </Space>
      </div>

      {/* 筛选栏 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Input.Search
          placeholder="搜索用户名..."
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220 }}
        />
        <Select
          value={roleFilter}
          onChange={setRoleFilter}
          style={{ width: 140 }}
          options={[
            { value: "all", label: "全部角色" },
            { value: "admin", label: "管理员" },
            { value: "user", label: "普通用户" },
            { value: "annotator", label: "标注账号" },
          ]}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 140 }}
          options={[
            { value: "all", label: "全部状态" },
            { value: "active", label: "正常" },
            { value: "disabled", label: "已禁用" },
            { value: "expired", label: "已过期" },
          ]}
        />
        {(search || roleFilter !== "all" || statusFilter !== "all") && (
          <span style={{ lineHeight: "32px", fontSize: 13, color: "#999" }}>
            共 {filteredUsers.length} / {users.length} 条
          </span>
        )}
      </div>

      <Table
        rowKey="id"
        dataSource={filteredUsers}
        columns={columns}
        loading={loading}
        locale={{
          emptyText: (
            <div style={{ padding: "48px 20px", color: "#999" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", marginBottom: 6 }}>
                {users.length === 0 ? "暂无用户" : "没有匹配的用户"}
              </div>
              <div style={{ fontSize: 13 }}>
                {users.length === 0 ? "点击右上角「创建用户」添加第一个账号" : "尝试调整筛选条件"}
              </div>
            </div>
          ),
        }}
      />

      {/* 单个创建 */}
      <Modal
        title="创建用户"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item label="用户名" name="username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="角色" name="role" initialValue="user">
            <Select options={[
              { value: "user", label: "普通用户" },
              { value: "admin", label: "管理员" },
              { value: "annotator", label: "标注账号（仅首页+应用管理）" },
            ]} />
          </Form.Item>
          <Form.Item label="过期时间（可选）" name="expires_at">
            <DatePicker style={{ width: "100%" }} placeholder="不填则永不过期" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量创建标注账号 */}
      <Modal
        title="批量创建标注账号"
        open={batchOpen}
        onCancel={() => { setBatchOpen(false); batchForm.resetFields(); }}
        onOk={() => batchForm.submit()}
        okText="批量创建"
        okButtonProps={{ style: { background: "#000", borderColor: "#000" } }}
      >
        <Form form={batchForm} onFinish={handleBatchCreate} layout="vertical">
          <Form.Item
            label="项目名称"
            name="project_name"
            rules={[{ required: true, message: "请输入项目名称" }]}
            extra="用户名将生成为：项目名称_001, 项目名称_002, ..."
          >
            <Input placeholder="例如：AI标注2024" />
          </Form.Item>
          <Form.Item label="起始序号" name="start_index" initialValue={1}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            label="创建数量"
            name="count"
            rules={[{ required: true, message: "请输入数量" }]}
          >
            <InputNumber min={1} max={200} style={{ width: "100%" }} placeholder="最多200个" />
          </Form.Item>
          <Form.Item
            label="统一密码"
            name="password"
            rules={[{ required: true, min: 6, message: "密码至少6位" }]}
          >
            <Input.Password placeholder="所有账号使用相同密码" />
          </Form.Item>
          <Form.Item label="过期时间（可选）" name="expires_at">
            <DatePicker style={{ width: "100%" }} placeholder="不填则永不过期" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量创建结果 */}
      <Modal
        title={`批量创建成功 — 共 ${batchResult.length} 个账号`}
        open={batchResultOpen}
        onCancel={() => setBatchResultOpen(false)}
        footer={<Button onClick={() => setBatchResultOpen(false)}>关闭</Button>}
        width={500}
      >
        <div style={{ maxHeight: 400, overflow: "auto" }}>
          <Table
            rowKey="id"
            dataSource={batchResult}
            size="small"
            pagination={false}
            columns={[
              { title: "用户名", dataIndex: "username" },
              {
                title: "过期时间",
                dataIndex: "expires_at",
                render: (v?: string) => v ? dayjs(v).format("YYYY-MM-DD") : "永不过期",
              },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
}
