"""文件存储工具函数。"""
from __future__ import annotations

import os
import zipfile
from pathlib import Path


def safe_extract_zip(zip_path: str, extract_to: str) -> None:
    extract_to_path = Path(extract_to).resolve()
    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            if info.external_attr >> 16 & 0o120000 == 0o120000:
                raise ValueError(f"Zip contains symlink, rejected: {info.filename}")
            target = (extract_to_path / info.filename).resolve()
            if not str(target).startswith(str(extract_to_path)):
                raise ValueError(f"Unsafe path in zip: {info.filename}")
        zf.extractall(extract_to)


def validate_zip_structure(zip_path: str, required: set[str] | None = None) -> tuple[bool, str]:
    if required is None:
        required = {"app.py", "requirements.txt"}
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            names = set(zf.namelist())
            flat_names = {os.path.basename(n) for n in names}
            missing = required - flat_names
            if missing:
                return False, f"缺少必要文件: {', '.join(missing)}"
    except zipfile.BadZipFile:
        return False, "不是有效的 zip 文件"
    return True, ""
