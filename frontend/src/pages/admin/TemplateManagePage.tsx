import { useState, useEffect } from "react";
import {
  Typography, Button, Card, Space, Alert, Tabs, Modal, Tag, Timeline, Avatar, Spin,
} from "antd";
import { Input } from "antd";
import {
  SaveOutlined, ReloadOutlined, EyeOutlined, HistoryOutlined,
  ExclamationCircleFilled, EditOutlined, UserOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "@/store/authStore";
import { getTemplate, updateTemplate, getTemplateHistory } from "@/api/config";
import type { ConfigOut, ConfigHistoryOut } from "@/api/config";
import dayjs from "dayjs";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { confirm } = Modal;

export default function TemplateManagePage() {
  const { user } = useAuthStore();
  const [config, setConfig] = useState<ConfigOut | null>(null);
  const [template, setTemplate] = useState<string>("");
  const [originalTemplate, setOriginalTemplate] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("edit");
  const [history, setHistory] = useState<ConfigHistoryOut[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchTemplate = async () => {
    setLoading(true);
    try {
      const res = await getTemplate();
      setConfig(res.data);
      setTemplate(res.data.value);
      setOriginalTemplate(res.data.value);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getTemplateHistory();
      setHistory(res.data);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { fetchTemplate(); }, []);

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
  }, [activeTab]);

  useEffect(() => {
    setHasChanges(template !== originalTemplate);
  }, [template, originalTemplate]);

  const handleSave = () => {
    confirm({
      title: "确认保存修改？",
      icon: <ExclamationCircleFilled />,
      content: `修改后的代码规范 Prompt 将立即对所有用户生效。\n当前管理员：${user?.username}`,
      onOk: async () => {
        setSaving(true);
        try {
          const res = await updateTemplate(template);
          setConfig(res.data);
          setOriginalTemplate(template);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleRestoreVersion = (record: ConfigHistoryOut) => {
    confirm({
      title: "确认恢复此版本？",
      icon: <ExclamationCircleFilled />,
      content: `将恢复到 ${dayjs(record.updated_at).format("YYYY-MM-DD HH:mm")} 的版本，当前编辑内容将被覆盖。`,
      onOk() {
        setTemplate(record.value);
        setActiveTab("edit");
      },
    });
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#fafafa",
        padding: "32px 0 20px",
        marginBottom: 4,
        borderBottom: "1px solid #f0f0f0",
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.5px", margin: "0 0 6px" }}>代码规范Prompt</h1>
        <Paragraph type="secondary" style={{ margin: 0, fontSize: 14 }}>
          管理首页使用的代码规范 Prompt。修改后将对所有用户立即生效。
          <Tag color="red" style={{ marginLeft: 8 }}>仅管理员可操作</Tag>
        </Paragraph>
      </div>

      {saveSuccess && (
        <Alert
          message="保存成功！代码规范 Prompt 已更新，所有用户将使用新版本。"
          type="success"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {hasChanges && (
        <Alert
          message="您有未保存的修改"
          type="warning"
          showIcon
          action={
            <Button size="small" type="primary" loading={saving} onClick={handleSave}
              style={{ background: "#000", borderColor: "#000" }}>
              立即保存
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {config && (
        <Card size="small" style={{ marginBottom: 16, background: "#fafafa" }}>
          <Space>
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: "#000" }} />
            <div>
              <Text strong>当前管理员：</Text>
              <Text>{user?.username}</Text>
            </div>
            <div style={{ marginLeft: 24 }}>
              <Text strong>最后更新：</Text>
              <Text>{dayjs(config.updated_at).format("YYYY-MM-DD HH:mm")}</Text>
            </div>
            {config.updater_name && (
              <div style={{ marginLeft: 24 }}>
                <Text strong>最后修改人：</Text>
                <Text>{config.updater_name}</Text>
              </div>
            )}
          </Space>
        </Card>
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab={<Space><EditOutlined />编辑</Space>} key="edit">
          <Card
            title="代码规范Prompt 内容"
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={fetchTemplate}>重新加载</Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  disabled={!hasChanges}
                  loading={saving}
                  style={{ background: "#000", borderColor: "#000" }}
                >
                  保存修改
                </Button>
              </Space>
            }
          >
            <TextArea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={28}
              style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}
              placeholder="请输入代码规范 Prompt 内容..."
            />
            <div style={{ marginTop: 12, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                此内容将作为首页的代码规范 Prompt 基础，与用户填写的需求拼接后生成完整提示词。支持 Markdown 格式。
              </Text>
            </div>
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab={<Space><EyeOutlined />预览</Space>} key="preview">
          <Card title="预览效果">
            <div style={{
              padding: 20, background: "#fafafa", borderRadius: 8,
              maxHeight: 600, overflow: "auto", whiteSpace: "pre-wrap",
              fontFamily: "monospace", fontSize: 13, lineHeight: 1.6,
            }}>
              {template}
            </div>
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab={<Space><HistoryOutlined />修改历史</Space>} key="history">
          <Card title="修改历史">
            <Spin spinning={historyLoading}>
              {history.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <Text type="secondary">暂无修改历史</Text>
                </div>
              ) : (
                <Timeline mode="left">
                  {history.map((record, index) => (
                    <Timeline.Item
                      key={record.id}
                      label={
                        <div style={{ color: "#8c8c8c", fontSize: 12 }}>
                          {dayjs(record.updated_at).format("YYYY-MM-DD HH:mm")}
                        </div>
                      }
                      color={index === 0 ? "green" : "gray"}
                    >
                      <Card
                        size="small"
                        style={{ marginBottom: 8 }}
                        actions={[
                          <Button type="link" size="small" onClick={() => handleRestoreVersion(record)}>
                            恢复此版本
                          </Button>,
                        ]}
                      >
                        <Space>
                          <Avatar
                            size="small"
                            icon={<UserOutlined />}
                            style={{ backgroundColor: index === 0 ? "#000" : "#bfbfbf" }}
                          />
                          <Text strong>{record.updater_name || "未知"}</Text>
                          {index === 0 && <Tag color="default">当前版本</Tag>}
                        </Space>
                      </Card>
                    </Timeline.Item>
                  ))}
                </Timeline>
              )}
            </Spin>
          </Card>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
