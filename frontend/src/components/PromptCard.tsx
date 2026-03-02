import { CopyOutlined } from "@ant-design/icons";
import { Card, Tag, Tooltip, message } from "antd";
import type { Prompt } from "@/api/prompts";

interface Props {
  prompt: Prompt;
}

export default function PromptCard({ prompt }: Props) {
  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.content).then(() => {
      message.success("已复制到剪贴板");
    });
  };

  return (
    <Card
      size="small"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{prompt.title}</span>
          {prompt.category && <Tag color="blue">{prompt.category}</Tag>}
        </div>
      }
      extra={
        <Tooltip title="复制内容">
          <CopyOutlined
            style={{ cursor: "pointer", color: "#1677ff" }}
            onClick={handleCopy}
          />
        </Tooltip>
      }
      style={{ marginBottom: 16 }}
    >
      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 13,
          lineHeight: 1.6,
          margin: 0,
          fontFamily: "inherit",
          color: "#333",
        }}
      >
        {prompt.content}
      </pre>
    </Card>
  );
}
