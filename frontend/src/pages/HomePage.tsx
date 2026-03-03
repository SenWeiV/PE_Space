import { useState, useCallback, useEffect, useRef } from "react";
import { Typography, Button, Input, Row, Col, Card, Space, Alert, Tag, Tooltip, Modal } from "antd";
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
  RobotFilled,
  CheckCircleFilled
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";

const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;

// 系统提示词模板 - 优化版本
const SYSTEM_PROMPT_TEMPLATE = `# 角色定位
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
- [ ] requirements.txt 符合规范
`;

// 示例需求
const EXAMPLE_REQUIREMENT = `工具名称：CSV 数据清洗与去重工具

这个工具要解决什么问题（业务背景 + 目标）：
日常工作中经常需要处理从各系统导出的原始 CSV 数据，存在格式不统一、空值、重复记录等问题。本工具用于快速清洗数据，统一格式，去除重复，方便后续分析。

输入（逐条列出）：
- 文件上传：CSV 文件（单文件，必填，最大 50MB），支持 utf-8 和 gbk 编码自动检测
- 参数：
  - 去重键：字符串，默认"id"，用于判断重复记录的列名
  - 保留策略：枚举（first/last），默认"first"，重复时保留第一条还是最后一条
  - 去除空值行：布尔值，默认 True
  - 日期格式标准化：布尔值，默认 True，将各种日期格式统一为 YYYY-MM-DD

点击【运行】后的处理逻辑（用步骤描述清楚，含必要的规则/边界条件）：
1. 读取上传的 CSV 文件，自动检测编码（优先 utf-8-sig，失败尝试 gbk）
2. 检查必要的列是否存在（去重键），不存在则报错提示
3. 如果开启"去除空值行"，删除所有字段都为空的行
4. 如果开启"日期格式标准化"，自动识别日期列并统一格式
5. 按去重键去重，根据保留策略保留 first 或 last
6. 生成处理报告：原行数、去重后行数、删除行数、处理时间

输出（逐条列出）：
- 结果文件：清洗后的 CSV 文件，命名规则：{原文件名}_cleaned_{时间戳}.csv
- 页面展示：处理摘要（原行数、去重后行数、删除行数）、前 10 行预览表格
- 运行日志：在页面文本区展示详细处理日志（编码检测、列检查、各步骤耗时）
- 历史记录持久化：保存到 /app/data/cleaner_history.json，记录每次处理的文件名、时间、参数、摘要，保留最近 100 条，页面底部展示历史记录列表`;

// Web Speech API 类型声明
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// 颜色配置 - 简洁现代风格
const colors = {
  primary: '#1677ff',
  primaryLight: '#e6f4ff',
  success: '#52c41a',
  warning: '#faad14',
  text: '#262626',
  textSecondary: '#595959',
  textTertiary: '#8c8c8c',
  border: '#d9d9d9',
  bg: '#f5f5f5',
  cardBg: '#fafafa',
};

