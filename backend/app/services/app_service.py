"""应用管理服务：CRUD、上传、部署、停止、重启、删除。"""
from __future__ import annotations

import asyncio
import os
import shutil
from functools import partial
from pathlib import Path
from typing import Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.exceptions import (
    AppBuildInProgress,
    AppNotFound,
    Forbidden,
    InvalidFile,
    NoContainer,
    NoUploadedCode,
    SlugTaken,
    UserNotFound,
)
from app.models.app import App
from app.models.app_extra import AppExtra
from app.models.user import User
from app.services.docker import DockerService
from app.services.nginx import NginxService, build_reverse_proxy_fields
from app.services.storage import safe_extract_zip, validate_zip_structure
from app.utils.network import get_local_ip
from app.utils.time import now_cst
from app.utils.upload_paths import app_code_storage_dirname, app_upload_base_path

# ── 服务实例（延迟初始化）──────────────────────────
_docker: Optional[DockerService] = None
_nginx: NginxService = NginxService()


def _get_docker() -> DockerService:
    """获取 Docker 服务实例（延迟初始化）"""
    global _docker
    if _docker is None:
        _docker = DockerService()
    return _docker


# ── 辅助 ─────────────────────────────────────────────

async def _get_app(db: AsyncSession, app_id: int) -> App:
    result = await db.execute(select(App).where(App.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise AppNotFound(app_id=app_id)
    return app


async def _get_owner(db: AsyncSession, owner_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == owner_id))
    return result.scalar_one_or_none()


async def _get_owners_batch(db: AsyncSession, owner_ids: list[int]) -> dict[int, User]:
    if not owner_ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(owner_ids)))
    return {u.id: u for u in result.scalars().all()}


def _app_access_url(slug: str) -> str:
    """Streamlit baseUrlPath 下浏览器须访问带末尾 / 的路径，否则常白屏、静态资源 404。"""
    return f"/apps/{slug}/"


def _app_to_dict(app: App, owner: Optional[User] = None) -> dict:
    return {
        "id": app.id,
        "name": app.name,
        "slug": app.slug,
        "description": app.description,
        "status": app.status,
        "host_port": app.host_port,
        "container_ip": app.container_ip,
        "build_log": app.build_log,
        "access_url": _app_access_url(app.slug) if app.status == "running" else None,
        "reverse_proxy_path_prefix": app.reverse_proxy_path_prefix,
        "reverse_proxy_backend_url": app.reverse_proxy_backend_url,
        "reverse_proxy_middlewares": app.reverse_proxy_middlewares,
        "reverse_proxy_traefik_router": f"app-{app.id}" if app.status == "running" else None,
        "owner": owner,
        "created_at": app.created_at,
        "updated_at": app.updated_at,
    }


def _check_permission(app: App, user_id: int, role: str) -> None:
    if role != "admin" and app.owner_id != user_id:
        raise Forbidden()


# ── CRUD ─────────────────────────────────────────────

async def list_apps(
    db: AsyncSession, page: int = 1, size: int = 20, status_filter: Optional[str] = None
) -> dict:
    query = select(App)
    count_query = select(func.count()).select_from(App)
    if status_filter:
        query = query.where(App.status == status_filter)
        count_query = count_query.where(App.status == status_filter)

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    result = await db.execute(
        query.order_by(App.created_at.desc()).offset((page - 1) * size).limit(size)
    )
    apps = list(result.scalars().all())

    owner_ids = list({a.owner_id for a in apps})
    owners = await _get_owners_batch(db, owner_ids)

    items = []
    for a in apps:
        d = _app_to_dict(a, owners.get(a.owner_id))
        items.append(d)

    return {"total": total, "page": page, "size": size, "items": items}


async def create_app(db: AsyncSession, name: str, slug: str, description: Optional[str], owner_id: int) -> dict:
    existing = await db.execute(select(App).where(App.slug == slug))
    if existing.scalar_one_or_none():
        raise SlugTaken(slug)

    app = App(name=name, slug=slug, description=description, owner_id=owner_id, status="pending")
    db.add(app)
    await db.commit()
    await db.refresh(app)

    owner = await _get_owner(db, owner_id)
    return _app_to_dict(app, owner)


async def get_app(db: AsyncSession, app_id: int) -> dict:
    app = await _get_app(db, app_id)
    owner = await _get_owner(db, app.owner_id)
    return _app_to_dict(app, owner)


