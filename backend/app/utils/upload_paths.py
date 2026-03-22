"""应用代码与 data 目录在磁盘上的路径解析（支持「用户名_应用名_应用ID」目录名与历史纯数字目录）。"""
from __future__ import annotations

import re
from pathlib import Path

from app.models.app import App

_FORBIDDEN_FS = re.compile(r'[/\\:\x00-\x1f<>:"|?*]')


def sanitize_fs_segment(s: str, max_len: int = 128) -> str:
    """文件名/目录名片段：去掉路径非法字符，保留中文等 Unicode。"""
    t = _FORBIDDEN_FS.sub("_", (s or "").strip())
    t = re.sub(r"\s+$", "", t).strip(" .")
    if not t:
        t = "unnamed"
    return t[:max_len] if len(t) > max_len else t


def app_code_storage_dirname(username: str, app_name: str, app_id: int) -> str:
    """解压根目录名：用户名_应用名_应用ID（末尾 ID 保证不同应用不互相覆盖）。"""
    u = sanitize_fs_segment(username, 64)
    n = sanitize_fs_segment(app_name, 128)
    return f"{u}_{n}_{app_id}"


def app_upload_base_from_code_path(upload_root: Path, code_path_str: str | None, app_id: int) -> Path:
    """由当前代码目录（upload_path）反推解压根目录（upload_root 下的第一级子目录）。"""
    root = upload_root.resolve()
    if not code_path_str:
        return root / str(app_id)
    try:
        rel = Path(code_path_str).resolve().relative_to(root)
    except ValueError:
        return root / str(app_id)
    if not rel.parts:
        return root / str(app_id)
    return root / rel.parts[0]


def app_upload_base_path(upload_root: Path, app: App) -> Path:
    """应用在上传根目录下的解压根路径。"""
    return app_upload_base_from_code_path(upload_root, app.upload_path, app.id)


def app_data_dir(upload_root: Path, app: App) -> Path:
    return app_upload_base_path(upload_root, app) / "data"
