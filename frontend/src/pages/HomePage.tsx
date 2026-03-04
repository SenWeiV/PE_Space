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
根据用户提供的具体需求，生成一个完整的、可直接部署到内部工具平台的 Streamlit 应用。该应用必须满足以下所有技术规范，确保能够无缝集成到平台并稳定运行。

# 平台背景
- 这是一个类似 HuggingFace Spaces 的内部工具托管平台
- 用户上传包含 app.py 和 requirements.txt 的 zip 包即可部署
- 平台自动注入 Dockerfile，无需手动提供
- 应用需支持多人同时使用，数据隔离且可重复运行
- 部署路径：/app，持久化数据目录：/app/data（已挂载到宿主机）

---

## 一、文件结构要求（严格限制）

**只能输出两个文件，不允许任何其他文件：**

1. **app.py** - Streamlit 应用主入口
2. **requirements.txt** - Python 依赖列表

> ⚠️ 禁止输出：Dockerfile、配置文件、资源文件、目录结构说明等任何额外内容

---

## 二、技术规范（必须严格遵守）

### 2.1 禁止事项
- ❌ 禁止生成 Dockerfile（平台自动注入）
- ❌ 禁止使用 calamine 包，Excel 读写必须使用 openpyxl
- ❌ 禁止使用任何 Windows 专用包（pywin32、win32com、pythoncom 等）
- ❌ 禁止硬编码 localhost 或 127.0.0.1 的端口
- ❌ 禁止写死绝对路径（如 /Users/xxx、C:\\\\ 等）
- ❌ 禁止将异常直接抛到界面导致红色 Traceback
- ❌ 禁止使用全局可变状态存储用户数据
- ❌ 禁止在代码中包含测试代码、示例数据硬编码

### 2.2 路径规范（强制执行）

\`\`\`python
from pathlib import Path

# 当前脚本所在目录（临时文件、缓存）
BASE_DIR = Path(__file__).parent

# 持久化数据目录（跨部署保留，已挂载到宿主机）
DATA_DIR = Path("/app/data")
DATA_DIR.mkdir(parents=True, exist_ok=True)  # 必须确保目录存在
\`\`\`

### 2.3 错误处理规范（强制执行）
所有可能出错的地方必须捕获异常，使用 st.error() 友好展示：

\`\`\`python
try:
    # 可能出错的操作
    df = pd.read_csv(uploaded_file)
except pd.errors.EmptyDataError:
    st.error("❌ 上传的文件为空，请检查文件内容")
    st.stop()
except pd.errors.ParserError as e:
    st.error(f"❌ 文件解析失败：{str(e)}。请确保文件格式正确")
    st.stop()
except Exception as e:
    st.error(f"❌ 处理出错：{str(e)}")
    st.stop()
\`\`\`

### 2.4 并发与状态管理
- 用户态数据：使用 st.session_state 存储
- 持久化数据：写入 /app/data 目录，考虑并发安全
- 写入操作必须原子化（先写临时文件，再重命名）

---

## 三、Streamlit 代码规范

### 3.1 页面配置（必须是第一行）

\`\`\`python
import streamlit as st

st.set_page_config(
    page_title="工具名称",
    page_icon="📊",
    layout="wide",  # 根据内容选择 wide 或 center
    initial_sidebar_state="collapsed"
)
\`\`\`

### 3.2 页面结构标准

\`\`\`python
# 1. 页面标题和说明
st.title("📊 工具名称")
st.caption("📝 工具用途说明：这个工具用于...")

# 2. 输入区（文件上传、参数配置）
with st.container():
    st.subheader("📥 输入配置")
    # ... 输入组件

# 3. 运行按钮和逻辑
if st.button("▶️ 开始处理", type="primary"):
    with st.spinner("正在处理，请稍候..."):
        # ... 处理逻辑
        pass

# 4. 输出区（结果展示、下载）
if "result" in st.session_state:
    st.subheader("📤 处理结果")
    # ... 结果展示
\`\`\`

### 3.3 耗时操作处理
- 所有耗时操作（文件读取、数据处理）必须用 st.spinner() 包裹
- 批量处理必须显示 st.progress() 进度条

### 3.4 用户交互规范
- 输入校验：必填项检查、格式验证、范围检查
- 友好提示：st.success()、st.info()、st.warning()
- 空数据提示：处理结果为空时明确告知用户
- 结果预览：数据表格使用 st.dataframe()，支持排序和搜索

---

## 四、文件格式处理规范

### 4.1 CSV 文件
- 编码检测：优先 utf-8-sig，失败尝试 gbk、gb2312、latin1
- 提供编码问题友好提示

### 4.2 Excel 文件
- 只使用 openpyxl 引擎
- 读取：pd.read_excel(file, engine="openpyxl")
- 写入：通过 BytesIO 生成下载内容

\`\`\`python
from io import BytesIO

# Excel 写入示例
output = BytesIO()
with pd.ExcelWriter(output, engine="openpyxl") as writer:
    df.to_excel(writer, index=False)
output.seek(0)

st.download_button(
    label="⬇️ 下载 Excel 结果",
    data=output,
    file_name="result.xlsx",
    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)
\`\`\`

---

## 五、代码质量标准

### 5.1 代码结构

\`\`\`python
"""
工具名称：xxx
功能描述：xxx
"""

# ============ 导入区 ============
import streamlit as st
import pandas as pd
from pathlib import Path
from io import BytesIO
import json
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any

# ============ 常量定义 ============
BASE_DIR = Path(__file__).parent
DATA_DIR = Path("/app/data")
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ============ 工具函数 ============
def read_csv_with_encoding(file) -> pd.DataFrame:
    """自动检测编码读取 CSV"""
    # ...

def save_history(record: dict):
    """原子化保存历史记录"""
    # ...

# ============ 核心处理函数 ============
def process_data(
    uploaded_file,
    params: dict
) -> Tuple[Optional[BytesIO], Optional[str], Optional[pd.DataFrame]]:
    """
    处理上传的文件
    
    Args:
        uploaded_file: Streamlit 上传的文件对象
        params: 处理参数字典
    
    Returns:
        (result_bytes, log_text, preview_df)
    """
    # ...

# ============ UI 区域 ============
def render_input_section():
    """渲染输入区"""
    # ...

def render_output_section(result, log, preview):
    """渲染输出区"""
    # ...

# ============ 主程序 ============
if __name__ == "__main__":
    main()
\`\`\`

### 5.2 类型标注
所有函数必须有类型标注，提高代码可维护性。

### 5.3 注释规范
- 模块级文档字符串说明工具用途
- 函数级 docstring 说明参数和返回值
- 关键逻辑行添加简短注释

---

## 六、requirements.txt 规范

\`\`\`
streamlit>=1.30.0
pandas>=2.0.0
openpyxl>=3.1.0
# 其他必要的第三方包（不要写标准库）
\`\`\`

- 必须包含 streamlit>=1.30.0
- 版本使用 >= 而非 ==
- 不写注释行（# 开头的行）
- 不包含标准库（os、json、pathlib 等）

---

## 七、输出格式（严格强制执行）

你只能输出两个代码块，按顺序：

\`\`\`python
# app.py
# [完整代码内容]
\`\`\`

\`\`\`
# requirements.txt
# [依赖列表]
\`\`\`

**绝对禁止：**
- 输出解释性文字
- 输出文件树结构
- 输出第三个代码块
- 输出 Docker 相关配置
- 输出部署说明

---

## 八、验证清单（生成前自检）

生成代码前，请确保：
- [ ] app.py 第一行是 st.set_page_config
- [ ] 使用了 BASE_DIR = Path(__file__).parent
- [ ] 使用了 DATA_DIR = Path("/app/data") 且 mkdir
- [ ] 所有异常都有 try-except 包裹和 st.error() 提示
- [ ] 没有使用 calamine、pywin32 等禁用包
- [ ] Excel 操作使用 openpyxl 引擎
- [ ] 没有硬编码 localhost/127.0.0.1
- [ ] 没有写死绝对路径
- [ ] 耗时操作有 st.spinner
- [ ] 批量操作有 st.progress
- [ ] 结果通过 st.download_button 提供下载
- [ ] 函数有类型标注
- [ ] requirements.txt 符合规范`;

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

