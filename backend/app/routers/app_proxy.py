"""应用代理路由：转发请求到 Docker 容器，记录访问日志。

所有对 /proxy/{slug}/* 的请求都会被转发到对应的应用容器，
同时记录访问日志到数据库，拦截文件下载并统一存储。
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session_factory
from app.dependencies import get_db
from app.models.app import App
from app.models.app_extra import AppExtra
from app.services.auth import decode_token
from app.utils.download_storage import (
    get_download_storage_path,
    is_file_download_response,
    parse_filename_from_disposition,
)
from app.utils.time import now_cst

router = APIRouter(tags=["proxy"])
log = logging.getLogger(__name__)

# HTTP 客户端连接池
_http_client: Optional[httpx.AsyncClient] = None


async def get_http_client() -> httpx.AsyncClient:
    """获取共享的 HTTP 客户端实例。"""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(300.0, connect=10.0),
            follow_redirects=False,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        )
    return _http_client


async def get_app_by_slug(db: AsyncSession, slug: str) -> Optional[App]:
    """通过 slug 查询应用。"""
    result = await db.execute(select(App).where(App.slug == slug))
    return result.scalar_one_or_none()


def get_client_ip(request: Request) -> str:
    """获取客户端真实 IP。"""
    # 优先从代理头获取
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    # 回退到直连 IP
    if request.client:
        return request.client.host
    return "unknown"


def extract_username_from_request(request: Request) -> str:
    """从请求中提取用户名。"""
    # 尝试从 Authorization 头解析
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        payload = decode_token(auth[7:].strip())
        if payload and payload.get("username"):
            return str(payload["username"])[:255]

    # 尝试从 Cookie 解析
    token = request.cookies.get("token")
    if token:
        payload = decode_token(token)
        if payload and payload.get("username"):
            return str(payload["username"])[:255]

    return "anonymous"


async def record_proxy_access(
    db: AsyncSession,
    app_id: int,
    username: str,
    request_path: str,
    request_method: str,
    client_ip: str,
    response_status: int,
    file_path: Optional[str] = None,
    file_size: Optional[int] = None,
    file_original_name: Optional[str] = None,
) -> None:
    """记录代理访问日志到数据库。"""
    summary = 2 if file_path else 1  # 2=下载, 1=使用
    db.add(AppExtra(
        app_id=app_id,
        username=username,
        timestamp=now_cst(),
        summary=summary,
        request_path=request_path[:512] if request_path else None,
        request_method=request_method[:10] if request_method else None,
        client_ip=client_ip[:45] if client_ip else None,
        response_status=response_status,
        file_path=file_path[:512] if file_path else None,
        file_size=file_size,
        file_original_name=file_original_name[:255] if file_original_name else None,
    ))
    await db.commit()


@router.api_route(
    "/{slug}/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def proxy_http(
    slug: str,
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """HTTP 请求代理。

    将请求转发到应用容器，记录访问日志，拦截文件下载。
    """
    # 1. 查询应用
    app = await get_app_by_slug(db, slug)
    if not app:
        raise HTTPException(404, f"应用 {slug} 不存在")
    if app.status != "running" or not app.host_port:
        raise HTTPException(503, f"应用 {slug} 未运行")

    # 2. 提取用户信息
    username = extract_username_from_request(request)
    client_ip = get_client_ip(request)

    # 3. 构建上游 URL
    upstream_url = f"http://{settings.host_ip}:{app.host_port}/apps/{slug}/{path}"
    if request.query_params:
        upstream_url += f"?{request.query_params}"

    # 4. 准备请求头
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("Host", None)
    headers["X-Real-IP"] = client_ip
    headers["X-Forwarded-For"] = request.headers.get("X-Forwarded-For", client_ip)
    headers["X-PE-Username"] = username
    headers["X-PE-App-ID"] = str(app.id)

    # 5. 转发请求
    try:
        http_client = await get_http_client()
        body = await request.body()

        response = await http_client.request(
            method=request.method,
            url=upstream_url,
            headers=headers,
            content=body,
        )
    except httpx.RequestError as e:
        log.warning("代理请求失败 app=%s path=%s error=%s", slug, path, e)
        raise HTTPException(502, f"无法连接到应用: {e}")

    # 6. 判断是否为文件下载
    content_type = response.headers.get("content-type", "")
    content_disposition = response.headers.get("content-disposition", "")
    is_download = is_file_download_response(content_type, content_disposition)

    file_path = None
    file_size = None
    file_original_name = None

    if is_download and response.status_code == 200:
        # 7. 拦截文件下载，保存到统一目录
        original_name = parse_filename_from_disposition(content_disposition)
        if not original_name:
            original_name = path.split("/")[-1] or "download"

        abs_path, rel_path = get_download_storage_path(app.id, username, original_name)
        content = response.content
        abs_path.write_bytes(content)

        file_path = rel_path
        file_size = len(content)
        file_original_name = original_name

    # 8. 记录访问日志
    request_path = f"/proxy/{slug}/{path}"
    try:
        await record_proxy_access(
            db, app.id, username, request_path, request.method,
            client_ip, response.status_code,
            file_path, file_size, file_original_name,
        )
    except Exception as e:
        log.warning("记录代理日志失败: %s", e)

    # 9. 构建响应
    response_headers = dict(response.headers)
    # 移除可能导致问题的头
    for h in ("transfer-encoding", "content-encoding", "content-length"):
        response_headers.pop(h, None)
        response_headers.pop(h.title(), None)

    return Response(
        content=response.content,
        status_code=response.status_code,
        headers=response_headers,
        media_type=content_type or None,
    )


@router.api_route("/{slug}", methods=["GET"])
async def proxy_http_root(slug: str, request: Request, db: AsyncSession = Depends(get_db)):
    """处理不带尾部斜杠的请求，重定向到带斜杠的路径。"""
    return Response(
        status_code=301,
        headers={"Location": f"/proxy/{slug}/"},
    )


@router.websocket("/{slug}/{path:path}")
async def proxy_websocket(websocket: WebSocket, slug: str, path: str):
    """WebSocket 双向代理。

    支持 Streamlit 等需要 WebSocket 的应用。
    """
    await websocket.accept()

    # 查询应用
    async with async_session_factory() as db:
        app = await get_app_by_slug(db, slug)
        if not app or app.status != "running" or not app.host_port:
            await websocket.close(code=1008, reason="应用未运行")
            return

        # 记录 WebSocket 连接
        username = "anonymous"
        auth = websocket.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            payload = decode_token(auth[7:].strip())
            if payload and payload.get("username"):
                username = str(payload["username"])

        try:
            await record_proxy_access(
                db, app.id, username, f"/proxy/{slug}/{path}",
                "WS", websocket.client.host if websocket.client else "unknown",
                101,  # WebSocket upgrade status
            )
        except Exception as e:
            log.warning("记录 WebSocket 日志失败: %s", e)

        host_port = app.host_port

    # 构建上游 WebSocket URL
    upstream_ws = f"ws://{settings.host_ip}:{host_port}/apps/{slug}/{path}"
    if websocket.query_params:
        upstream_ws += f"?{websocket.query_params}"

    try:
        import websockets
    except ImportError:
        log.error("websockets 库未安装，无法代理 WebSocket")
        await websocket.close(code=1011, reason="服务器配置错误")
        return

    try:
        async with websockets.connect(
            upstream_ws,
            extra_headers={
                "X-PE-Username": username,
                "X-PE-App-ID": str(app.id) if app else "",
            },
        ) as upstream:
            async def client_to_server():
                try:
                    while True:
                        data = await websocket.receive()
                        if data["type"] == "websocket.receive":
                            if "text" in data:
                                await upstream.send(data["text"])
                            elif "bytes" in data:
                                await upstream.send(data["bytes"])
                        elif data["type"] == "websocket.disconnect":
                            break
                except WebSocketDisconnect:
                    pass

            async def server_to_client():
                try:
                    async for message in upstream:
                        if isinstance(message, str):
                            await websocket.send_text(message)
                        else:
                            await websocket.send_bytes(message)
                except Exception:
                    pass

            await asyncio.gather(
                client_to_server(),
                server_to_client(),
                return_exceptions=True,
            )
    except Exception as e:
        log.warning("WebSocket 代理错误 slug=%s: %s", slug, e)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
