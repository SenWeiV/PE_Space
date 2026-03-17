import { InboxOutlined } from "@ant-design/icons";
import { Form, Input, Modal, Steps, Upload, message, Alert } from "antd";
import { useState, useEffect } from "react";
import { createApp, deployApp, uploadZip } from "@/api/apps";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  // 传入则为「更新」模式，跳过第一步直接上传
  targetApp?: { id: number; name: string };
}

export default function UploadModal({ open, onClose, onSuccess, targetApp }: Props) {
  const isUpdateMode = !!targetApp;
  const [step, setStep] = useState(isUpdateMode ? 1 : 0);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [createdAppId, setCreatedAppId] = useState<number | null>(isUpdateMode ? targetApp.id : null);
  const [zipFile, setZipFile] = useState<File | null>(null);

  // 模式切换时重置
  useEffect(() => {
    if (open) {
      setStep(isUpdateMode ? 1 : 0);
      setCreatedAppId(isUpdateMode ? targetApp!.id : null);
      setZipFile(null);
      form.resetFields();
    }
  }, [open, isUpdateMode]);

  const handleClose = () => {
    form.resetFields();
    setStep(isUpdateMode ? 1 : 0);
    setCreatedAppId(isUpdateMode ? targetApp!.id : null);
    setZipFile(null);
    onClose();
  };

  // Step 1: 创建 App 元数据（仅新建模式）
  const handleStep1 = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      const res = await createApp(values);
      setCreatedAppId(res.data.id);
      setStep(1);
    } catch (e: any) {
      message.error(e.response?.data?.detail || "创建失败");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: 上传 zip
  const handleStep2 = async () => {
    if (!zipFile || !createdAppId) return;
    setLoading(true);
    try {
      await uploadZip(createdAppId, zipFile);
      setStep(2);
    } catch (e: any) {
      message.error(e.response?.data?.detail || "上传失败");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: 确认部署
  const handleDeploy = async () => {
    if (!createdAppId) return;
    setLoading(true);
    try {
      await deployApp(createdAppId);
      message.success(isUpdateMode ? "更新部署已提交，正在重新构建..." : "部署任务已提交，正在构建中...");
      onSuccess();
      handleClose();
    } catch (e: any) {
      message.error(e.response?.data?.detail || "部署失败");
    } finally {
      setLoading(false);
    }
  };

  const steps = isUpdateMode
    ? [{ title: "上传新版本" }, { title: "确认部署" }]
    : [{ title: "基本信息" }, { title: "上传文件" }, { title: "确认部署" }];

  // 映射显示步骤（更新模式 step=1 对应展示第 0 项，step=2 对应展示第 1 项）
  const displayStep = isUpdateMode ? step - 1 : step;

  const okText = step === 0 ? "下一步" : step === 1 ? "上传" : "开始部署";
  const onOk = step === 0 ? handleStep1 : step === 1 ? handleStep2 : handleDeploy;

  return (
    <Modal
      title={isUpdateMode ? `更新工具：${targetApp!.name}` : "上传新工具"}
      open={open}
      onCancel={handleClose}
      onOk={onOk}
      okText={okText}
      cancelText="取消"
      confirmLoading={loading}
      width={560}
    >
      <Steps current={displayStep} items={steps} style={{ marginBottom: 24 }} />

      {step === 0 && (
        <Form form={form} layout="vertical">
          <Form.Item label="工具名称" name="name" rules={[{ required: true, message: "请填写名称" }]}>
            <Input placeholder="如：数据清洗工具" />
          </Form.Item>
          <Form.Item
            label="URL 路径 (slug)"
            name="slug"
            rules={[
              { required: true, message: "请填写 slug" },
              { pattern: /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, message: "只允许小写字母、数字、连字符，长度 3-64" },
            ]}
            extra="只允许小写字母、数字、连字符，如 data-cleaner"
          >
            <Input placeholder="data-cleaner" />
          </Form.Item>
          <Form.Item label="工具描述" name="description">
            <Input.TextArea rows={3} placeholder="简单描述这个工具的用途..." />
          </Form.Item>
        </Form>
      )}

      {step === 1 && (
        <>
          <Alert
            type="info"
            showIcon
            message="zip 包要求"
            description={
              <ul style={{ margin: "4px 0", paddingLeft: 16 }}>
                <li>必须包含 <code>app.py</code>（Streamlit 入口文件）</li>
                <li>必须包含 <code>requirements.txt</code>（依赖列表）</li>
                <li>平台会自动注入 Dockerfile，无需手动提供</li>
              </ul>
            }
            style={{ marginBottom: 16 }}
          />
          {isUpdateMode && (
            <Alert
              type="warning"
              showIcon
              message="上传新版本将覆盖原有代码并重新部署"
              style={{ marginBottom: 16 }}
            />
          )}
          <Upload.Dragger
            accept=".zip"
            maxCount={1}
            beforeUpload={(file) => {
              setZipFile(file);
              return false;
            }}
            onRemove={() => setZipFile(null)}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽 zip 文件到此区域</p>
            <p className="ant-upload-hint">仅支持 .zip 格式</p>
          </Upload.Dragger>
        </>
      )}

      {step === 2 && (
        <Alert
          type="success"
          showIcon
          message="准备就绪"
          description={
            isUpdateMode
              ? "新版本已上传。点击「开始部署」后，平台将停止旧容器并重新构建，完成后工具自动更新。"
              : "文件已上传成功。点击「开始部署」后，平台将在后台构建 Docker 镜像并启动服务，构建约需 1-3 分钟，完成后可在 App 列表中查看状态。"
          }
        />
      )}
    </Modal>
  );
}
