"""
工具名称：脚本处理工具 (有Python环境的终端平替)
功能描述：为无 Python 环境的用户提供的一个通用脚本运行终端平替。支持上传 Python 脚本、上传所需数据文件，提供可视化的终端输出窗口，并支持下载运行后生成的结果文件。
"""

# ============ 1. 导入区 ============
import streamlit as st
import os
import sys
import shutil
import subprocess
import threading
import queue
import time
from pathlib import Path
from io import BytesIO
import zipfile

# ============ 2. 页面配置 ============
st.set_page_config(
    page_title="终端平替 - 脚本运行器", 
    page_icon="💻", 
    layout="wide",
    initial_sidebar_state="expanded"
)

# ============ 3. 路径与目录 ============
BASE_DIR = Path(__file__).parent
DATA_DIR = Path("/app/data")

# 确保需要的目录存在
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ============ 4. 工具函数 ============
def render_terminal(text: str):
    """渲染带固定高度和滚动条的终端窗口"""
    import html
    # 转义 HTML 字符，防止输出内容破坏页面结构
    safe_text = html.escape(text)
    
    # 使用自定义 CSS 实现固定高度的滚动窗口，并模拟终端黑底白字样式
    html_content = f"""
    <div style="
        background-color: #1e1e1e;
        color: #d4d4d4;
        font-family: 'Courier New', Courier, monospace;
        font-size: 14px;
        padding: 15px;
        border-radius: 5px;
        height: 400px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
        box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
    ">
        {safe_text}
    </div>
    """
    st.markdown(html_content, unsafe_allow_html=True)

def get_user_workspace() -> Path:
    """获取当前用户的专属工作区目录"""
    import uuid
    if "session_id" not in st.session_state:
        st.session_state["session_id"] = str(uuid.uuid4())
    
    workspace = DATA_DIR / "workspaces" / st.session_state["session_id"]
    workspace.mkdir(parents=True, exist_ok=True)
    return workspace

def clear_workspace(workspace_dir: Path):
    """清空工作区，防止旧数据干扰"""
    if workspace_dir.exists():
        shutil.rmtree(workspace_dir)
    workspace_dir.mkdir(parents=True, exist_ok=True)

def save_uploaded_files(uploaded_files, target_dir: Path):
    """保存上传的文件到指定目录"""
    for file in uploaded_files:
        file_path = target_dir / file.name
        with open(file_path, "wb") as f:
            f.write(file.getbuffer())

def get_workspace_files(workspace_dir: Path):
    """获取工作区的所有文件（用于下载）"""
    files = []
    for root, _, filenames in os.walk(workspace_dir):
        for filename in filenames:
            if filename.endswith(".pyc") or filename == ".DS_Store":
                continue
            files.append(Path(root) / filename)
    return files

def parse_terminal_output(text: str) -> str:
    """处理 \\r 回车符，使其像真实终端一样覆盖当前行（常用于 tqdm 等进度条）"""
    lines = text.split('\n')
    parsed_lines = []
    for line in lines:
        if '\r' in line:
            # 以 \r 分割，取最后一段（覆盖前面的输出）
            line = line.split('\r')[-1]
        parsed_lines.append(line)
    return '\n'.join(parsed_lines)

def read_process_output(proc, q):
    """后台线程：逐字符读取输出，以支持实时进度条和不换行的 prompt"""
    while True:
        char = proc.stdout.read(1)
        if not char:
            break
        q.put(char)

