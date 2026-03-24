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
    """由当前代码目录（upload_path）反推解压根目录（upload_root 下的第一级子目录）。

    支持两种路径格式：
    1. 宿主机绝对路径：/Users/.../data/uploads/apps/bizhiyuan_xxx_32
    2. 容器内路径：/data/uploads/apps/bizhiyuan_xxx_32（数据库存储的可能是容器路径）
    """
    root = upload_root.resolve()
    if not code_path_str:
        return root / str(app_id)

    code_path = Path(code_path_str)

    # 尝试直接解析（宿主机路径）
    try:
        rel = code_path.resolve().relative_to(root)
        if rel.parts:
            return root / rel.parts[0]
    except ValueError:
        pass

    # 如果是容器路径（如 /data/uploads/apps/xxx），提取目录名
    # 容器路径通常以 /data/uploads/apps/ 或 /uploads/apps/ 开头
    path_str = str(code_path)
    for container_prefix in ("/data/uploads/apps/", "/uploads/apps/"):
        if path_str.startswith(container_prefix):
            remaining = path_str[len(container_prefix):]
            # 取第一个路径片段作为目录名
            dirname = remaining.split("/")[0]
            if dirname:
                return root / dirname

    # 最后回退：直接用路径中的目录名（如果包含 app_id）
    for part in code_path.parts:
        if part.endswith(f"_{app_id}"):
            return root / part

    return root / str(app_id)


def app_upload_base_path(upload_root: Path, app: App) -> Path:
    """应用在上传根目录下的解压根路径。"""
    return app_upload_base_from_code_path(upload_root, app.upload_path, app.id)


def app_data_dir(upload_root: Path, down_root: Path, app: App) -> Path:
    """应用运行时数据根目录（容器内 /app/data 对应宿主机 host_down_dir/{解压根名}/）。

    新数据统一在 down_root；若仍存在历史上传目录下的 data/ 且有内容，则继续读该路径直至部署迁移。
    """
    base = app_upload_base_path(upload_root, app)
    name = base.name
    down_p = (Path(down_root) / name).resolve()
    legacy = base / "data"

    def _has_entries(path: Path) -> bool:
        if not path.is_dir():
            return False
        try:
            return any(path.iterdir())
        except OSError:
            return False

    if _has_entries(down_p):
        return down_p
    if _has_entries(legacy):
        return legacy
    down_p.mkdir(parents=True, exist_ok=True)
    return down_p