async def update_app(
    db: AsyncSession, app_id: int,
    name: Optional[str] = None, description: Optional[str] = None, owner_id: Optional[int] = None,
) -> dict:
    app = await _get_app(db, app_id)
    if owner_id is not None:
        result = await db.execute(select(User).where(User.id == owner_id))
        if not result.scalar_one_or_none():
            raise UserNotFound(user_id=owner_id)
        app.owner_id = owner_id
    if name is not None:
        app.name = name
    if description is not None:
        app.description = description
    await db.commit()
    await db.refresh(app)
    owner = await _get_owner(db, app.owner_id)
    return _app_to_dict(app, owner)


async def get_app_logs(db: AsyncSession, app_id: int) -> dict:
    app = await _get_app(db, app_id)
    return {"app_id": app.id, "status": app.status, "log": app.build_log or ""}


# ── 上传 ─────────────────────────────────────────────

async def upload_code(db: AsyncSession, app_id: int, zip_path: str, user_id: int, role: str) -> dict:
    app = await _get_app(db, app_id)
    _check_permission(app, user_id, role)

    ok, msg = validate_zip_structure(zip_path)
    if not ok:
        raise InvalidFile(msg)

    owner = await _get_owner(db, app.owner_id)
    owner_username = owner.username if owner else "unknown"

    upload_path = await asyncio.to_thread(
        _extract_upload, zip_path, app_id, owner_username, app.name,
    )

    app.upload_path = upload_path
    app.status = "pending"
    app.container_ip = get_local_ip()

    # 尝试读取 README.md 作为描述
    readme_path = Path(upload_path) / "README.md"
    if readme_path.exists():
        try:
            app.description = readme_path.read_text(encoding="utf-8")[:2000]
        except Exception:
            pass

    await db.commit()
    await db.refresh(app)
    return {
        "message": "上传成功",
        "app_id": app.id,
        "upload_path": upload_path,
        "container_ip": app.container_ip,
    }


def _extract_upload(zip_path: str, app_id: int, owner_username: str, app_name: str) -> str:
    dirname = app_code_storage_dirname(owner_username, app_name, app_id)
    base = Path(settings.upload_dir) / dirname
    down_dir = Path(settings.down_dir) / dirname

    down_backup = base / "_down_backup"
    if down_backup.exists():
        shutil.rmtree(down_backup)
    if down_dir.exists():
        shutil.move(str(down_dir), str(down_backup))

    data_backup = None
    legacy_data = base / "data"
    if legacy_data.exists():
        data_backup = base / "_data_backup"
        if data_backup.exists():
            shutil.rmtree(data_backup)
        shutil.move(str(legacy_data), str(data_backup))

    # 清理并解压
    if base.exists():
        for item in base.iterdir():
            if item.name.startswith("_data_backup") or item.name.startswith("_down_backup"):
                continue
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
    base.mkdir(parents=True, exist_ok=True)

    safe_extract_zip(zip_path, str(base))

    # 运行产出统一在 down/；重传时先恢复备份，否则迁入旧版 uploads/.../data
    if down_backup.exists():
        if down_dir.exists():
            shutil.rmtree(down_dir)
        shutil.move(str(down_backup), str(down_dir))
    elif data_backup and data_backup.exists():
        if down_dir.exists():
            shutil.rmtree(down_dir)
        shutil.move(str(data_backup), str(down_dir))
    else:
        down_dir.mkdir(parents=True, exist_ok=True)

    packaged_data = base / "data"
    if packaged_data.is_dir():
        shutil.rmtree(packaged_data, ignore_errors=True)

    ver_file = down_dir / ".deploy_version"
    ver = 0
    if ver_file.exists():
        try:
            ver = int(ver_file.read_text().strip())
        except Exception:
            pass
    ver_file.write_text(str(ver + 1))

    # 查找包含 app.py 的目录（最多 3 层）
    for depth in range(4):
        for p in base.glob("/".join(["*"] * depth + ["app.py"])):
            return str(p.parent)
    return str(base)


# ── 部署 ─────────────────────────────────────────────

async def validate_deploy(db: AsyncSession, app_id: int, user_id: int, role: str) -> dict:
    app = await _get_app(db, app_id)
    _check_permission(app, user_id, role)
    if not app.upload_path:
        raise NoUploadedCode()
    if app.status == "building":
        raise AppBuildInProgress()

    app.status = "building"
    await db.commit()
    return {
        "message": "部署任务已提交",
        "app_id": app_id,
        "status": "building",
        "access_url": _app_access_url(app.slug),
    }