// 黑色主题配色
const theme = {
  primary: '#000000',
  primaryLight: '#F0F0F0',
  primaryHover: '#333333',
  success: '#00B42A',
  warning: '#FF7D00',
  textPrimary: '#1D2129',
  textSecondary: '#4E5969',
  textTertiary: '#86909C',
  border: '#E5E6EB',
  bg: '#F2F3F5',
  cardBg: '#FFFFFF',
  shadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  shadowHover: '0 8px 32px rgba(0, 0, 0, 0.12)',
};

// Web Speech API 类型声明
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export default function HomePage() {
  const [userRequirement, setUserRequirement] = useState<string>(`工具名称：

业务背景：

输入：

输出：`);
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
    return '#000000';
  };

  return (
    <div style={{ padding: "24px 24px 100px", maxWidth: 1200, margin: "0 auto", fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* 顶部标题区 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.5px", margin: "0 0 6px" }}>
          AI Coding
        </h1>
        <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
          💡 在下方填写需求，点击复制后粘贴到 Comate 即可生成应用
        </p>
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
                  background: '#F0F0F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileTextOutlined style={{ fontSize: 16, color: '#000000' }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, color: theme.textPrimary }}>
                  系统提示词模板
                </span>
              </Space>
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
                maxHeight: "480px",
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
                  background: '#F0F0F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
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
                    onClick={startRecording}
                    style={{ borderColor: '#000000', color: '#000000' }}
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
            <TextArea
              value={userRequirement}
              onChange={(e) => setUserRequirement(e.target.value)}
              placeholder={"请在此处描述你的具体需求..."}
              rows={10}
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                resize: "vertical",
                minHeight: "200px",
                borderRadius: 8,
                borderColor: userRequirement.length > 0 ? '#000000' : theme.border,
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

      {/* 底部操作区 - 固定置底 */}
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
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <Space size={16}>
            <Button
              size="large"
              icon={copySuccess ? <CheckCircleFilled /> : <CopyOutlined />}
              onClick={handleCopy}
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
              {showPreview ? "隐藏" : "预览"}
            </Button>
          </Space>
          

        </Space>
      </div>

      {/* 预览弹窗 */}
      <Modal
        title={
          <Space>
            <EyeOutlined style={{ color: '#000000' }} />
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
              style={{ background: '#000000' }}
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
