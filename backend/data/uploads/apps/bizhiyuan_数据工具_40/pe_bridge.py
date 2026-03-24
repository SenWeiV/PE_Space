#!/usr/bin/env python3
"""PE Platform Bridge - 容器内桥接模块。

功能：
1. 监听 /app/data/outputs 目录的文件变化
2. 新文件产生时自动上传到后端
3. 从用户文件读取当前用户名

用户追踪方式：
- 应用通过 pe_utils.set_current_user(username) 设置当前用户
- Bridge 从 /app/data/.pe_user 文件读取用户名
- 上传时将用户名传递给后端

此文件会被注入到每个应用容器中。
"""
from __future__ import annotations

import logging
import os
import threading
import time
from pathlib import Path
from typing import Optional

import requests
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="[PE-Bridge %(asctime)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("pe_bridge")

# 环境变量
APP_ID = os.environ.get("PE_APP_ID", "")
API_BASE = os.environ.get("PE_API_BASE", "http://host.docker.internal:8000/api/app-data")
BRIDGE_SECRET = os.environ.get("PE_BRIDGE_SECRET", "")
WATCH_DIR = os.environ.get("PE_WATCH_DIR", "/app/data/outputs")
DATA_DIR = Path("/app/data")

# 用户文件路径（由应用通过 pe_utils 写入）
USER_FILE = DATA_DIR / ".pe_user"


def read_current_user() -> str:
    """读取当前用户名。

    优先级：
    1. 从 /app/data/.pe_user 文件读取（应用通过 pe_utils 设置）
    2. 返回 "unknown"
    """
    if USER_FILE.exists():
        try:
            user = USER_FILE.read_text(encoding="utf-8").strip()
            if user:
                return user
        except Exception as e:
            log.warning("读取用户文件失败: %s", e)

    return "unknown"


class FileUploadHandler(FileSystemEventHandler):
    """文件事件处理器 - 监听新文件并上传。"""

    def __init__(self):
        super().__init__()
        self.uploaded: set[str] = set()  # 已上传文件的唯一标识
        self._upload_lock = threading.Lock()

    def on_created(self, event):
        """文件创建事件。"""
        if event.is_directory:
            return
        self._handle_file(event.src_path)

    def on_modified(self, event):
        """文件修改事件。"""
        if event.is_directory:
            return
        self._handle_file(event.src_path)

    def _handle_file(self, file_path: str) -> None:
        """处理文件上传。"""
        path = Path(file_path)

        # 跳过临时文件和隐藏文件
        if path.name.startswith(".") or path.name.endswith(".tmp"):
            return

        # 等待文件写入完成
        time.sleep(0.5)

        if not path.exists():
            return

        try:
            stat = path.stat()
            if stat.st_size == 0:
                return

            # 生成唯一标识（路径+修改时间+大小）
            file_key = f"{file_path}:{stat.st_mtime}:{stat.st_size}"

            with self._upload_lock:
                if file_key in self.uploaded:
                    return
                self.uploaded.add(file_key)

            # 读取当前用户名
            username = read_current_user()

            # 上传文件
            self._upload(file_path, username)
            log.info("上传成功: %s (用户: %s)", path.name, username)

        except Exception as e:
            log.error("处理文件失败 %s: %s", file_path, e)

    def _upload(self, file_path: str, username: str) -> None:
        """上传文件到后端。"""
        path = Path(file_path)
        watch_dir = Path(WATCH_DIR)

        # 计算相对路径
        try:
            relative_path = str(path.relative_to(watch_dir))
        except ValueError:
            relative_path = path.name

        with open(file_path, "rb") as f:
            response = requests.post(
                f"{API_BASE}/file-watch",
                files={"file": (path.name, f)},
                data={
                    "original_name": path.name,
                    "relative_path": relative_path,
                },
                headers={
                    "X-PE-App-ID": APP_ID,
                    "X-PE-Bridge-Secret": BRIDGE_SECRET,
                    "X-PE-Username": username,
                },
                timeout=120,
            )
            response.raise_for_status()


def start_file_watcher() -> Optional[Observer]:
    """启动文件监听器。"""
    watch_path = Path(WATCH_DIR)

    # 确保目录存在
    watch_path.mkdir(parents=True, exist_ok=True)

    handler = FileUploadHandler()
    observer = Observer()
    observer.schedule(handler, str(watch_path), recursive=True)
    observer.start()

    log.info("文件监听已启动: %s", watch_path)
    return observer


def main():
    """主入口。"""
    if not APP_ID:
        log.error("缺少 PE_APP_ID 环境变量")
        return

    if not BRIDGE_SECRET:
        log.error("缺少 PE_BRIDGE_SECRET 环境变量")
        return

    log.info("PE Bridge 启动 - App ID: %s", APP_ID)
    log.info("监听目录: %s", WATCH_DIR)
    log.info("API 地址: %s", API_BASE)
    log.info("用户文件: %s", USER_FILE)

    observer = start_file_watcher()
    if not observer:
        return

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("收到停止信号，正在退出...")
        observer.stop()

    observer.join()
    log.info("PE Bridge 已停止")


if __name__ == "__main__":
    main()
