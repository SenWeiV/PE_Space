import { useState, useEffect } from "react";
import { Typography, Button, Input, Card, Space, Alert, Tabs, Modal, Tag, Timeline, Avatar } from "antd";
import { SaveOutlined, ReloadOutlined, EyeOutlined, HistoryOutlined, ExclamationCircleFilled, EditOutlined, UserOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/store/authStore";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { confirm } = Modal;

// 默认系统提示词模板
const DEFAULT_TEMPLATE = `# 角色定位
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

// 模板修改历史记录
interface TemplateHistory {
  id: string;
  content: string;
  updatedAt: string;
  updatedBy: string;
  adminName: string;
  changeDescription: string;
}

export default function TemplateManagePage() {
  const { user } = useAuthStore();
  const [template, setTemplate] = useState<string>("");
  const [originalTemplate, setOriginalTemplate] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("edit");
  const [history, setHistory] = useState<TemplateHistory[]>([]);

  // 加载模板和历史记录
  useEffect(() => {
    const saved = localStorage.getItem("system_prompt_template");
    const initialTemplate = saved || DEFAULT_TEMPLATE;
    setTemplate(initialTemplate);
    setOriginalTemplate(initialTemplate);

    // 加载历史记录
    const savedHistory = localStorage.getItem("template_history");
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    } else {
      // 初始历史记录
      const initialHistory: TemplateHistory[] = [
        {
          id: "1",
          content: DEFAULT_TEMPLATE,
          updatedAt: "2024-03-01 10:00:00",
          updatedBy: "system",
          adminName: "系统初始版本",
          changeDescription: "系统默认模板",
        },
      ];
      setHistory(initialHistory);
      localStorage.setItem("template_history", JSON.stringify(initialHistory));
    }
  }, []);

  // 检查是否有更改
  useEffect(() => {
    setHasChanges(template !== originalTemplate);
  }, [template, originalTemplate]);

  // 保存模板
  const handleSave = () => {
    confirm({
      title: "确认保存修改？",
      icon: <ExclamationCircleFilled />,
      content: `修改后的模板将立即生效，影响所有用户生成的提示词。\n\n当前管理员：${user?.username || "unknown"}`,
      onOk() {
        // 保存模板
        localStorage.setItem("system_prompt_template", template);
        
        // 添加到历史记录
        const newHistoryItem: TemplateHistory = {
          id: Date.now().toString(),
          content: template,
          updatedAt: new Date().toLocaleString("zh-CN"),
          updatedBy: user?.username || "unknown",
          adminName: user?.username || "unknown",
          changeDescription: "管理员手动修改",
        };
        
        const updatedHistory = [newHistoryItem, ...history].slice(0, 20); // 保留最近20条
        setHistory(updatedHistory);
        localStorage.setItem("template_history", JSON.stringify(updatedHistory));
        
        setOriginalTemplate(template);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      },
    });
  };

  // 重置为默认
  const handleReset = () => {
    confirm({
      title: "确认重置为默认模板？",
      icon: <ExclamationCircleFilled />,
      content: "当前编辑的内容将丢失，恢复为系统默认模板。",
      onOk() {
        setTemplate(DEFAULT_TEMPLATE);
      },
    });
  };

  // 恢复到某个版本
  const handleRestoreVersion = (record: TemplateHistory) => {
    confirm({
      title: "确认恢复此版本？",
      icon: <ExclamationCircleFilled />,
      content: `将恢复到 ${record.updatedAt} 的版本（管理员：${record.adminName}），当前编辑内容将被覆盖。`,
      onOk() {
        setTemplate(record.content);
        setActiveTab("edit");
      },
    });
  };

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>系统提示词模板管理</Title>
        <Paragraph type="secondary" style={{ margin: "8px 0 0 0" }}>
          管理首页使用的系统提示词模板。修改后将影响所有用户在首页生成的提示词。
          <Tag color="red" style={{ marginLeft: 8 }}>仅管理员可操作</Tag>
        </Paragraph>
      </div>

      {/* 提示消息 */}
      {saveSuccess && (
        <Alert
          message="保存成功！模板已更新，所有用户将使用新版本。"
          type="success"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {hasChanges && (
        <Alert
          message="您有未保存的修改"
          type="warning"
          showIcon
          action={
            <Button size="small" type="primary" onClick={handleSave}>
              立即保存
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 当前管理员信息 */}
      <Card size="small" style={{ marginBottom: 16, background: "#f6ffed" }}>
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: "#52c41a" }} />
          <div>
            <Text strong>当前管理员：</Text>
            <Text>{user?.username || "unknown"}</Text>
          </div>
          <div style={{ marginLeft: 24 }}>
            <Text strong>最后修改时间：</Text>
            <Text>{history[0]?.updatedAt || "-"}</Text>
          </div>
          <div style={{ marginLeft: 24 }}>
            <Text strong>最后修改人：</Text>
            <Text>{history[0]?.adminName || "-"}</Text>
          </div>
        </Space>
      </Card>

      {/* 标签页 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <Space>
              <EditOutlined />
              编辑模板
            </Space>
          }
          key="edit"
        >
          <Card
            title="系统提示词模板内容"
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置默认
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  disabled={!hasChanges}
                >
                  保存修改
                </Button>
              </Space>
            }
          >
            <TextArea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={28}
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                lineHeight: 1.6,
              }}
              placeholder="请输入系统提示词模板内容..."
            />

            <div style={{ marginTop: 16, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <strong>提示：</strong>
                此模板将作为首页系统提示词的基础内容，与用户填写的需求拼接后生成完整提示词。
                支持 Markdown 格式。修改后立即生效，请谨慎操作。
              </Text>
            </div>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <Space>
              <EyeOutlined />
              预览效果
            </Space>
          }
          key="preview"
        >
          <Card title="模板预览">
            <div
              style={{
                padding: 20,
                background: "#f6ffed",
                borderRadius: 8,
                maxHeight: 600,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {template}
            </div>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <Space>
              <HistoryOutlined />
              修改历史
            </Space>
          }
          key="history"
        >
          <Card title="模板修改历史记录">
            <Timeline mode="left">
              {history.map((record, index) => (
                <Timeline.Item
                  key={record.id}
                  label={
                    <div style={{ color: "#8c8c8c", fontSize: 12 }}>
                      {record.updatedAt}
                    </div>
                  }
                  color={index === 0 ? "green" : "gray"}
                >
                  <Card
                    size="small"
                    style={{ marginBottom: 8 }}
                    actions={[
                      <Button
                        type="link"
                        size="small"
                        onClick={() => handleRestoreVersion(record)}
                      >
                        恢复此版本
                      </Button>,
                    ]}
                  >
                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                      <Space>
                        <Avatar
                          size="small"
                          icon={<UserOutlined />}
                          style={{ backgroundColor: index === 0 ? "#52c41a" : "#bfbfbf" }}
                        />
                        <Text strong>{record.adminName}</Text>
                        {index === 0 && <Tag color="success">当前版本</Tag>}
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.changeDescription}
                      </Text>
                    </Space>
                  </Card>
                </Timeline.Item>
              ))}
            </Timeline>

            {history.length === 0 && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Text type="secondary">暂无修改历史</Text>
              </div>
            )}
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
}
