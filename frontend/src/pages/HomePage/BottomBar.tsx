import { Space, Button } from "antd";
import { CopyOutlined, EyeOutlined, EyeInvisibleOutlined, CheckCircleFilled } from "@ant-design/icons";
import { theme } from "./constants";

interface BottomBarProps {
  copySuccess: boolean | null;
  showPreview: boolean;
  onCopy: () => void;
  onTogglePreview: () => void;
}

export default function BottomBar({ copySuccess, showPreview, onCopy, onTogglePreview }: BottomBarProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 240,
      right: 0,
      padding: "16px 24px",
      textAlign: "center",
      background: '#fff',
      borderTop: `1px solid ${theme.border}`,
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
      zIndex: 100,
    }}>
      <Space size={16}>
        <Button
          size="large"
          icon={copySuccess ? <CheckCircleFilled /> : <CopyOutlined />}
          onClick={onCopy}
          style={{
            minWidth: 200,
            height: 48,
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 8,
            background: copySuccess ? theme.success : '#000',
            color: '#fff',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s',
            border: 'none'
          }}
        >
          {copySuccess ? '已复制！' : '复制完整提示词'}
        </Button>
        <Button
          size="large"
          icon={showPreview ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={onTogglePreview}
          style={{
            height: 48,
            fontSize: 15,
            borderRadius: 8,
            minWidth: 120,
            borderColor: theme.border,
            color: theme.textSecondary
          }}
        >
          {showPreview ? "隐藏" : "预览"}
        </Button>
      </Space>
    </div>
  );
}
