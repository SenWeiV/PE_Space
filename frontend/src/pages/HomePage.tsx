import { Col, Row, Tabs, Typography, Spin, Empty } from "antd";
import { useEffect, useState } from "react";
import { listCategories, listPrompts, type Prompt } from "@/api/prompts";
import PromptCard from "@/components/PromptCard";

export default function HomePage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listPrompts(), listCategories()]).then(([promptsRes, catsRes]) => {
      setPrompts(promptsRes.data);
      setCategories(catsRes.data);
      setLoading(false);
    });
  }, []);

  const filtered =
    activeCategory === "all" ? prompts : prompts.filter((p) => p.category === activeCategory);

  const tabItems = [
    { key: "all", label: "全部" },
    ...categories.map((c) => ({ key: c, label: c })),
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        AI Coding 说明书
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        这里收录了团队推荐的 Vibe Coding Prompt 模板，点击右上角复制按钮即可使用。
      </Typography.Paragraph>

      <Tabs
        items={tabItems}
        activeKey={activeCategory}
        onChange={setActiveCategory}
        style={{ marginBottom: 16 }}
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin />
        </div>
      ) : filtered.length === 0 ? (
        <Empty description="暂无 Prompt" />
      ) : (
        <Row gutter={[16, 0]}>
          {filtered.map((p) => (
            <Col key={p.id} xs={24} md={12} xl={8}>
              <PromptCard prompt={p} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
