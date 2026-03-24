import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import streamlit as st

st.set_page_config(
    page_title="测试11",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed",
)

BASE_DIR = Path(__file__).parent
DATA_DIR = Path("/app/data") if Path("/app").exists() else BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_DIR = DATA_DIR / "outputs"
HISTORY_DIR = DATA_DIR / "history"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
HISTORY_DIR.mkdir(parents=True, exist_ok=True)


def save_history(
    username: str,
    inputs: dict,
    summary: str,
    output_files: List[str],
    run_id: Optional[str] = None,
) -> str:
    rid = run_id or str(uuid.uuid4())[:8]
    record = {
        "run_id": rid,
        "username": username,
        "timestamp": datetime.now().isoformat(),
        "inputs": inputs,
        "summary": summary,
        "output_files": output_files,
    }
    dest = HISTORY_DIR / f"{rid}.json"
    tmp = HISTORY_DIR / f"{rid}.json.tmp"
    try:
        payload = json.dumps(record, ensure_ascii=False, indent=2)
        tmp.write_text(payload, encoding="utf-8")
        tmp.replace(dest)
    except Exception as e:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass
        raise e
    return rid


def atomic_write_text(path: Path, content: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        tmp.write_text(content, encoding="utf-8")
        tmp.replace(path)
    except Exception as e:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass
        raise e


def count_digit_one(text: str) -> int:
    return text.count("1")


st.title("📊 测试11")
st.caption("📝 词频统计：统计输入文本中字符「1」出现的次数。")

with st.sidebar:
    username = st.text_input("用户名（用于运行记录）", value="guest", max_chars=64)

with st.container():
    st.subheader("📥 输入配置")
    user_text = st.text_area(
        "请输入待统计的文本",
        value="",
        height=160,
        placeholder="在此粘贴或输入任意文本…",
    )

if st.button("▶️ 开始统计", type="primary"):
    with st.spinner("正在统计，请稍候..."):
        try:
            n = count_digit_one(user_text)
            run_id = str(uuid.uuid4())[:8]
            out_name = f"{run_id}_result.txt"
            out_path = OUTPUT_DIR / out_name
            result_body = f"{n}\n"
            atomic_write_text(out_path, result_body)
            rel_out = f"outputs/{out_name}"
            save_history(
                username=username or "guest",
                inputs={"text_length": len(user_text), "preview": user_text[:200]},
                summary=f"字符「1」出现 {n} 次",
                output_files=[rel_out],
                run_id=run_id,
            )
            st.session_state["result_count"] = n
            st.session_state["result_text"] = user_text
            st.session_state["last_run_id"] = run_id
            st.session_state["download_bytes"] = result_body.encode("utf-8")
            st.session_state["download_name"] = out_name
        except Exception as e:
            st.error(f"❌ 处理出错：{str(e)}")
            st.stop()

if "result_count" in st.session_state:
    st.subheader("📤 处理结果")
    c = st.session_state["result_count"]
    st.metric("字符「1」的个数", c)
    if "last_run_id" in st.session_state:
        st.caption(f"运行 ID：{st.session_state['last_run_id']}")
    try:
        st.download_button(
            label="⬇️ 下载结果（TXT）",
            data=st.session_state.get("download_bytes", str(c).encode("utf-8")),
            file_name=st.session_state.get("download_name", "result.txt"),
            mime="text/plain",
        )
    except Exception as e:
        st.error(f"❌ 处理出错：{str(e)}")
        st.stop()
