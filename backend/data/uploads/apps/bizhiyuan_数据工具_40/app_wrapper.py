#!/usr/bin/env python3
"""PE Platform 应用包装器 - 自动初始化用户后加载原始应用。

此文件会替代用户的 app.py 作为入口点，在加载用户代码前：
1. 从 URL 参数 pe_user 读取用户名
2. 写入 /app/data/.pe_user 供 Bridge 读取
3. 使用 exec 加载并运行用户的 app_original.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# 先初始化用户（在任何 Streamlit 代码之前）
def _init_pe_user():
    """尝试从 URL 参数初始化用户。"""
    try:
        import streamlit as st

        # 从 URL 参数获取用户名
        pe_user = st.query_params.get("pe_user")
        if pe_user:
            # 写入文件供 Bridge 读取
            user_file = Path("/app/data/.pe_user")
            user_file.parent.mkdir(parents=True, exist_ok=True)
            user_file.write_text(pe_user, encoding="utf-8")

            # 同时存到 session_state
            st.session_state["pe_username"] = pe_user
    except Exception:
        pass

# 在导入用户代码前初始化
_init_pe_user()

# 加载并执行用户的原始应用代码
app_path = Path("/app/app_original.py")
if app_path.exists():
    exec(compile(app_path.read_text(encoding="utf-8"), str(app_path), "exec"))
