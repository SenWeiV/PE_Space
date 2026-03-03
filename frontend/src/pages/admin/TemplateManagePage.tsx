import { useState, useEffect } from "react";
import { Typography, Button, Input, Card, Space, Alert, Tabs, Modal, Tag } from "antd";
import { SaveOutlined, ReloadOutlined, EyeOutlined, HistoryOutlined, ExclamationCircleFilled } from "@ant-design/icons";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { confirm } = Modal;

// 默认系统提示词模板
const DEFAULT_TEMPLATE = `# 角色定位
你是一位专业的 Streamlit 应用开发工程师，专门为企业内部工具平台开发数据处理类 Web 应用。

# 任务目标
根据用户提供的具体需求，生成一个完整的、可直接部署到内部工具平台的 Streamlit 应用...
`;

// 模板版本历史（模拟数据，实际应从后端获取）
interface TemplateVersion {
  id: string;
  content: string;
  updatedAt: string;
  updatedBy: string;
  description: string;
}

const MOCK_HISTORY: TemplateVersion[] = [
  {
    id: "1",
    content: DEFAULT_TEMPLATE,
    updatedAt: "2024-01-15 10:30:00",
    updatedBy: "admin",
    description: "初始版本",
  },
];

export default function TemplateManagePage() {
  const [template, setTemplate] = useState<string>("");
  const [originalTemplate, setOriginalTemplate] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("edit");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<TemplateVersion | null>(null);

  // 加载模板（实际应从后端 API 获取）
  useEffect(() => {
    // 模拟从 localStorage 或 API 加载
    const saved = localStorage.getItem("system_prompt_template");
    const initialTemplate = saved || DEFAULT_TEMPLATE;
    setTemplate(initialTemplate);
    setOriginalTemplate(initialTemplate);
  }, []);

  // 检查是否有更改
  useEffect(() => {
    setHasChanges(template !== originalTemplate);
  }, [template, originalTemplate]);

  // 保存模板
  const handleSave = () => {
    confirm({
      title: "确认保存修改？",
      icon: <ExclamationCircleFilled />,
      content: "修改后的模板将立即生效，影响所有用户生成的提示词。",
      onOk() {
        // 实际应调用后端 API 保存
        localStorage.setItem("system_prompt_template", template);
        setOriginalTemplate(template);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      },
    });
  };

  // 重置为默认
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

  // 查看历史版本
  const handleViewVersion = (version: TemplateVersion) => {
    setSelectedVersion(version);
    setPreviewVisible(true);
  };

  // 恢复到某个版本
  const handleRestoreVersion = (version: TemplateVersion) => {
    confirm({
      title: "确认恢复此版本？",
      icon: <ExclamationCircleFilled />,
      content: `将恢复到 ${version.updatedAt} 的版本，当前编辑内容将被覆盖。`,
      onOk() {
        setTemplate(version.content);
        setActiveTab("edit");
      },
    });
  };

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>系统提示词模板管理</Title>
        <Paragraph type="secondary" style={{ margin: "8px 0 0 0" }}>
          管理 AI 编程提示词生成器中使用的系统提示词模板。修改后将影响所有用户生成的提示词。
        </Paragraph>
      </div>

      {/* 提示消息 */}
      {saveSuccess && (
        <Alert
          message="保存成功！模板已更新。"
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

      {/* 标签页 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="编辑模板" key="edit">
          <Card
            title={
              <Space>
                <span>提示词模板内容</span>
                <Tag color="red">管理员可见</Tag>
              </Space>
            }
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置默认
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  disabled={!hasChanges}
                >
                  保存修改
                </Button>
              </Space>
            }
          >
            <TextArea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={30}
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                lineHeight: 1.6,
              }}
              placeholder="请输入系统提示词模板内容..."
            />

            <div style={{ marginTop: 16, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <strong>提示：</strong>
                此模板将作为系统提示词的基础内容，与用户填写的需求拼接后生成完整提示词。
                支持 Markdown 格式。修改后所有用户都将使用新模板。
              </Text>
            </div>
          </Card>
        </TabPane>

        <TabPane tab="预览效果" key="preview">
          <Card title="模板预览">
            <div
              style={{
                padding: 20,
                background: "#f6ffed",
                borderRadius: 8,
                maxHeight: 600,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {template}
            </div>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <Space>
              <HistoryOutlined />
              版本历史
            </Space>
          }
          key="history"
        >
          <Card title="模板版本历史">
            <Space direction="vertical" style={{ width: "100%" }}>
              {MOCK_HISTORY.map((version) => (
                <Card
                  key={version.id}
                  size="small"
                  style={{ marginBottom: 8 }}
                  actions={[
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => handleViewVersion(version)}
                    >
                      查看
                    </Button>,
                    <Button
                      type="link"
                      onClick={() => handleRestoreVersion(version)}
                    >
                      恢复此版本
                    </Button>,
                  ]}
                >
                  <Space direction="vertical" size={0}>
                    <Text strong>{version.description}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      更新于 {version.updatedAt} · 操作人: {version.updatedBy}
                    </Text>
                  </Space>
                </Card>
              ))}

              <Text type="secondary" style={{ textAlign: "center", marginTop: 16 }}>
                仅显示最近 20 个版本历史
              </Text>
            </Space>
          </Card>
        </TabPane>
      </Tabs>

      {/* 版本详情弹窗 */}
      <Modal
        title="版本详情"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
          <Button
            key="restore"
            type="primary"
            onClick={() => {
              if (selectedVersion) {
                handleRestoreVersion(selectedVersion);
                setPreviewVisible(false);
              }
            }}
          >
            恢复此版本
          </Button>,
        ]}
        width={800}
      >
        {selectedVersion && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">
                版本: {selectedVersion.description} · 更新时间: {selectedVersion.updatedAt}
              </Text>
            </div>
            <div
              style={{
                padding: 16,
                background: "#f5f5f5",
                borderRadius: 6,
                maxHeight: 400,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                fontSize: 13,
              }}
            >
              {selectedVersion.content}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
