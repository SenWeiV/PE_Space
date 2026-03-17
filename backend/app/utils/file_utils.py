import os
import zipfile
from pathlib import Path


def safe_extract_zip(zip_path: str, extract_to: str) -> None:
    """解压 zip 文件，防止路径穿越和 symlink 攻击"""
    extract_to = Path(extract_to).resolve()

    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            # 防止 symlink 攻击
            if info.external_attr >> 16 & 0o120000 == 0o120000:
                raise ValueError(f"Zip contains symlink, rejected: {info.filename}")
            # 防止路径穿越
            target = (extract_to / info.filename).resolve()
            if not str(target).startswith(str(extract_to)):
                raise ValueError(f"Unsafe path in zip: {info.filename}")
        zf.extractall(extract_to)


def validate_zip_structure(zip_path: str) -> tuple[bool, str]:
    """校验 zip 包是否包含必要文件"""
    required_files = {"app.py", "requirements.txt"}

    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            names = set(zf.namelist())
            # 简单检查：zip 中任意路径包含这两个文件名即可
            flat_names = {os.path.basename(n) for n in names}
            missing = required_files - flat_names
            if missing:
                return False, f"缺少必要文件: {', '.join(missing)}"
    except zipfile.BadZipFile:
        return False, "不是有效的 zip 文件"

    return True, ""
