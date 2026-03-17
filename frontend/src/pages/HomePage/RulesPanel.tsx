import { Card, Space } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import { theme } from "./constants";

interface RulesPanelProps {
  systemTemplate: string;
}

export default function RulesPanel({ systemTemplate }: RulesPanelProps) {
  return (
    <Card
      title={
        <Space size={10}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: '#F0F0F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FileTextOutlined style={{ fontSize: 16, color: '#000000' }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 600, color: theme.textPrimary }}>
            代码规范Prompt
          </span>
        </Space>
      }
      styles={{ body: { padding: 0 } }}
      style={{
        borderRadius: 12,
        boxShadow: theme.shadow,
        border: `1px solid ${theme.border}`,
        overflow: 'hidden'
      }}
    >
      <div style={{
        maxHeight: "480px",
        overflow: "auto",
        padding: "20px",
        backgroundColor: '#FAFBFC',
      }}>
        <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.7, color: theme.textSecondary }}>
          <ReactMarkdown>{systemTemplate}</ReactMarkdown>
        </div>
      </div>
    </Card>
  );
}
