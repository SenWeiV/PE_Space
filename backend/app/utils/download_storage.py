"""统一文件下载存储工具。

将应用产出的下载文件统一存储到 downloads/ 目录，按 app_id/username/日期 分层，
避免多用户文件命名冲突。
"""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

from app.config import settings


def sanitize_filename(name: str, max_len: int = 200) -> str:
    """清理文件名，移除危险字符。

    Args:
        name: 原始文件名
        max_len: 最大长度

    Returns:
        安全的文件名
    """
    # 移除路径分隔符和其他危险字符
    safe = re.sub(r'[/\\<>:"|?*\x00-\x1f]', '_', name)
    # 移除开头的点（避免隐藏文件）
    safe = safe.lstrip('.')
    # 截断但保留扩展名
    if len(safe) > max_len:
        if '.' in safe:
            base, ext = safe.rsplit('.', 1)
            safe = base[:max_len - len(ext) - 1] + '.' + ext
        else:
            safe = safe[:max_len]
    return safe or 'unnamed'


def get_download_storage_path(
    app_id: int,
    username: str,
    original_name: str,
) -> tuple[Path, str]:
    """生成下载文件的存储路径。

    目录结构: downloads/{app_id}/{username}/{YYYYMMDD}/{HHMMSSmmm}_{filename}

    Args:
        app_id: 应用 ID
        username: 用户名
        original_name: 原始文件名

    Returns:
        (绝对路径, 相对路径) 元组
    """
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    timestamp = now.strftime("%H%M%S") + f"{now.microsecond // 1000:03d}"

    # 清理用户名和文件名
    safe_username = sanitize_filename(username, max_len=50)
    safe_name = sanitize_filename(original_name)
    final_name = f"{timestamp}_{safe_name}"

    # 相对路径：app_id/username/date/filename
    rel_path = f"{app_id}/{safe_username}/{date_str}/{final_name}"

    # 绝对路径
    abs_path = Path(settings.download_storage_dir) / rel_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    return abs_path, rel_path


def parse_filename_from_disposition(content_disposition: str) -> str:
    """从 Content-Disposition 头解析文件名。

    Args:
        content_disposition: HTTP Content-Disposition 头值

    Returns:
        解析出的文件名，解析失败返回空字符串
    """
    if not content_disposition:
        return ""

    # 尝试匹配 filename*=UTF-8''xxx 格式
    match = re.search(r"filename\*=(?:UTF-8''|utf-8'')(.+?)(?:;|$)", content_disposition, re.I)
    if match:
        from urllib.parse import unquote
        return unquote(match.group(1))

    # 尝试匹配 filename="xxx" 格式
    match = re.search(r'filename="([^"]+)"', content_disposition)
    if match:
        return match.group(1)

    # 尝试匹配 filename=xxx 格式
    match = re.search(r'filename=([^\s;]+)', content_disposition)
    if match:
        return match.group(1).strip('"\'')

    return ""


def is_file_download_response(content_type: str, content_disposition: str) -> bool:
    """判断响应是否为文件下载。

    Args:
        content_type: Content-Type 头
        content_disposition: Content-Disposition 头

    Returns:
        是否为文件下载响应
    """
    # 有 attachment 头
    if "attachment" in content_disposition.lower():
        return True

    # 常见下载类型
    ct_lower = content_type.lower()
    download_types = [
        "application/octet-stream",
        "application/zip",
        "application/x-zip",
        "application/pdf",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats",
        "application/x-rar",
        "application/x-tar",
        "application/gzip",
        "text/csv",
    ]
    return any(t in ct_lower for t in download_types)
