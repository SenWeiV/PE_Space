"""本机网络地址辅助。"""
from __future__ import annotations

import socket


def get_local_ip() -> str:
    """返回本机用于对外通信的 IPv4 地址；无法解析时回退为 127.0.0.1。"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        finally:
            s.close()
    except OSError:
        pass
    try:
        return socket.gethostbyname(socket.gethostname())
    except OSError:
        return "127.0.0.1"
