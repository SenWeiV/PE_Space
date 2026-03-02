import { PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import client from "@/api/client";
import type { User } from "@/api/auth";
import dayjs from "dayjs";

export default function UserManagePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    const res = await client.get<User[]>("/admin/users");
    setUsers(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await client.post("/admin/users", values);
      message.success("创建成功");
      setCreateOpen(false);
      form.resetFields();
      fetchUsers();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "创建失败");
    }
  };

  const handleToggleActive = async (user: User) => {
    await client.put(`/admin/users/${user.id}`, { is_active: !user.is_active });
    message.success(user.is_active ? "已禁用" : "已启用");
    fetchUsers();
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "用户名", dataIndex: "username" },
    {
      title: "角色",
      dataIndex: "role",
      render: (r: string) => <Tag color={r === "admin" ? "purple" : "blue"}>{r}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "is_active",
      render: (v: boolean) => <Tag color={v ? "green" : "red"}>{v ? "正常" : "禁用"}</Tag>,
    },
    {
      title: "注册时间",
      dataIndex: "created_at",
      render: (v: string) => dayjs(v).format("YYYY-MM-DD"),
    },
    {
      title: "操作",
      render: (_: any, record: User) => (
        <Button size="small" onClick={() => handleToggleActive(record)}>
          {record.is_active ? "禁用" : "启用"}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>用户管理</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          创建用户
        </Button>
      </div>

      <Table rowKey="id" dataSource={users} columns={columns} loading={loading} />

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
            <Select options={[{ value: "user", label: "普通用户" }, { value: "admin", label: "管理员" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
