"""应用数据 API：供 Streamlit 应用调用，保存历史记录和输出文件。

Streamlit 应用通过请求头获取身份信息：
- X-PE-Username: 用户名（由代理注入）
- X-PE-App-ID: 应用 ID（由代理注入）

注意：这些 API 设计为被应用容器内部调用，路径以 /_pe/ 开头，
代理层会将其转发到后端处理，而非转发到应用容器。
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db
from app.models.app_extra import AppExtra
from app.models.user import User
from app.services.auth import decode_token, verify_bridge_secret
from app.utils.download_storage import get_download_storage_path, sanitize_filename
from app.utils.time import now_cst

router = APIRouter(prefix="/api/app-data", tags=["app-data"])
log = logging.getLogger(__name__)


class SaveHistoryRequest(BaseModel):
    """保存历史记录请求体。"""
    run_id: str
    inputs: dict = {}
    summary: str = ""
    output_files: list[str] = []


class SaveHistoryResponse(BaseModel):
    """保存历史记录响应。"""
    ok: bool
    run_id: str = ""
    message: str = ""


class SaveFileResponse(BaseModel):
    """保存文件响应。"""
    ok: bool
    file_path: str = ""
    message: str = ""


def _get_app_id(x_pe_app_id: Optional[str] = Header(None)) -> int:
    """从请求头获取应用 ID。"""
    if not x_pe_app_id:
        raise HTTPException(400, "缺少 X-PE-App-ID 请求头")
    try:
        return int(x_pe_app_id)
    except ValueError:
        raise HTTPException(400, "X-PE-App-ID 格式错误")


def _get_username(x_pe_username: Optional[str] = Header(None)) -> str:
    """从请求头获取用户名。"""
    return (x_pe_username or "anonymous")[:255]


async def _get_app_name(db: AsyncSession, app_id: int) -> Optional[str]:
    """从数据库获取应用名称。"""
    from app.models.app import App
    result = await db.execute(select(App.name).where(App.id == app_id))
    row = result.scalar_one_or_none()
    return row if row else None


@router.post("/history", response_model=SaveHistoryResponse)
async def save_history(
    req: SaveHistoryRequest,
    db: AsyncSession = Depends(get_db),
    x_pe_app_id: Optional[str] = Header(None),
    x_pe_username: Optional[str] = Header(None),
):
    """保存运行历史记录到数据库。

    Streamlit 应用在处理完成后调用此接口，记录本次运行的摘要信息。
    """
    app_id = _get_app_id(x_pe_app_id)
    username = _get_username(x_pe_username)
    app_name = await _get_app_name(db, app_id)

    try:
        # 构建 file_path 字段：存储 inputs 和 output_files 的 JSON 摘要
        import json
        file_path_data = json.dumps({
            "run_id": req.run_id,
            "inputs": req.inputs,
            "summary": req.summary,
            "output_files": req.output_files,
        }, ensure_ascii=False)

        db.add(AppExtra(
            app_id=app_id,
            app_name=app_name,
            username=username,
            timestamp=now_cst(),
            summary=1,  # 使用类型
            request_path=f"run:{req.run_id}",
            request_method="RUN",
            file_path=file_path_data[:512] if len(file_path_data) > 512 else file_path_data,
            file_original_name=req.summary[:255] if req.summary else None,
        ))
        await db.commit()

        return SaveHistoryResponse(ok=True, run_id=req.run_id)

    except Exception as e:
        log.exception("保存历史记录失败: %s", e)
        return SaveHistoryResponse(ok=False, message=str(e))


@router.post("/file", response_model=SaveFileResponse)
async def save_file(
    file: UploadFile = File(...),
    filename: str = Form(None),
    category: str = Form("output"),
    db: AsyncSession = Depends(get_db),
    x_pe_app_id: Optional[str] = Header(None),
    x_pe_username: Optional[str] = Header(None),
):
    """保存输出文件到统一存储目录。

    Streamlit 应用在生成输出文件后调用此接口，文件会被保存到统一的下载目录。
    返回的 file_path 可用于后续下载。

    Args:
        file: 上传的文件
        filename: 自定义文件名（可选，默认使用上传文件名）
        category: 文件分类，如 output、result、report 等
    """
    app_id = _get_app_id(x_pe_app_id)
    username = _get_username(x_pe_username)
    app_name = await _get_app_name(db, app_id)

    try:
        original_name = filename or file.filename or "unnamed"
        safe_name = sanitize_filename(original_name)

        # 生成存储路径
        abs_path, rel_path = get_download_storage_path(app_id, username, safe_name)

        # 写入文件
        content = await file.read()
        abs_path.write_bytes(content)
        file_size = len(content)

        # 记录到数据库
        db.add(AppExtra(
            app_id=app_id,
            app_name=app_name,
            username=username,
            timestamp=now_cst(),
            summary=2,  # 下载类型
            request_path=f"save:{category}",
            request_method="SAVE",
            file_path=rel_path,
            file_size=file_size,
            file_original_name=original_name[:255],
        ))
        await db.commit()

        return SaveFileResponse(ok=True, file_path=rel_path)

    except Exception as e:
        log.exception("保存文件失败: %s", e)
        return SaveFileResponse(ok=False, message=str(e))


@router.get("/download/{file_path:path}")
async def download_file(
    file_path: str,
    db: AsyncSession = Depends(get_db),
    x_pe_app_id: Optional[str] = Header(None),
    x_pe_username: Optional[str] = Header(None),
):
    """下载之前保存的文件。

    权限检查：普通用户只能下载自己的文件，admin 可下载所有文件。
    """
    from pathlib import Path
    from fastapi.responses import FileResponse

    app_id = _get_app_id(x_pe_app_id)
    username = _get_username(x_pe_username)

    base = Path(settings.download_storage_dir).resolve()
    target = (base / file_path).resolve()

    # 安全检查
    if not str(target).startswith(str(base)):
        raise HTTPException(403, "访问被拒绝")

    if not target.exists():
        raise HTTPException(404, "文件不存在")

    # 权限检查（路径格式: {app_id}/{username}/{date}/{filename}）
    parts = file_path.split("/")
    if len(parts) >= 2:
        path_username = parts[1]
        if path_username != username:
            # TODO: 如需支持 admin 下载所有文件，这里需要查询用户角色
            raise HTTPException(403, "无权访问此文件")

    return FileResponse(
        path=target,
        filename=target.name,
        media_type="application/octet-stream",
    )


# ── Bridge 文件监听上传 API ──────────────────────────────

class FileWatchResponse(BaseModel):
    """Bridge 文件上传响应。"""
    ok: bool
    file_path: str = ""
    saved_name: str = ""
    message: str = ""


@router.post("/file-watch", response_model=FileWatchResponse)
async def save_watched_file(
    file: UploadFile = File(...),
    original_name: str = Form(...),
    relative_path: str = Form(""),
    db: AsyncSession = Depends(get_db),
    x_pe_app_id: Optional[str] = Header(None, alias="X-PE-App-ID"),
    x_pe_bridge_secret: Optional[str] = Header(None, alias="X-PE-Bridge-Secret"),
    x_pe_username: Optional[str] = Header(None, alias="X-PE-Username"),
):
    """保存 Bridge 监听到的文件。

    由容器内的 pe_bridge.py 进程调用，当 /app/data/outputs 目录
    有新文件产生时自动上传。

    Args:
        file: 上传的文件
        original_name: 原始文件名
        relative_path: 相对于监听目录的路径
        x_pe_app_id: 应用 ID
        x_pe_bridge_secret: Bridge 密钥（用于验证请求来自合法容器）
        x_pe_username: 用户名（Bridge 从 .pe_user 文件读取）
    """
    # 1. 验证应用 ID
    app_id = _get_app_id(x_pe_app_id)

    # 2. 验证 Bridge 密钥
    if not verify_bridge_secret(app_id, x_pe_bridge_secret or ""):
        raise HTTPException(401, "Bridge 密钥验证失败")

    # 3. 获取用户名和应用名
    username = _get_username(x_pe_username)
    app_name = await _get_app_name(db, app_id)

    try:
        # 4. 生成防碰撞文件名: {uuid}_{原始文件名}
        safe_original = sanitize_filename(original_name)
        unique_id = uuid.uuid4().hex[:8]
        saved_name = f"{unique_id}_{safe_original}"

        # 5. 创建存储目录: bridge_uploads/{app_id}/{date}/
        base_dir = Path(settings.bridge_uploads_dir)
        date_str = now_cst().strftime("%Y%m%d")
        target_dir = base_dir / str(app_id) / date_str
        target_dir.mkdir(parents=True, exist_ok=True)

        # 6. 保存文件
        target_path = target_dir / saved_name
        content = await file.read()
        target_path.write_bytes(content)
        file_size = len(content)

        # 7. 计算相对路径（用于数据库记录）
        rel_path = f"{app_id}/{date_str}/{saved_name}"

        # 8. 记录到数据库
        db.add(AppExtra(
            app_id=app_id,
            app_name=app_name,
            username=username,
            timestamp=now_cst(),
            summary=3,  # 3 = Bridge 自动上传
            request_path=f"bridge:{relative_path}",
            request_method="BRIDGE",
            file_path=rel_path,
            file_size=file_size,
            file_original_name=original_name[:255],
        ))
        await db.commit()

        log.info(
            "Bridge 文件上传成功: app=%s user=%s file=%s -> %s",
            app_id, username, original_name, rel_path,
        )

        return FileWatchResponse(
            ok=True,
            file_path=rel_path,
            saved_name=saved_name,
        )

    except Exception as e:
        log.exception("Bridge 文件上传失败: %s", e)
        return FileWatchResponse(ok=False, message=str(e))