export default function HomePage() {
  const [userRequirement, setUserRequirement] = useState<string>("");
  const [copySuccess, setCopySuccess] = useState<boolean | null>(null);
  const [copyMessage, setCopyMessage] = useState<string>("");
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<boolean>(false);
  
  // 语音识别状态
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);

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
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setUserRequirement(prev => {
          const newValue = prev + (prev && !prev.endsWith(' ') ? ' ' : '') + finalTranscript;
          return newValue;
        });
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
        try {
          recognition.start();
        } catch (e) {
          setIsRecording(false);
        }
      }
    };

    return recognition;
  }, [isRecording, isPaused]);

  // 开始录音
  const startRecording = useCallback(() => {
    if (!speechSupported) {
      setCopySuccess(false);
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
        setCopySuccess(null);
      } catch (e) {
        console.error('启动语音识别失败:', e);
      }
    }
  }, [speechSupported, initSpeechRecognition]);

  // 暂停录音
  const pauseRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsPaused(true);
    }
  }, [isRecording]);

  // 继续录音
  const resumeRecording = useCallback(() => {
    if (recognitionRef.current && isPaused) {
      try {
        recognitionRef.current.start();
        setIsPaused(false);
      } catch (e) {
        console.error('恢复语音识别失败:', e);
      }
    }
  }, [isPaused]);

  // 停止录音
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  // 生成完整提示词
  const generateFullPrompt = useCallback((): string => {
    if (!userRequirement.trim()) {
      return SYSTEM_PROMPT_TEMPLATE;
    }
    return `${SYSTEM_PROMPT_TEMPLATE}\n\n---\n\n# 用户具体需求\n\n${userRequirement.trim()}`;
  }, [userRequirement]);

  // 复制到剪贴板
  const handleCopy = useCallback(async () => {
    try {
      const fullPrompt = generateFullPrompt();
      
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullPrompt);
        setCopySuccess(true);
        setCopyMessage("已复制到剪贴板，可直接粘贴到 AI 编程软件使用");
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
          setCopyMessage("已复制到剪贴板，可直接粘贴到 AI 编程软件使用");
          setCopyError(false);
        } else {
          throw new Error("Copy failed");
        }
      }
      
      setTimeout(() => {
        setCopySuccess(null);
        setCopyMessage("");
      }, 3000);
    } catch (error) {
      setCopySuccess(false);
      setCopyMessage("当前环境无法自动复制，请在下方预览区手动复制");
      setCopyError(true);
      setShowPreview(true);
    }
  }, [generateFullPrompt]);

  // 清空需求
  const handleClear = useCallback(() => {
    setUserRequirement("");
    setCopySuccess(null);
    setCopyMessage("");
    setCopyError(false);
  }, []);

  // 填入示例
  const handleFillExample = useCallback(() => {
    setUserRequirement(EXAMPLE_REQUIREMENT);
    setCopySuccess(null);
    setCopyMessage("");
    setCopyError(false);
  }, []);

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1400, margin: "0 auto" }}>
      {/* 简洁头部 */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <Space direction="vertical" size={16} align="center">
          <RobotFilled style={{ fontSize: 48, color: colors.primary }} />
          <Title level={2} style={{ margin: 0, color: colors.text, fontSize: 32, fontWeight: 600 }}>
            AI 编程提示词生成器
          </Title>
          <Paragraph style={{ margin: 0, color: colors.textSecondary, fontSize: 16, maxWidth: 700 }}>
            描述你的数据处理需求，AI 自动生成专业提示词，复制到 Cursor、Claude、ChatGPT 即可创建 Streamlit 应用
          </Paragraph>
          <Space size={8}>
            <Tag icon={<CheckCircleFilled />} color="success">支持语音输入</Tag>
            <Tag icon={<CheckCircleFilled />} color="processing">一键复制</Tag>
            <Tag icon={<CheckCircleFilled />} color="warning">直接部署</Tag>
          </Space>
        </Space>
      </div>

      {/* 提示消息 */}
      {copySuccess !== null && (
        <Alert
          message={copyMessage}
          type={copySuccess ? "success" : copyError ? "warning" : "info"}
          showIcon
          closable
          onClose={() => setCopySuccess(null)}
          style={{ marginBottom: 24, borderRadius: 8 }}
        />
      )}

      {/* 语音录制状态条 */}
      {isRecording && (
        <div style={{ 
          marginBottom: 24, 
          padding: '12px 16px', 
          backgroundColor: isPaused ? '#fffbe6' : '#f6ffed',
          borderRadius: 8,
          border: `1px solid ${isPaused ? '#ffe58f' : '#b7eb8f'}`,
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
              backgroundColor: isPaused ? colors.warning : colors.success,
              animation: isPaused ? 'none' : 'pulse 2s infinite'
            }} />
            <Text strong style={{ color: isPaused ? '#d48806' : '#389e0d' }}>
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
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
        </div>
      )}

      <Row gutter={[24, 24]}>
        {/* 左侧：系统提示词模板 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space size={12}>
                <FileTextOutlined style={{ fontSize: 20, color: colors.success }} />
                <span style={{ fontSize: 16, fontWeight: 600 }}>系统提示词模板</span>
              </Space>
            }
            extra={
              <Button
                type="link"
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(SYSTEM_PROMPT_TEMPLATE).then(() => {
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
            style={{ borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02)' }}
          >
            <div
              style={{
                maxHeight: "600px",
                overflow: "auto",
                padding: "20px 24px",
                backgroundColor: colors.cardBg,
              }}
            >
              <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.7, color: colors.text }}>
                <ReactMarkdown>{SYSTEM_PROMPT_TEMPLATE}</ReactMarkdown>
              </div>
            </div>
          </Card>
        </Col>

        {/* 右侧：需求填写区 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space size={12}>
                <CodeOutlined style={{ fontSize: 20, color: colors.primary }} />
                <span style={{ fontSize: 16, fontWeight: 600 }}>我的需求</span>
              </Space>
            }
            extra={
              <Space>
                {!isRecording && speechSupported && (
                  <Button 
                    type="primary" 
                    icon={<SoundOutlined />}
                    onClick={startRecording}
                  >
                    语音输入
                  </Button>
                )}
                <Button icon={<ClearOutlined />} onClick={handleClear}>
                  清空
                </Button>
                <Button type="primary" ghost onClick={handleFillExample}>
                  填入示例
                </Button>
              </Space>
            }
            style={{ borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02)' }}
          >
            <TextArea
              value={userRequirement}
              onChange={(e) => setUserRequirement(e.target.value)}
              placeholder={`请在这里填写你的具体需求...

可以按照以下结构：

工具名称：

这个工具要解决什么问题（业务背景 + 目标）：

输入（逐条列出）：
- 文件上传：...
- 参数：...

点击【运行】后的处理逻辑：
1. ...
2. ...

输出（逐条列出）：
- ...

💡 提示：点击「语音输入」按钮，可以直接用语音描述你的需求`}
              rows={20}
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                resize: "vertical",
                minHeight: "440px",
                borderRadius: 8,
              }}
            />
            
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 12
            }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {isRecording && !isPaused && (
                  <span style={{ color: colors.success, marginRight: 8 }}>🎤 正在监听...</span>
                )}
                支持语音输入
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {userRequirement.length} 字符
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 底部操作区 */}
      <div style={{ 
        marginTop: 32, 
        padding: "28px",
        backgroundColor: colors.bg,
        borderRadius: 12,
        textAlign: "center"
      }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Space size={16}>
            <Button
              type="primary"
              size="large"
              icon={<CopyOutlined />}
              onClick={handleCopy}
              style={{ 
                minWidth: 180, 
                height: 44, 
                fontSize: 15,
                borderRadius: 8
              }}
            >
              复制完整提示词
            </Button>
            <Button
              size="large"
              icon={showPreview ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => setShowPreview(!showPreview)}
              style={{ 
                height: 44, 
                fontSize: 15,
                borderRadius: 8
              }}
            >
              {showPreview ? "隐藏预览" : "展开预览"}
            </Button>
          </Space>
          
          <Text type="secondary" style={{ fontSize: 13 }}>
            复制后可直接粘贴到 Cursor、Claude、ChatGPT 等 AI 编程软件使用
          </Text>
        </Space>
      </div>

      {/* 预览弹窗 */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
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
            backgroundColor: colors.cardBg,
            borderRadius: 8,
            marginTop: 8
          }}
        />
      </Modal>
    </div>
  );
}