# ============ 5. 主程序 ============
def main():
    st.title("💻 终端平替 - 脚本运行器")
    st.caption("无 Python 环境用户的福音：上传脚本与数据 -> 运行 -> 观察终端输出 -> 下载结果")

    # 初始化 session_state
    if "run_status" not in st.session_state:
        st.session_state["run_status"] = "idle"
    if "terminal_output" not in st.session_state:
        st.session_state["terminal_output"] = ""
    if "output_queue" not in st.session_state:
        st.session_state["output_queue"] = queue.Queue()
    if "process" not in st.session_state:
        st.session_state["process"] = None

    col1, col2 = st.columns([1, 1])

    with col1:
        st.subheader("📥 1. 上传区")
        
        script_file = st.file_uploader(
            "上传主 Python 脚本 (.py)", 
            type=["py"],
            help="请上传您的主要执行脚本，如 main.py"
        )
        
        data_files = st.file_uploader(
            "上传数据文件或依赖脚本 (可选)", 
            accept_multiple_files=True,
            help="上传 CSV, Excel, TXT 或其他需要与脚本放在同一目录的数据文件"
        )
        
        cmd_args = st.text_input(
            "命令行参数 (可选)",
            help="如果您的脚本需要传入参数（例如文件名），请在此填写，多个参数用空格分隔。例如：input.xlsx"
        )

        btn_col1, btn_col2 = st.columns(2)
        with btn_col1:
            run_button = st.button("▶️ 运行脚本", type="primary", use_container_width=True, disabled=(st.session_state["run_status"] == "running"))
        with btn_col2:
            stop_button = st.button("⏹️ 终止运行", type="secondary", use_container_width=True, disabled=(st.session_state["run_status"] != "running"))
            
        if stop_button:
            if st.session_state["process"] and st.session_state["process"].poll() is None:
                st.session_state["process"].kill()
                st.session_state["run_status"] = "idle"
                st.session_state["terminal_output"] += "\n[系统提示] 🛑 进程已被用户强制终止。\n"
                st.rerun()

    with col2:
        st.subheader("🖥️ 2. 终端窗口")
        # terminal_container = st.empty()  <-- 去掉原有的占位符，直接渲染 html
        
        # 如果正在运行，从队列中读取最新输出
        if st.session_state["run_status"] == "running":
            while not st.session_state["output_queue"].empty():
                st.session_state["terminal_output"] += st.session_state["output_queue"].get()
            
            # 判断进程是否结束
            if st.session_state["process"].poll() is not None:
                st.session_state["run_status"] = "idle"
                # 读取剩余所有输出
                while not st.session_state["output_queue"].empty():
                    st.session_state["terminal_output"] += st.session_state["output_queue"].get()
                
                return_code = st.session_state["process"].returncode
                if return_code == 0:
                    st.session_state["terminal_output"] += f"\n✅ 脚本执行成功 (退出码: {return_code})\n"
                else:
                    st.session_state["terminal_output"] += f"\n❌ 脚本执行异常 (退出码: {return_code})\n"
                
                # 状态改变，最后渲染一次
                render_terminal(parse_terminal_output(st.session_state["terminal_output"]))
                st.rerun()
                
        # 始终显示当前终端内容
        if st.session_state["terminal_output"]:
            render_terminal(parse_terminal_output(st.session_state["terminal_output"]))
        else:
            render_terminal("等待运行...")

    st.divider()
    st.subheader("📤 3. 输出文件")
    
    user_workspace = get_user_workspace()
    
    # 运行逻辑
    if run_button:
        if not script_file:
            st.error("❌ 请先上传需要运行的 Python 脚本！")
            st.stop()
            
        st.session_state["terminal_output"] = "$ 正在初始化工作区...\n"
        clear_workspace(user_workspace)
        
        script_path = user_workspace / script_file.name
        with open(script_path, "wb") as f:
            f.write(script_file.getbuffer())
            
        if data_files:
            save_uploaded_files(data_files, user_workspace)
            
        # 注意：使用 -u 强制 Python 不使用输出缓冲，确保类似 tqdm 或 input() 的内容能实时传递到管道
        cmd = [sys.executable, "-u", script_file.name]
        if cmd_args:
            import shlex
            cmd.extend(shlex.split(cmd_args))
            
        cmd_str = " ".join(cmd)
        st.session_state["terminal_output"] += f"$ 文件已就绪。开始执行命令：\n$ {cmd_str}\n\n"
        
        try:
            # 开启 stdin 管道以支持交互式输入
            process = subprocess.Popen(
                cmd,
                cwd=user_workspace,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            
            st.session_state["process"] = process
            st.session_state["run_status"] = "running"
            st.session_state["output_queue"] = queue.Queue()
            
            # 启动后台读取线程
            t = threading.Thread(target=read_process_output, args=(process, st.session_state["output_queue"]))
            t.daemon = True
            t.start()
            
            st.rerun()
        except Exception as e:
            st.error(f"❌ 启动脚本时发生错误：{e}")
            st.session_state["terminal_output"] += f"\n[内部错误] {str(e)}\n"
            st.session_state["run_status"] = "idle"

    # 展示可下载的文件
    workspace_files = get_workspace_files(user_workspace)
    if workspace_files:
        st.write("以下是工作区当前的所有文件，您可以点击下载：")
        
        if len(workspace_files) > 1:
            zip_buffer = BytesIO()
            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                for file_path in workspace_files:
                    arcname = file_path.relative_to(user_workspace)
                    zip_file.write(file_path, arcname)
            
            st.download_button(
                label="📦 一键打包下载工作区所有文件",
                data=zip_buffer.getvalue(),
                file_name="workspace_output.zip",
                mime="application/zip",
                type="primary"
            )
            
        for f in workspace_files:
            with open(f, "rb") as file_data:
                st.download_button(
                    label=f"📄 下载 {f.name}",
                    data=file_data,
                    file_name=f.name,
                    mime="application/octet-stream",
                    key=f"dl_{f.name}"
                )
    else:
        st.info("工作区当前为空。")

    # === 交互输入区（固定在页面底部） ===
    if st.session_state["run_status"] == "running":
        user_input = st.chat_input("脚本运行中...如需输入交互参数，请在此键入并回车发送")
        if user_input:
            try:
                # 写入子进程标准输入
                st.session_state["process"].stdin.write(user_input + "\n")
                st.session_state["process"].stdin.flush()
                # 顺便在终端也回显一下用户的输入
                st.session_state["terminal_output"] += f"{user_input}\n"
            except Exception as e:
                st.error(f"发送输入失败: {e}")
                
        # 轮询刷新页面以获取后台线程的最新输出
        time.sleep(0.5)
        st.rerun()

if __name__ == "__main__":
    main()
