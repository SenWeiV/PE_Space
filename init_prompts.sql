-- 初始化 Vibe Coding Prompt 模板
-- 执行方式（在服务器上）：
--   docker exec -i postgres psql -U platform -d tool_platform < init_prompts.sql

INSERT INTO prompts (title, content, category, sort_order, is_active, created_by, created_at, updated_at) VALUES

('通用 Streamlit 工具模板',
'你是一名专业的 Python 工程师。请帮我写一个 Streamlit Web 应用，运行在内部工具平台上。

## 我的需求
[在这里描述你的工具要做什么，输入什么，输出什么]

## 技术要求（必须严格遵守，不可更改）

### 文件结构
必须只输出以下两个文件，不需要其他任何文件：
- app.py（Streamlit 主入口）
- requirements.txt（第三方依赖）

### 禁止事项
- 禁止生成 Dockerfile（平台自动注入）
- 禁止使用 calamine 包，读写 Excel 必须用 openpyxl
- 禁止使用任何 Windows 专用包（pywin32、win32com 等）
- 禁止硬编码 localhost 或 127.0.0.1 的端口
- 禁止写死绝对路径，必须用 Path(__file__).parent 获取当前目录

### 文件读写规范
- 临时文件写到当前目录（Path(__file__).parent / "xxx"）
- 需要跨部署持久化的数据写到 /app/data/ 目录（该目录已挂载到宿主机）
- 处理结果优先通过 st.download_button 提供给用户下载，而非写文件

### Streamlit 规范
- 第一行必须是 st.set_page_config()
- 耗时操作必须用 st.spinner() 包裹
- 错误必须用 st.error() 展示，不允许直接 raise 到界面
- 批量处理必须有 st.progress() 进度条
- 页面顶部写清楚工具的用途说明（st.caption 或 st.info）

### requirements.txt 规范
- 必须包含 streamlit>=1.30.0
- 版本号用 >= 而非 ==（除非有特殊原因）
- 不要写注释行，保持简洁',
'通用模板', 1, true, 1, NOW(), NOW()),

('数据处理工具模板（Excel / CSV）',
'你是一名专业的 Python 工程师。请帮我写一个 Streamlit 数据处理工具，运行在内部工具平台上。

## 我的需求
输入：[描述输入文件的格式，比如：一个 Excel 文件，包含列：姓名、手机号、订单金额]
处理：[描述要做什么处理，比如：过滤金额大于1000的行，计算每个用户的总金额]
输出：[描述输出文件的格式，比如：处理后的 Excel，新增「是否大客户」列]

## 技术要求（必须严格遵守）

### 文件结构
只输出 app.py 和 requirements.txt 两个文件。

### Excel 处理规范
- 读取 Excel：pd.read_excel(file, engine="openpyxl")  ← 必须指定 engine
- 写出 Excel：使用 BytesIO 在内存中生成，配合 st.download_button 下载
- 禁止使用 calamine 包
- 支持 .xlsx 和 .csv 两种格式上传（自动判断）

### 标准代码结构
app.py 必须按以下结构组织：
1. import 区
2. st.set_page_config()
3. 页面标题和说明
4. 侧边栏参数配置（如果有）
5. 文件上传区（st.file_uploader）
6. 数据预览区（st.dataframe，显示前20行）
7. 处理逻辑（用 st.spinner 包裹）
8. 结果预览 + 下载按钮

### 错误处理
- 文件格式错误时 st.error() 提示
- 必填列缺失时给出明确提示，说明需要哪些列
- 用 st.stop() 阻止后续执行

### requirements.txt 必须包含
streamlit>=1.30.0
pandas>=2.0.0
openpyxl>=3.1.0',
'数据处理', 2, true, 1, NOW(), NOW()),

('批量 AI 调用工具模板',
'你是一名专业的 Python 工程师。请帮我写一个 Streamlit 批量 AI 处理工具，运行在内部工具平台上。

## 我的需求
输入：[描述 Excel 表格的结构，比如：A列是「用户评论」，B列是「商品名称」]
AI任务：[描述每行要让 AI 做什么，比如：判断评论情感（正面/负面/中性），提取关键词]
输出：[描述输出表格，比如：原始数据 + 新增「情感」列 + 「关键词」列]

## AI 配置
API 配置从 config.json 文件读取（该文件和 app.py 在同一目录）：
{
  "api_key": "sk-xxx",
  "base_url": "https://api.openai.com/v1",
  "model": "gpt-4o-mini"
}
用 Path(__file__).parent / "config.json" 读取，不要硬编码 API Key。

## 技术要求（必须严格遵守）

### 文件结构
只输出 app.py 和 requirements.txt 两个文件。

### 批量处理规范
- 必须有进度条（st.progress）和实时状态（st.empty）
- 处理结果实时写入列表，不要等全部完成再展示
- 支持断点续跑：已有结果列不重复调用 AI（检查对应列是否为空）
- 报错单行时记录错误信息到结果列，不中断整体流程

### 速率限制
- 每次 API 调用之间加 0.5 秒间隔（避免触发限流）
- 并发量控制在 1（顺序处理，简单可靠）

### 结果保存
- 每处理完 10 条自动保存一次到 /app/data/auto_save.xlsx（防止意外丢失进度）
- 全部完成后提供 st.download_button 下载完整结果

### requirements.txt 必须包含
streamlit>=1.30.0
pandas>=2.0.0
openpyxl>=3.1.0
openai>=1.3.0',
'AI 工具', 3, true, 1, NOW(), NOW()),

('内容生成工具模板（单条交互式）',
'你是一名专业的 Python 工程师。请帮我写一个 Streamlit 内容生成工具，运行在内部工具平台上。

## 我的需求
这个工具的用途：[描述这个工具做什么，比如：根据商品名称和卖点，生成小红书种草文案]
用户需要填写的输入项：[列出所有输入字段，比如：商品名称（文本）、核心卖点（多行文本）、目标用户（下拉选择：学生/白领/宝妈）、文案风格（下拉：活泼/专业/温馨）]
输出格式：[描述 AI 应该输出什么，比如：3个版本的文案，每个100字左右]

## AI 配置
API 配置从 config.json 文件读取（文件格式同批量工具模板）。

## 技术要求（必须严格遵守）

### 文件结构
只输出 app.py 和 requirements.txt 两个文件。

### 交互规范
- 所有输入项放在左侧（st.sidebar 或 col1），结果展示在右侧（col2）
- 生成按钮在输入区底部，点击后触发 AI 调用
- 支持流式输出（stream=True），用 st.write_stream 实时显示生成过程
- 生成完成后提供「复制」按钮（用 st.code 展示，用户可直接选中复制）
- 历史生成记录用 st.session_state 保存，可在当前会话内翻看

### 参数校验
- 必填项为空时禁用生成按钮（用 disabled= 参数控制）
- 长文本输入限制最大字数并实时提示剩余字数

### requirements.txt 必须包含
streamlit>=1.30.0
openai>=1.3.0',
'AI 工具', 4, true, 1, NOW(), NOW());
