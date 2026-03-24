"""应用路由。"""
from __future__ import annotations

import os
import tempfile

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.app import AppCreate, AppListResponse, AppUpdate
from app.schemas.user import UserOut
from app.services import app_service, history

router = APIRouter(prefix="/api/apps", tags=["apps"])

MAX_ZIP_SIZE = 100 * 1024 * 1024


def _patch_owner(d: dict) -> dict:
    if d.get("owner"):
        d["owner"] = UserOut.model_validate(d["owner"])
    return d


@router.get("", response_model=AppListResponse)
async def list_apps(
    page: int = 1,
    size: int = 20,
    status: str = None,
    db: AsyncSession = Depends(get_db),
    _auth: User = Depends(get_current_user),
):
    result = await app_service.list_apps(db, page, size, status)
    for item in result["items"]:
        _patch_owner(item)
    return result


@router.post("", status_code=201)
async def create_app(body: AppCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await app_service.create_app(db, body.name, body.slug, body.description, current_user.id)
    return _patch_owner(result)


@router.get("/history/grouped")
async def list_grouped_runs(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await history.list_grouped_runs(db, current_user.id, current_user.role)


@router.post("/internal/view/{app_id}")
async def record_view_endpoint(app_id: int, body: dict = None, db: AsyncSession = Depends(get_db)):
    username = (body or {}).get("username", "anonymous")
    return await history.record_view(db, app_id, username)


@router.get("/{app_id}")
async def get_app(app_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await app_service.get_app(db, app_id)
    return _patch_owner(result)


@router.patch("/{app_id}")
async def update_app(app_id: int, body: AppUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await app_service.update_app(db, app_id, body.name, body.description, body.owner_id)
    return _patch_owner(result)


@router.post("/{app_id}/upload")
async def upload_zip(
    app_id: int, file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = file.filename or ""
    if file.content_type not in ("application/zip", "application/x-zip-compressed"):
        if not name.endswith(".zip"):
            raise HTTPException(status_code=400, detail="只支持 .zip 格式")

    content = await file.read()
    if len(content) > MAX_ZIP_SIZE:
        raise HTTPException(status_code=400, detail="文件过大，最大支持 100 MB")

    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        return await app_service.upload_code(db, app_id, tmp_path, current_user.id, current_user.role)
    finally:
        os.unlink(tmp_path)


@router.post("/{app_id}/deploy", status_code=202)
async def deploy(
    app_id: int, background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await app_service.validate_deploy(db, app_id, current_user.id, current_user.role)

    async def run_deploy_bg():
        async with async_session_factory() as bg_db:
            await app_service.run_deploy(bg_db, app_id)

    background_tasks.add_task(run_deploy_bg)
    return result


@router.post("/{app_id}/stop")
async def stop_app(app_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await app_service.stop_app(db, app_id, current_user.id, current_user.role)


@router.post("/{app_id}/restart")
async def restart_app(app_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await app_service.restart_app(db, app_id, current_user.id, current_user.role)


@router.delete("/{app_id}", status_code=204)
async def delete_app(app_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await app_service.delete_app(db, app_id, current_user.id, current_user.role)


@router.get("/{app_id}/history")
async def get_history(app_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await history.get_app_history(db, app_id, current_user.username, current_user.role)


@router.get("/downloads/{file_path:path}")
async def download_stored_file(
    file_path: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """下载统一存储的文件。

    文件路径格式: {app_id}/{username}/{date}/{filename}
    权限检查: 路径中的 username 必须匹配当前用户（或 admin）
    """
    try:
        path = await history.get_download_file_path(
            db, file_path, current_user.id, current_user.username, current_user.role
        )
        return FileResponse(path=path, filename=path.name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="文件不存在")
    except Exception as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/{app_id}/logs")
async def get_logs(app_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await app_service.get_app_logs(db, app_id)
