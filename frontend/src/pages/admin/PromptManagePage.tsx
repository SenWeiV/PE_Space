import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, Modal, Popconfirm, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { createPrompt, deletePrompt, listPrompts, updatePrompt, type Prompt } from "@/api/prompts";

export default function PromptManagePage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [form] = Form.useForm();

  const fetchPrompts = async () => {
    setLoading(true);
    const res = await listPrompts();
    setPrompts(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchPrompts(); }, []);

  const openCreate = () => {
    setEditingPrompt(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (p: Prompt) => {
    setEditingPrompt(p);
    form.setFieldsValue(p);
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingPrompt) {
        await updatePrompt(editingPrompt.id, values);
        message.success("已更新");
      } else {
        await createPrompt(values);
        message.success("已创建");
      }
      setModalOpen(false);
      fetchPrompts();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "操作失败");
    }
  };

  const handleDelete = async (id: number) => {
    await deletePrompt(id);
    message.success("已删除");
    fetchPrompts();
  };

  const columns = [
    { title: "标题", dataIndex: "title" },
    {
      title: "分类",
      dataIndex: "category",
      render: (v: string) => v ? <Tag>{v}</Tag> : "-",
    },
    { title: "排序", dataIndex: "sort_order", width: 80 },
    {
      title: "内容预览",
      dataIndex: "content",
      render: (v: string) => (
        <span style={{ color: "#999" }}>{v.slice(0, 60)}{v.length > 60 ? "..." : ""}</span>
      ),
    },
    {
      title: "操作",
      render: (_: any, record: Prompt) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Prompt 管理</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增 Prompt
        </Button>
      </div>

      <Table rowKey="id" dataSource={prompts} columns={columns} loading={loading} />

      <Modal
        title={editingPrompt ? "编辑 Prompt" : "新增 Prompt"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item label="标题" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="分类" name="category">
            <Input placeholder="如：编码辅助、数据分析..." />
          </Form.Item>
          <Form.Item label="排序（数字越小越靠前）" name="sort_order" initialValue={0}>
            <Input type="number" />
          </Form.Item>
          <Form.Item label="内容" name="content" rules={[{ required: true }]}>
            <Input.TextArea rows={8} placeholder="Prompt 正文..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
