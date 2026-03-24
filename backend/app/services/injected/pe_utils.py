#!/usr/bin/env python3
"""PE Platform 应用工具库 - 供 Streamlit 应用使用。

功能：
1. 自动从 URL 参数获取用户信息
2. 将用户信息写入文件供 Bridge 读取
3. 保存文件时自动关联用户信息

使用方式：
    # 方式1：在应用开头导入即可（会自动初始化用户）
    from pe_utils import init_user
    init_user()

    # 方式2：直接获取用户名（会自动初始化）
    from pe_utils import get_current_user
    username = get_current_user()
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Union

# 数据目录
DATA_DIR = Path("/app/data") if Path("/app").exists() else Path("./data")
OUTPUT_DIR = DATA_DIR / "outputs"
HISTORY_DIR = DATA_DIR / "history"

# 用户信息文件（Bridge 会读取这个文件）
_USER_FILE = DATA_DIR / ".pe_user"

# 是否已初始化
_initialized = False


def init_user() -> str:
    """初始化用户信息。

    从 URL 参数 pe_user 获取用户名，写入文件供 Bridge 读取。
    应该在应用启动时调用一次。

    Returns:
        用户名
    """
    global _initialized

    if _initialized:
        return get_current_user()

    username = "unknown"

    # 尝试从 Streamlit URL 参数获取
    try:
        import streamlit as st
        pe_user = st.query_params.get("pe_user")
        if pe_user:
            username = pe_user
    except Exception:
        pass

    # 写入文件
    if username != "unknown":
        set_current_user(username)

    _initialized = True
    return username


def get_current_user() -> str:
    """获取当前用户名。

    优先级：
    1. 从 Streamlit session_state 获取
    2. 从用户文件读取
    3. 从 URL 参数 pe_user 获取（并写入文件）
    4. 从环境变量 PE_USERNAME 读取
    5. 返回 "unknown"
    """
    # 尝试从 Streamlit session_state 获取
    try:
        import streamlit as st
        if hasattr(st, "session_state") and "pe_username" in st.session_state:
            user = st.session_state["pe_username"]
            if user:
                return user
    except ImportError:
        pass

    # 从用户文件读取
    if _USER_FILE.exists():
        try:
            user = _USER_FILE.read_text(encoding="utf-8").strip()
            if user:
                return user
        except Exception:
            pass

    # 尝试从 Streamlit URL 参数获取
    try:
        import streamlit as st
        pe_user = st.query_params.get("pe_user")
        if pe_user:
            # 同时设置到文件，供 Bridge 读取
            set_current_user(pe_user)
            return pe_user
    except Exception:
        pass

    # 从环境变量读取
    return os.environ.get("PE_USERNAME", "unknown")


def set_current_user(username: str) -> None:
    """设置当前用户。

    写入位置：
    1. /app/data/.pe_user - Bridge 会读取这个文件
    2. Streamlit session_state（如果可用）
    """
    if not username:
        return

    # 写入用户文件（Bridge 会读取）
    try:
        _USER_FILE.parent.mkdir(parents=True, exist_ok=True)
        _USER_FILE.write_text(username, encoding="utf-8")
    except Exception:
        pass

    # 同时设置到 Streamlit session_state
    try:
        import streamlit as st
        st.session_state["pe_username"] = username
    except Exception:
        pass


def save_output(
    filename: str,
    content: Union[str, bytes],
    username: Optional[str] = None,
    subdir: str = "",
) -> Path:
    """保存输出文件到 outputs 目录。

    Args:
        filename: 文件名
        content: 文件内容
        username: 用户名（不指定则自动获取）
        subdir: 子目录（可选）

    Returns:
        保存的文件路径
    """
    if username is None:
        username = get_current_user()

    target_dir = OUTPUT_DIR / subdir if subdir else OUTPUT_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    target_path = target_dir / filename

    if isinstance(content, str):
        target_path.write_text(content, encoding="utf-8")
    else:
        target_path.write_bytes(content)

    return target_path


def save_history(
    run_id: str,
    inputs: dict,
    summary: str,
    output_files: list[str],
    username: Optional[str] = None,
) -> Path:
    """保存运行历史记录。"""
    if username is None:
        username = get_current_user()

    HISTORY_DIR.mkdir(parents=True, exist_ok=True)

    record = {
        "run_id": run_id,
        "username": username,
        "timestamp": datetime.now().isoformat(),
        "inputs": inputs,
        "summary": summary,
        "output_files": output_files,
    }

    filename = f"{run_id}.json"
    target_path = HISTORY_DIR / filename

    target_path.write_text(
        json.dumps(record, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return target_path


def get_app_id() -> str:
    """获取当前应用 ID。"""
    return os.environ.get("PE_APP_ID", "")


def get_api_base() -> str:
    """获取后端 API 地址。"""
    return os.environ.get("PE_API_BASE", "http://host.docker.internal:8000/api/app-data")
