import { CopyOutlined } from "@ant-design/icons";
import { Card, Tag, Tooltip, message } from "antd";
import ReactMarkdown from "react-markdown";
import type { Prompt } from "@/api/prompts";

interface Props {
  prompt: Prompt;
}

export default function PromptCard({ prompt }: Props) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      message.success("已复制到剪贴板");
    } catch {
      // fallback for non-HTTPS or older browsers
      const textarea = document.createElement("textarea");
      textarea.value = prompt.content;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      message.success("已复制到剪贴板");
    }
  };

  return (
    <Card
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{prompt.title}</span>
          {prompt.category && <Tag color="blue" style={{ fontSize: 14 }}>{prompt.category}</Tag>}
        </div>
      }
      extra={
        <Tooltip title="复制内容">
          <CopyOutlined
            style={{ cursor: "pointer", color: "#1677ff", fontSize: 18 }}
            onClick={handleCopy}
          />
        </Tooltip>
      }
      style={{ marginBottom: 16 }}
    >
      <div className="prompt-markdown">
        <ReactMarkdown>{prompt.content}</ReactMarkdown>
      </div>
    </Card>
  );
}
