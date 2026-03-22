"""配置路由。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.config import (
    ConfigHistoryOut,
    ConfigOut,
    ConfigUpdate,
    IntegrationSettingsOut,
    IntegrationSettingsUpdate,
    IpAllowlistOut,
    IpAllowlistUpdate,
)
from app.middleware.ip_allowlist import reload_ip_allowlist_cache
from app.services import config as config_service

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/template", response_model=ConfigOut)
async def get_template(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await config_service.get_template(db)


@router.put("/template", response_model=ConfigOut)
async def update_template(body: ConfigUpdate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await config_service.update_template(db, body.value, admin.id, admin.username)


@router.get("/template/history", response_model=list[ConfigHistoryOut])
async def get_template_history(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await config_service.get_template_history(db)


@router.get("/integration", response_model=IntegrationSettingsOut)
async def get_integration(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await config_service.get_integration_settings(db)


@router.put("/integration", response_model=IntegrationSettingsOut)
async def update_integration(
    body: IntegrationSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return await config_service.update_integration_settings(
        db,
        body.model_dump(),
        admin.id,
        admin.username,
    )


@router.get("/ip-allowlist", response_model=IpAllowlistOut)
async def get_ip_allowlist(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await config_service.get_ip_allowlist_admin(db)


@router.put("/ip-allowlist", response_model=IpAllowlistOut)
async def put_ip_allowlist(
    request: Request,
    body: IpAllowlistUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await config_service.update_ip_allowlist(db, body.value, admin.id, admin.username)
    await reload_ip_allowlist_cache(request.app)
    return result
