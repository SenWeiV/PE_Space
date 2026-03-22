"""全站 IP 白名单中间件（白名单为空时不限制）。"""
from __future__ import annotations

import logging
from typing import Callable

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.database import async_session_factory
from app.services import config as config_service
from app.utils.ip_allowlist import client_in_allowlist, get_client_ip, parse_allowlist_entries
from app.config import settings

logger = logging.getLogger(__name__)

def _exempt_path(path: str) -> bool:
    """健康检查与 OpenAPI 文档不受白名单限制（便于探活与联调）。"""
    if path == "/api/health":
        return True
    if path in ("/docs", "/redoc", "/openapi.json"):
        return True
    if path.startswith("/docs/") or path.startswith("/redoc/"):
        return True
    return False


async def reload_ip_allowlist_cache(app: FastAPI) -> None:
    """从数据库（或 .env 回退）加载并解析白名单，写入 app.state。"""
    try:
        async with async_session_factory() as db:
            raw = await config_service.get_ip_allowlist_runtime_raw(db)
    except Exception as e:
        logger.exception("加载 IP 白名单失败，本进程暂不启用白名单: %s", e)
        raw = (settings.ip_allowlist or "").strip()
    nets = parse_allowlist_entries(raw)
    app.state.ip_allowlist_networks = nets
    app.state.ip_allowlist_active = len(nets) > 0
    if raw.strip() and not nets:
        logger.warning(
            "IP 白名单配置非空但无法解析出任何有效网段，将不限制访问；请检查格式（每行一条 IP 或 CIDR）",
        )
    if app.state.ip_allowlist_active:
        logger.info("IP 白名单已启用，共 %d 条 CIDR/地址", len(nets))
    else:
        logger.info("IP 白名单未配置，不限制访问来源")


class IPAllowlistMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        app: FastAPI = request.app
        if _exempt_path(request.url.path):
            return await call_next(request)

        if not getattr(app.state, "ip_allowlist_active", False):
            return await call_next(request)

        nets = getattr(app.state, "ip_allowlist_networks", None) or []
        ip = get_client_ip(request, trust_x_forwarded_for=settings.ip_allowlist_trust_x_forwarded_for)
        if client_in_allowlist(
            ip,
            nets,
            allow_loopback=settings.ip_allowlist_allow_loopback,
        ):
            return await call_next(request)

        logger.warning("IP 不在白名单，拒绝访问: ip=%s path=%s", ip or "(空)", request.url.path)
        return JSONResponse(status_code=403, content={"detail": "当前 IP 不在访问白名单内"})
