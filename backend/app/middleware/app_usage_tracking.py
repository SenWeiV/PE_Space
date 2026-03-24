"""将「管理操作」记录写入 app_extra（summary=1）。

注意：应用访问记录已改由 /proxy/{slug}/ 代理路由统一处理，
本中间件仅记录管理操作（上传、部署、启停等），不再记录文件下载。

只统计「有意义」的管理交互：
- POST：上传代码、部署应用
- PATCH：更新应用信息
- DELETE：停止、删除应用

不统计：
- GET 请求（应用访问由代理路由记录）
- 打开应用详情、日志、历史等查询操作
"""
from __future__ import annotations

import logging
import re
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.database import async_session_factory
from app.models.app_extra import AppExtra
from app.services.auth import decode_token
from app.utils.time import now_cst

log = logging.getLogger(__name__)

_APP_SCOPED = re.compile(r"^/api/apps/(\d+)")
_APP_DELETE_RE = re.compile(r"^/api/apps/\d+$")

# 需要记录的管理操作路径
_ADMIN_ACTIONS = re.compile(
    r"^/api/apps/\d+/(upload|deploy|stop|restart)$"
)


def _should_record_usage(method: str, path: str) -> bool:
    """判断是否需要记录管理操作。"""
    # 删除应用时，主记录已经被删；若再写 app_extra 会触发 FK 失败
    if method == "DELETE" and _APP_DELETE_RE.match(path):
        return False

    # 只记录管理操作（POST 上传/部署，DELETE 停止等）
    if method == "POST" and _ADMIN_ACTIONS.match(path):
        return True
    if method == "DELETE" and _ADMIN_ACTIONS.match(path):
        return True

    # PATCH 更新应用信息
    if method == "PATCH" and _APP_DELETE_RE.match(path):
        return True

    return False


def _get_action_description(method: str, path: str) -> str:
    """获取操作描述。"""
    if "/upload" in path:
        return "upload"
    if "/deploy" in path:
        return "deploy"
    if "/stop" in path:
        return "stop"
    if "/restart" in path:
        return "restart"
    if method == "PATCH":
        return "update"
    if method == "DELETE":
        return "delete"
    return "admin"


class AppUsageTrackingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        try:
            if response.status_code >= 400:
                return response
            if request.method == "OPTIONS":
                return response
            path = request.url.path
            m = _APP_SCOPED.match(path)
            if not m:
                return response
            if not _should_record_usage(request.method, path):
                return response
            app_id = int(m.group(1))

            auth = request.headers.get("Authorization") or ""
            username = "anonymous"
            if auth.startswith("Bearer "):
                payload = decode_token(auth[7:].strip())
                if payload:
                    username = str(payload.get("username") or "anonymous")[:255]

            action = _get_action_description(request.method, path)
            async with async_session_factory() as session:
                session.add(
                    AppExtra(
                        app_id=app_id,
                        username=username,
                        timestamp=now_cst(),
                        summary=0,
                        request_path=path[:512],
                        request_method=request.method[:10],
                        file_path=f"action:{action}",
                    )
                )
                await session.commit()
        except Exception as exc:
            log.warning("app usage tracking failed: %s", exc)
        return response
