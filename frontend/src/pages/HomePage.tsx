import { useState, useCallback, useEffect, useRef } from "react";
import { Typography, Button, Input, Row, Col, Card, Space, Alert, Tag, Modal, Badge, Progress } from "antd";
import { 
  CopyOutlined, 
  ClearOutlined, 
  FileTextOutlined, 
  EyeOutlined, 
  EyeInvisibleOutlined, 
  AudioMutedOutlined, 
  PauseCircleOutlined, 
  PlayCircleOutlined, 
  SoundOutlined,
  CodeOutlined,
  CheckCircleFilled,
  ThunderboltOutlined,
  ArrowDownOutlined
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";

const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;

// 默认系统提示词模板
const DEFAULT_SYSTEM_PROMPT_TEMPLATE = `# 角色定位
你是一位专业的 Streamlit 应用开发工程师，专门为企业内部工具平台开发数据处理类 Web 应用。

# 任务目标
根据用户提供的具体需求，生成一个完整的、可直接部署到内部工具平台的 Streamlit 应用。

---

## 技术要求

### 文件结构
- app.py - Streamlit 主入口
- requirements.txt - Python 依赖

### 禁止事项
- 禁止生成 Dockerfile
- 禁止使用 calamine，Excel 用 openpyxl
- 禁止 Windows 专用包
- 禁止硬编码 localhost
- 禁止写死绝对路径
- 禁止抛出红色 Traceback

### 路径规范
\`\`\`python
BASE_DIR = Path(__file__).parent
DATA_DIR = Path("/app/data")
\`\`\`

### 错误处理
所有异常必须捕获并用 st.error() 展示`;

// 示例需求
const EXAMPLE_REQUIREMENT = `工具名称：CSV 数据清洗工具

业务背景：
日常需要处理各系统导出的 CSV 数据，存在格式不统一、空值、重复等问题。

输入：
- CSV 文件（单文件，必填）
- 去重键：默认"id"
- 保留策略：first/last
- 去除空值行：是/否

处理逻辑：
1. 自动检测编码（utf-8/gbk）
2. 按指定键去重
3. 删除空值行
4. 生成处理报告

输出：
- 清洗后的 CSV 文件
- 处理摘要统计
- 数据预览表格`;

// 科技蓝配色
const theme = {
  primary: '#165DFF',
  primaryLight: '#E8F3FF',
  primaryHover: '#4080FF',
  success: '#00B42A',
  warning: '#FF7D00',
  textPrimary: '#1D2129',
  textSecondary: '#4E5969',
  textTertiary: '#86909C',
  border: '#E5E6EB',
  bg: '#F2F3F5',
  cardBg: '#FFFFFF',
  shadow: '0 4px 20px rgba(22, 93, 255, 0.08)',
  shadowHover: '0 8px 32px rgba(22, 93, 255, 0.12)',
};

// Web Speech API 类型声明
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export default function HomePage() {
  const [userRequirement, setUserRequirement] = useState<string>("");
  const [copySuccess, setCopySuccess] = useState<boolean | null>(null);
  const [copyMessage, setCopyMessage] = useState<string>("");
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<boolean>(false);
  const [systemTemplate, setSystemTemplate] = useState<string>(DEFAULT_SYSTEM_PROMPT_TEMPLATE);
  
  // 语音识别状态
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);

  // 从 localStorage 加载系统模板
  useEffect(() => {
    const saved = localStorage.getItem("system_prompt_template");
    if (saved) {
      setSystemTemplate(saved);
    }
  }, []);

  // 检查浏览器是否支持语音识别
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // 初始化语音识别
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setUserRequirement(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setCopySuccess(false);
        setCopyMessage('无法访问麦克风，请检查浏览器权限设置');
        setCopyError(true);
      }
      setIsRecording(false);
      setIsPaused(false);
    };

    recognition.onend = () => {
      if (isRecording && !isPaused) {
        try { recognition.start(); } catch (e) { setIsRecording(false); }
      }
    };

    return recognition;
  }, [isRecording, isPaused]);

  const startRecording = useCallback(() => {
    if (!speechSupported) {
      setCopyMessage('当前浏览器不支持语音识别功能，请使用 Chrome、Edge 或 Safari');
      setCopyError(true);
      return;
    }
    const recognition = initSpeechRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
        setIsRecording(true);
        setIsPaused(false);
      } catch (e) {}
    }
  }, [speechSupported, initSpeechRecognition]);

  const pauseRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsPaused(true);
    }
  }, [isRecording]);

  const resumeRecording = useCallback(() => {
    if (recognitionRef.current && isPaused) {
      try {
        recognitionRef.current.start();
        setIsPaused(false);
      } catch (e) {}
    }
  }, [isPaused]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const generateFullPrompt = useCallback((): string => {
    if (!userRequirement.trim()) return systemTemplate;
    return `${systemTemplate}\n\n---\n\n# 用户具体需求\n\n${userRequirement.trim()}`;
  }, [userRequirement, systemTemplate]);

  const handleCopy = useCallback(async () => {
    try {
      const fullPrompt = generateFullPrompt();
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullPrompt);
        setCopySuccess(true);
        setCopyMessage("已复制到剪贴板！");
        setCopyError(false);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = fullPrompt;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (successful) {
          setCopySuccess(true);
          setCopyMessage("已复制到剪贴板！");
          setCopyError(false);
        } else {
          throw new Error("Copy failed");
        }
      }
      setTimeout(() => { setCopySuccess(null); setCopyMessage(""); }, 3000);
    } catch (error) {
      setCopySuccess(false);
      setCopyMessage("当前环境无法自动复制，请在下方预览区手动复制");
      setCopyError(true);
      setShowPreview(true);
    }
  }, [generateFullPrompt]);

  const handleClear = useCallback(() => {
    setUserRequirement("");
    setCopySuccess(null);
    setCopyMessage("");
    setCopyError(false);
  }, []);

  const handleFillExample = useCallback(() => {
    setUserRequirement(EXAMPLE_REQUIREMENT);
    setCopySuccess(null);
    setCopyMessage("");
    setCopyError(false);
  }, []);

  // 字数统计颜色
  const getCharCountColor = (count: number) => {
    if (count === 0) return theme.textTertiary;
    if (count < 50) return theme.warning;
    if (count < 500) return theme.success;
    return theme.primary;
  };

  return (
    <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto", fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* 顶部标题区 - 大量留白 */}
      <div style={{ textAlign: "center", padding: "40px 0 32px" }}>
        <Title level={2} style={{ 
          margin: 0, 
          color: theme.textPrimary, 
          fontSize: 28, 
          fontWeight: 700,
          letterSpacing: '-0.5px'
        }}>
          AI 编程提示词生成器
        </Title>
        
        {/* 重点提示文字 - 突出显示 */}
        <div style={{
          marginTop: 20,
          padding: "16px 32px",
          background: `linear-gradient(135deg, ${theme.primaryLight} 0%, #FFFFFF 100%)`,
          border: `2px solid ${theme.primary}`,
          borderRadius: 12,
          display: "inline-block",
          boxShadow: '0 4px 16px rgba(22, 93, 255, 0.15)',
        }}>
          <Space size={12} align="center">
            <ThunderboltOutlined style={{ fontSize: 24, color: theme.primary }} />
            <Text style={{ 
              fontSize: 16, 
              color: theme.textPrimary, 
              fontWeight: 500,
              margin: 0 
            }}>
              在下方填写你的需求，点击
              <Tag color="blue" style={{ margin: '0 4px', fontWeight: 600 }}>复制完整提示词</Tag>
              后，粘贴到 Comate 中即可生成应用
            </Text>
          </Space>
        </div>
      </div>

      {/* 提示消息 */}
      {copySuccess !== null && (
        <Alert
          message={copyMessage}
          type={copySuccess ? "success" : copyError ? "warning" : "info"}
          showIcon
          closable
          onClose={() => setCopySuccess(null)}
          style={{ 
            marginBottom: 20, 
            borderRadius: 8,
            animation: 'slideDown 0.3s ease'
          }}
        />
      )}

      {/* 语音录制状态条 */}
      {isRecording && (
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
              width: 10, 
              height: 10, 
              borderRadius: '50%',
              backgroundColor: isPaused ? theme.warning : theme.success,
              animation: isPaused ? 'none' : 'pulse 2s infinite'
            }} />
            <Text strong style={{ color: isPaused ? '#D25F00' : '#00B42A', fontSize: 14 }}>
              {isPaused ? '语音识别已暂停' : '正在语音识别中...说出你的需求'}
            </Text>
          </Space>
          <Space>
            {isPaused ? (
              <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={resumeRecording}>
                继续
              </Button>
            ) : (
              <Button size="small" icon={<PauseCircleOutlined />} onClick={pauseRecording}>
                暂停
              </Button>
            )}
            <Button size="small" danger icon={<AudioMutedOutlined />} onClick={stopRecording}>
              结束
            </Button>
          </Space>
        </div>
      )}

      <Row gutter={[24, 24]}>
        {/* 左侧：系统提示词模板 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space size={10}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: theme.primaryLight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileTextOutlined style={{ fontSize: 16, color: theme.primary }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, color: theme.textPrimary }}>
                  系统提示词模板
                </span>
              </Space>
            }
            extra={
              <Button
                type="link"
                style={{ color: theme.primary }}
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(systemTemplate).then(() => {
                    setCopySuccess(true);
                    setCopyMessage("系统模板已复制！");
                    setTimeout(() => setCopySuccess(null), 2000);
                  });
                }}
              >
                复制模板
              </Button>
            }
            styles={{ body: { padding: 0 } }}
            style={{ 
              borderRadius: 12, 
              boxShadow: theme.shadow,
              border: `1px solid ${theme.border}`,
              overflow: 'hidden'
            }}
            bodyStyle={{ padding: 0 }}
          >
            <div
              style={{
                maxHeight: "320px",
                overflow: "auto",
                padding: "20px",
                backgroundColor: '#FAFBFC',
              }}
            >
              <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.7, color: theme.textSecondary }}>
                <ReactMarkdown>{systemTemplate}</ReactMarkdown>
              </div>
            </div>
          </Card>
        </Col>

        {/* 右侧：我的需求 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space size={10}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: theme.primaryLight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CodeOutlined style={{ fontSize: 16, color: theme.primary }} />
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
                    onClick={startRecording}
                    style={{ borderColor: theme.primary, color: theme.primary }}
                  >
                    语音输入
                  </Button>
                )}
                <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>
                  清空
                </Button>
                <Button 
                  size="small" 
                  type="primary" 
                  ghost 
                  onClick={handleFillExample}
                  style={{ borderColor: theme.primary, color: theme.primary }}
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
            {/* 引导标签 */}
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Tag color="default" style={{ cursor: 'pointer' }} onClick={() => setUserRequirement(v => v + '\n工具名称：')}>
                + 工具名称
              </Tag>
              <Tag color="default" style={{ cursor: 'pointer' }} onClick={() => setUserRequirement(v => v + '\n业务背景：')}>
                + 业务背景
              </Tag>
              <Tag color="default" style={{ cursor: 'pointer' }} onClick={() => setUserRequirement(v => v + '\n输入：')}>
                + 输入
              </Tag>
              <Tag color="default" style={{ cursor: 'pointer' }} onClick={() => setUserRequirement(v => v + '\n处理逻辑：')}>
                + 处理逻辑
              </Tag>
              <Tag color="default" style={{ cursor: 'pointer' }} onClick={() => setUserRequirement(v => v + '\n输出：')}>
                + 输出
              </Tag>
            </div>

            <TextArea
              value={userRequirement}
              onChange={(e) => setUserRequirement(e.target.value)}
              placeholder={`请描述你的需求，例如：

我想做一个 CSV 数据清洗工具，用于去除重复数据...

你可以点击上方标签快速添加结构，或直接输入内容`}
              rows={10}
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                resize: "vertical",
                minHeight: "200px",
                borderRadius: 8,
                borderColor: userRequirement.length > 0 ? theme.primary : theme.border,
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
                  {userRequirement.length === 0 ? '开始输入你的需求' : 
                   userRequirement.length < 50 ? '建议多写一些细节' : 
                   userRequirement.length < 500 ? '内容不错，继续完善' : '内容很详细！'}
                </Text>
              </Space>
              <Space>
                <Progress 
                  percent={Math.min((userRequirement.length / 500) * 100, 100)} 
                  size="small" 
                  strokeColor={getCharCountColor(userRequirement.length)}
                  showInfo={false}
                  style={{ width: 60 }}
                />
                <Text style={{ 
                  fontSize: 14, 
                  fontWeight: 600,
                  color: getCharCountColor(userRequirement.length)
                }}>
                  {userRequirement.length} 字
                </Text>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 底部操作区 - 突出显示 */}
      <div style={{ 
        marginTop: 32, 
        padding: "32px",
        background: `linear-gradient(135deg, ${theme.primaryLight} 0%, #FFFFFF 50%, ${theme.primaryLight} 100%)`,
        borderRadius: 16,
        textAlign: "center",
        border: `2px dashed ${theme.primary}`,
      }}>
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <Space size={16}>
            <Button
              type="primary"
              size="large"
              icon={copySuccess ? <CheckCircleFilled /> : <CopyOutlined />}
              onClick={handleCopy}
              style={{ 
                minWidth: 200, 
                height: 48, 
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 8,
                background: copySuccess ? theme.success : theme.primary,
                boxShadow: '0 4px 16px rgba(22, 93, 255, 0.3)',
                transition: 'all 0.3s'
              }}
            >
              {copySuccess ? '已复制！' : '复制完整提示词'}
            </Button>
            <Button
              size="large"
              icon={showPreview ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => setShowPreview(!showPreview)}
              style={{ 
                height: 48, 
                fontSize: 15,
                borderRadius: 8,
                minWidth: 120,
                borderColor: theme.border,
                color: theme.textSecondary
              }}
            >
              {showPreview ? "隐藏预览" : "展开预览"}
            </Button>
          </Space>
          
          <Text type="secondary" style={{ fontSize: 13, color: theme.textTertiary }}>
            复制提示词后，打开 Comate 粘贴即可生成 Streamlit 应用
          </Text>
        </Space>
      </div>

      {/* 预览弹窗 */}
      <Modal
        title={
          <Space>
            <EyeOutlined style={{ color: theme.primary }} />
            <span style={{ fontWeight: 600 }}>完整提示词预览</span>
          </Space>
        }
        open={showPreview}
        onCancel={() => setShowPreview(false)}
        width={900}
        footer={
          <Space>
            <Button onClick={() => setShowPreview(false)}>
              关闭
            </Button>
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={() => {
                handleCopy();
                setShowPreview(false);
              }}
              style={{ background: theme.primary }}
            >
              复制并关闭
            </Button>
          </Space>
        }
      >
        <TextArea
          value={generateFullPrompt()}
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
