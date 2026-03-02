import { Typography, Spin, Empty } from "antd";
import { useEffect, useState } from "react";
import { listPrompts, type Prompt } from "@/api/prompts";
import PromptCard from "@/components/PromptCard";

export default function HomePage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPrompts().then((res) => {
      setPrompts(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        AI Coding 说明书
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        这里收录了团队推荐的 Vibe Coding Prompt 模板，点击右上角复制按钮即可使用。
      </Typography.Paragraph>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin />
        </div>
      ) : prompts.length === 0 ? (
        <Empty description="暂无 Prompt" />
      ) : (
        <div>
          {prompts.map((p) => (
            <PromptCard key={p.id} prompt={p} />
          ))}
        </div>
      )}
    </div>
  );
}
