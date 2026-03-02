import os
import zipfile
from pathlib import Path


def safe_extract_zip(zip_path: str, extract_to: str) -> None:
    """解压 zip 文件，防止路径穿越攻击"""
    extract_to = Path(extract_to).resolve()

    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.namelist():
            # 防止路径穿越：确保解压目标在指定目录内
            target = (extract_to / member).resolve()
            if not str(target).startswith(str(extract_to)):
                raise ValueError(f"Unsafe path in zip: {member}")
        zf.extractall(extract_to)


def validate_zip_structure(zip_path: str) -> tuple[bool, str]:
    """校验 zip 包是否包含必要文件"""
    required_files = {"app.py", "requirements.txt"}

    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            names = set(zf.namelist())
            # 支持两种结构：文件在根目录，或在一级子目录下
            root_files = {name.split("/")[-1] for name in names if name.endswith(".py") or name.endswith(".txt")}
            missing = required_files - {name for name in names if name in required_files or name.endswith("/" + name)}

            # 简单检查：zip 中任意路径包含这两个文件名即可
            flat_names = {os.path.basename(n) for n in names}
            missing = required_files - flat_names
            if missing:
                return False, f"缺少必要文件: {', '.join(missing)}"
    except zipfile.BadZipFile:
        return False, "不是有效的 zip 文件"

    return True, ""
