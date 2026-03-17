import { Space, Button, Typography } from "antd";
import { AudioMutedOutlined, PauseCircleOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { theme } from "./constants";

const { Text } = Typography;

interface SpeechBarProps {
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function SpeechBar({ isPaused, onPause, onResume, onStop }: SpeechBarProps) {
  return (
    <div style={{
      marginBottom: 20,
      padding: '12px 20px',
      backgroundColor: isPaused ? '#FFF7E8' : '#E8FFEA',
      borderRadius: 8,
      border: `1px solid ${isPaused ? '#FFCF8B' : '#86EFAC'}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }}>
      <Space>
        <span style={{
          display: 'inline-block',
          width: 10, height: 10, borderRadius: '50%',
          backgroundColor: isPaused ? theme.warning : theme.success,
          animation: isPaused ? 'none' : 'pulse 2s infinite'
        }} />
        <Text strong style={{ color: isPaused ? '#D25F00' : '#00B42A', fontSize: 14 }}>
          {isPaused ? '语音识别已暂停' : '正在语音识别中...说出你的需求'}
        </Text>
      </Space>
      <Space>
        {isPaused ? (
          <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={onResume}>
            继续
          </Button>
        ) : (
          <Button size="small" icon={<PauseCircleOutlined />} onClick={onPause}>
            暂停
          </Button>
        )}
        <Button size="small" danger icon={<AudioMutedOutlined />} onClick={onStop}>
          结束
        </Button>
      </Space>
    </div>
  );
}
