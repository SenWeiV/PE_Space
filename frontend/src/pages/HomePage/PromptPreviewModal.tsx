import { Modal, Space, Button, Input } from "antd";
import { EyeOutlined, CopyOutlined } from "@ant-design/icons";

const { TextArea } = Input;

interface PromptPreviewModalProps {
  open: boolean;
  content: string;
  onClose: () => void;
  onCopy: () => void;
}

export default function PromptPreviewModal({ open, content, onClose, onCopy }: PromptPreviewModalProps) {
  return (
    <Modal
      title={
        <Space>
          <EyeOutlined style={{ color: '#000000' }} />
          <span style={{ fontWeight: 600 }}>完整提示词预览</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={900}
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button
            type="primary"
            icon={<CopyOutlined />}
            onClick={() => { onCopy(); onClose(); }}
            style={{ background: '#000000' }}
          >
            复制并关闭
          </Button>
        </Space>
      }
    >
      <TextArea
        value={content}
        readOnly
        rows={20}
        style={{
          fontFamily: "monospace",
          fontSize: 13,
          backgroundColor: '#FAFBFC',
          borderRadius: 8,
          marginTop: 8
        }}
      />
    </Modal>
  );
}
