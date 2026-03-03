import { useState, useEffect } from "react";
import { Typography, Button, Input, Card, Space, Alert, Tabs, Modal, Tag, Timeline, Avatar } from "antd";
import { SaveOutlined, ReloadOutlined, EyeOutlined, HistoryOutlined, ExclamationCircleFilled, EditOutlined, UserOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/store/authStore";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { confirm } = Modal;

const DEFAULT_TEMPLATE = `# 角色定位
你是一位专业的 Streamlit 应用开发工程师，专门为企业内部工具平台开发数据处理类 Web 应用。

# 任务目标
根据用户提供的具体需求，生成一个完整的、可直接部署到内部工具平台的 Streamlit 应用。该应用必须满足以下所有技术规范，确保能够无缝集成到平台并稳定运行。

# 平台背景
- 这是一个类似 HuggingFace Spaces 的内部工具托管平台
- 用户上传包含 app.py 和 requirements.txt 的 zip 包即可部署
- 平台自动注入 Dockerfile，无需手动提供
- 应用需支持多人同时使用，数据隔离且可重复运行
- 部署路径：/app，持久化数据目录：/app/data（已挂载到宿主机）`;

interface TemplateHistory {
  id: string;
  content: string;
  updatedAt: string;
  updatedBy: string;
  adminName: string;
  changeDescription: string;
}

export default function TemplateManagePage() {
  const { user } = useAuthStore();
  const [template, setTemplate] = useState<string>("");
  const [originalTemplate, setOriginalTemplate] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("edit");
  const [history, setHistory] = useState<TemplateHistory[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("system_prompt_template");
    const initialTemplate = saved || DEFAULT_TEMPLATE;
    setTemplate(initialTemplate);
    setOriginalTemplate(initialTemplate);

    const savedHistory = localStorage.getItem("template_history");
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    } else {
      const initialHistory: TemplateHistory[] = [
        {
          id: "1",
          content: DEFAULT_TEMPLATE,
          updatedAt: "2024-03-01 10:00:00",
          updatedBy: "system",
          adminName: "系统初始版本",
          changeDescription: "系统默认模板",
        },
      ];
      setHistory(initialHistory);
      localStorage.setItem("template_history", JSON.stringify(initialHistory));
    }
  }, []);

  useEffect(() => {
    setHasChanges(template !== originalTemplate);
  }, [template, originalTemplate]);

  const handleSave = () => {
    confirm({
      title: "确认保存修改？",
      icon: <ExclamationCircleFilled />,
      content: `修改后的模板将立即生效，影响所有用户生成的提示词。\n\n当前管理员：${user?.username || "unknown"}`,
      onOk() {
        localStorage.setItem("system_prompt_template", template);
        const newHistoryItem: TemplateHistory = {
          id: Date.now().toString(),
          content: template,
          updatedAt: new Date().toLocaleString("zh-CN"),
          updatedBy: user?.username || "unknown",
          adminName: user?.username || "unknown",
          changeDescription: "管理员手动修改",
        };
        const updatedHistory = [newHistoryItem, ...history].slice(0, 20);
        setHistory(updatedHistory);
        localStorage.setItem("template_history", JSON.stringify(updatedHistory));
        setOriginalTemplate(template);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      },
    });
  };

  const handleReset = () => {
    confirm({
      title: "确认重置为默认模板？",
      icon: <ExclamationCircleFilled />,
      content: "当前编辑的内容将丢失，恢复为系统默认模板。",
      onOk() {
        setTemplate(DEFAULT_TEMPLATE);
      },
    });
  };

  const handleRestoreVersion = (record: TemplateHistory) => {
    confirm({
      title: "确认恢复此版本？",
      icon: <ExclamationCircleFilled />,
      content: `将恢复到 ${record.updatedAt} 的版本（管理员：${record.adminName}），当前编辑内容将被覆盖。`,
      onOk() {
        setTemplate(record.content);
        setActiveTab("edit");
      },
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>系统提示词模板管理</Title>
        <Paragraph type="secondary" style={{ margin: "8px 0 0 0" }}>
          管理首页使用的系统提示词模板。修改后将影响所有用户在首页生成的提示词。
          <Tag color="red" style={{ marginLeft: 8 }}>仅管理员可操作</Tag>
        </Paragraph>
      </div>

      {saveSuccess && (
        <Alert
          message="保存成功！模板已更新，所有用户将使用新版本。"
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
            <Button size="small" type="primary" onClick={handleSave}>
              立即保存
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Card size="small" style={{ marginBottom: 16, background: "#f6ffed" }}>
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: "#52c41a" }} />
          <div>
            <Text strong>当前管理员：</Text>
            <Text>{user?.username || "unknown"}</Text>
          </div>
          <div style={{ marginLeft: 24 }}>
            <Text strong>最后修改时间：</Text>
            <Text>{history[0]?.updatedAt || "-"}</Text>
          </div>
          <div style={{ marginLeft: 24 }}>
            <Text strong>最后修改人：</Text>
            <Text>{history[0]?.adminName || "-"}</Text>
          </div>
        </Space>
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={<Space><EditOutlined />编辑模板</Space>} key="edit">
          <Card
            title="系统提示词模板内容"
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>重置默认</Button>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} disabled={!hasChanges}>
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
              placeholder="请输入系统提示词模板内容..."
            />
            <div style={{ marginTop: 16, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <strong>提示：</strong>此模板将作为首页系统提示词的基础内容，与用户填写的需求拼接后生成完整提示词。支持 Markdown 格式。修改后立即生效，请谨慎操作。
              </Text>
            </div>
          </Card>
        </TabPane>

        <TabPane tab={<Space><EyeOutlined />预览效果</Space>} key="preview">
          <Card title="模板预览">
            <div style={{
              padding: 20, background: "#f6ffed", borderRadius: 8,
              maxHeight: 600, overflow: "auto", whiteSpace: "pre-wrap",
              fontFamily: "monospace", fontSize: 13, lineHeight: 1.6,
            }}>
              {template}
            </div>
          </Card>
        </TabPane>

        <TabPane tab={<Space><HistoryOutlined />修改历史</Space>} key="history">
          <Card title="模板修改历史记录">
            <Timeline mode="left">
              {history.map((record, index) => (
                <Timeline.Item
                  key={record.id}
                  label={<div style={{ color: "#8c8c8c", fontSize: 12 }}>{record.updatedAt}</div>}
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
                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                      <Space>
                        <Avatar
                          size="small"
                          icon={<UserOutlined />}
                          style={{ backgroundColor: index === 0 ? "#52c41a" : "#bfbfbf" }}
                        />
                        <Text strong>{record.adminName}</Text>
                        {index === 0 && <Tag color="success">当前版本</Tag>}
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>{record.changeDescription}</Text>
                    </Space>
                  </Card>
                </Timeline.Item>
              ))}
            </Timeline>
            {history.length === 0 && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Text type="secondary">暂无修改历史</Text>
              </div>
            )}
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
}
