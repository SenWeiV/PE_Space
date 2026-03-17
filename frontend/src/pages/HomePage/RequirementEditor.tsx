import { Card, Space, Button, Tag, Input, Typography, Progress, Badge } from "antd";
import { ClearOutlined, SoundOutlined, CodeOutlined } from "@ant-design/icons";
import { QUICK_SNIPPETS, theme } from "./constants";

const { TextArea } = Input;
const { Text } = Typography;

interface RequirementEditorProps {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  onFillExample: () => void;
  onStartRecording: () => void;
  isRecording: boolean;
  isPaused: boolean;
  speechSupported: boolean;
}

function getCharCountColor(count: number) {
  if (count === 0) return theme.textTertiary;
  if (count < 50) return theme.warning;
  if (count < 500) return theme.success;
  return '#000000';
}

export default function RequirementEditor({
  value,
  onChange,
  onClear,
  onFillExample,
  onStartRecording,
  isRecording,
  isPaused,
  speechSupported,
}: RequirementEditorProps) {
  return (
    <Card
      title={
        <Space size={10}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: '#F0F0F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <CodeOutlined style={{ fontSize: 16, color: '#000000' }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 600, color: theme.textPrimary }}>
            我的需求
          </span>
        </Space>
      }
      extra={
        <Space>
          {!isRecording && speechSupported && (
            <Button
              size="small"
              icon={<SoundOutlined />}
              onClick={onStartRecording}
              style={{ borderColor: '#000000', color: '#000000' }}
            >
              语音输入
            </Button>
          )}
          <Button size="small" icon={<ClearOutlined />} onClick={onClear}>
            清空
          </Button>
          <Button
            size="small"
            type="primary"
            ghost
            onClick={onFillExample}
            style={{ borderColor: '#000000', color: '#000000' }}
          >
            填入示例
          </Button>
        </Space>
      }
      style={{
        borderRadius: 12,
        boxShadow: theme.shadow,
        border: `1px solid ${theme.border}`
      }}
    >
      {/* 快捷插入 */}
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
          快捷插入技术需求：
        </Text>
        <Space size={6} wrap>
          {QUICK_SNIPPETS.map((s) => (
            <Tag
              key={s.label}
              style={{ cursor: "pointer", padding: "3px 12px", fontSize: 13, borderRadius: 12, userSelect: "none" }}
              onClick={() => onChange(value + s.text)}
            >
              {s.label}
            </Tag>
          ))}
        </Space>
      </div>

      <TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="请在此处描述你的具体需求..."
        rows={10}
        style={{
          fontSize: 15,
          lineHeight: 1.7,
          resize: "vertical",
          minHeight: "200px",
          borderRadius: 8,
          borderColor: value.length > 0 ? '#000000' : theme.border,
        }}
      />

      {/* 字数统计与进度 */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
        paddingTop: 12,
        borderTop: `1px solid ${theme.border}`
      }}>
        <Space>
          {isRecording && !isPaused && (
            <Badge status="processing" text={<span style={{ color: theme.success }}>正在监听...</span>} />
          )}
          <Text type="secondary" style={{ fontSize: 13 }}>
            {value.length === 0 ? '开始输入你的需求' :
             value.length < 50 ? '建议多写一些细节' :
             value.length < 500 ? '内容不错，继续完善' : '内容很详细！'}
          </Text>
        </Space>
        <Space>
          <Progress
            percent={Math.min((value.length / 500) * 100, 100)}
            size="small"
            strokeColor={getCharCountColor(value.length)}
            showInfo={false}
            style={{ width: 60 }}
          />
          <Text style={{ fontSize: 14, fontWeight: 600, color: getCharCountColor(value.length) }}>
            {value.length} 字
          </Text>
        </Space>
      </div>
    </Card>
  );
}