async def run_deploy(db: AsyncSession, app_id: int) -> None:
    result = await db.execute(select(App).where(App.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        return

    try:
        app.status = "building"
        app.build_log = "开始构建...\n"
        await db.commit()

        owner = await _get_owner(db, app.owner_id)
        owner_username = owner.username if owner else "unknown"

        # Docker 操作是同步的，放到线程池
        loop = asyncio.get_event_loop()
        deploy_result = await loop.run_in_executor(
            None,
            _get_docker().build_and_run,
            app.id,
            app.slug,
            app.upload_path,
            owner_username,
            app.name,
        )

        path_prefix, backend_url, mw_csv = build_reverse_proxy_fields(
            app.slug, deploy_result["host_port"],
        )
        await loop.run_in_executor(
            None,
            partial(
                _nginx.write_route,
                app.id,
                app.slug,
                deploy_result["host_port"],
                path_prefix=path_prefix,
                backend_url=backend_url,
                middlewares_csv=mw_csv,
            ),
        )

        app.status = "running"
        app.container_id = deploy_result["container_id"]
        app.container_name = deploy_result["container_name"]
        app.host_port = deploy_result["host_port"]
        app.build_log = deploy_result["build_log"]
        app.reverse_proxy_path_prefix = path_prefix
        app.reverse_proxy_backend_url = backend_url
        app.reverse_proxy_middlewares = mw_csv
        await db.commit()

    except Exception as e:
        app.status = "failed"
        app.build_log = (app.build_log or "") + f"\n构建失败: {e}"
        await db.commit()


# ── 停止 / 重启 / 删除 ──────────────────────────────

async def stop_app(db: AsyncSession, app_id: int, user_id: int, role: str) -> dict:
    app = await _get_app(db, app_id)
    _check_permission(app, user_id, role)

    loop = asyncio.get_event_loop()
    if app.container_name:
        await loop.run_in_executor(None, _get_docker().stop, app.container_name)
        await loop.run_in_executor(None, _nginx.remove_route, app.id)

    app.status = "stopped"
    app.reverse_proxy_path_prefix = None
    app.reverse_proxy_backend_url = None
    app.reverse_proxy_middlewares = None
    await db.commit()
    return {"message": "已停止", "app_id": app.id}


async def restart_app(db: AsyncSession, app_id: int, user_id: int, role: str) -> dict:
    app = await _get_app(db, app_id)
    _check_permission(app, user_id, role)
    if not app.container_name:
        raise NoContainer()

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _get_docker().restart, app.container_name)
    if app.host_port:
        path_prefix, backend_url, mw_csv = build_reverse_proxy_fields(app.slug, app.host_port)
        await loop.run_in_executor(
            None,
            partial(
                _nginx.write_route,
                app.id,
                app.slug,
                app.host_port,
                path_prefix=path_prefix,
                backend_url=backend_url,
                middlewares_csv=mw_csv,
            ),
        )
        app.reverse_proxy_path_prefix = path_prefix
        app.reverse_proxy_backend_url = backend_url
        app.reverse_proxy_middlewares = mw_csv

    app.status = "running"
    await db.commit()
    return {"message": "已重启", "app_id": app.id}


async def delete_app(db: AsyncSession, app_id: int, user_id: int, role: str) -> None:
    app = await _get_app(db, app_id)
    _check_permission(app, user_id, role)

    owner = await _get_owner(db, app.owner_id)
    owner_username = owner.username if owner else "unknown"

    loop = asyncio.get_event_loop()
    docker = _get_docker()
    if app.container_name:
        await loop.run_in_executor(None, docker.remove, app.container_name)
    await loop.run_in_executor(
        None, partial(docker.remove_image, app.id, app.slug, owner_username, app.name)
    )
    await loop.run_in_executor(None, _nginx.remove_route, app.id)

    for root in (Path(settings.upload_dir), Path(settings.host_upload_dir)):
        upload_base = app_upload_base_path(root, app)
        if upload_base.exists():
            shutil.rmtree(upload_base, ignore_errors=True)

    down_name = app_upload_base_path(Path(settings.upload_dir), app).name
    for root in {Path(settings.down_dir), Path(settings.host_down_dir)}:
        down_base = root / down_name
        if down_base.exists():
            shutil.rmtree(down_base, ignore_errors=True)

    await db.execute(delete(AppExtra).where(AppExtra.app_id == app.id))
    await db.delete(app)
    await db.commit()


# ── 统计用辅助 ───────────────────────────────────────

async def list_all_apps(db: AsyncSession) -> list[App]:
    result = await db.execute(select(App))
    return list(result.scalars().all())


async def count_apps(db: AsyncSession, status_filter: Optional[str] = None) -> int:
    query = select(func.count()).select_from(App)
    if status_filter:
        query = query.where(App.status == status_filter)
    result = await db.execute(query)
    return result.scalar_one()
