"""历史记录服务：单应用历史、跨应用历史列表、文件下载路径。

所有历史记录从数据库 app_extra 表读取，下载文件统一存储在 download_storage_dir。
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.exceptions import AppNotFound, Forbidden
from app.models.app import App
from app.models.app_extra import AppExtra
from app.utils.time import now_cst


def _get_summary_type(summary: int, file_path: str | None) -> str:
    """根据 summary 和 file_path 获取操作类型。"""
    if summary == 0:
        # 管理操作，从 file_path 解析具体操作
        if file_path and file_path.startswith("action:"):
            action = file_path[7:]
            return {
                "upload": "上传",
                "deploy": "部署",
                "stop": "停止",
                "restart": "重启",
                "update": "更新",
                "delete": "删除",
                "view": "访问",
            }.get(action, "管理")
        return "管理"
    elif summary == 1:
        return "访问"
    elif summary == 2:
        return "下载"
    elif summary == 3:
        return "下载"  # Bridge 上传的文件也显示为"下载"
    return "其他"


# ── 单应用历史（从数据库读取）────────────────────────────

async def get_app_history(db: AsyncSession, app_id: int, username: str, role: str) -> list:
    """获取单个应用的历史记录。

    从数据库 app_extra 表查询，支持权限过滤。
    """
    result = await db.execute(select(App).where(App.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise AppNotFound(app_id=app_id)

    # 构建查询
    query = select(AppExtra).where(AppExtra.app_id == app_id)
    if role != "admin":
        query = query.where(AppExtra.username == username)
    query = query.order_by(AppExtra.timestamp.desc(), AppExtra.id.desc()).limit(200)

    r = await db.execute(query)
    records = list(r.scalars().all())

    # 转换为前端格式
    result_list = []
    for rec in records:
        ts_key = rec.timestamp.strftime("%Y%m%d_%H%M%S")
        summary_type = _get_summary_type(rec.summary, rec.file_path)

        item = {
            "run_id": ts_key,
            "username": rec.username or "",
            "timestamp": rec.timestamp.isoformat(),
            "summary_type": summary_type,
            "summary_code": rec.summary,
            "request_path": rec.request_path or "",
            "request_method": rec.request_method or "",
            "client_ip": rec.client_ip or "",
            "files": [],
        }

        # 如果是下载记录，添加文件信息
        if rec.summary == 2 and rec.file_path:
            item["files"].append({
                "name": rec.file_original_name or Path(rec.file_path).name,
                "path": rec.file_path,
                "size": rec.file_size or 0,
                "category": "download",
            })

        result_list.append(item)

    return result_list


# ── 跨应用批次列表（直接查询数据库）──────────────────

async def list_grouped_runs(db: AsyncSession, user_id: int, role: str) -> dict:
    """从数据库查询历史记录，每条记录独立返回。

    改造后不再扫描磁盘，直接从 app_extra 表查询。
    支持显示已删除应用的记录（使用记录中保存的 app_name）。
    """
    # 获取所有应用（用于显示应用名称，已删除的用记录中的 app_name）
    result = await db.execute(select(App))
    apps = list(result.scalars().all())
    app_map = {a.id: a for a in apps}

    # 构建查询条件
    if role == "admin":
        # admin 可以看到所有记录
        query = (
            select(AppExtra)
            .order_by(AppExtra.timestamp.desc(), AppExtra.id.desc())
            .limit(500)
        )
    else:
        # 普通用户只能看到自己的记录（按 username 过滤）
        from app.models.user import User
        user_result = await db.execute(select(User.username).where(User.id == user_id))
        username = user_result.scalar_one_or_none()
        if not username:
            return {"groups": []}

        query = (
            select(AppExtra)
            .where(AppExtra.username == username)
            .order_by(AppExtra.timestamp.desc(), AppExtra.id.desc())
            .limit(500)
        )

    r = await db.execute(query)
    records = list(r.scalars().all())

    # 构建记录列表
    groups = _build_records_list(records, app_map)
    return {"groups": groups}


def _build_records_list(records: list[AppExtra], app_map: dict) -> list[dict]:
    """将数据库记录转换为前端展示格式。

    Args:
        records: AppExtra 记录列表
        app_map: app_id -> App 映射

    Returns:
        记录列表
    """
    result = []

    for rec in records:
        app = app_map.get(rec.app_id)
        # 即使应用被删除，也使用记录中保存的 app_name
        app_name = rec.app_name or (app.name if app else f"已删除应用({rec.app_id})")
        app_slug = app.slug if app else ""

        ts_key = rec.timestamp.strftime("%Y%m%d_%H%M%S")
        summary_type = _get_summary_type(rec.summary, rec.file_path)

        item = {
            "ts_key": ts_key,
            "app_id": rec.app_id,
            "app_name": app_name,
            "app_slug": app_slug,
            "app_deleted": app is None,
            "timestamp": rec.timestamp.isoformat(),
            "username": rec.username or "",
            "summary_type": summary_type,
            "summary_code": rec.summary,
            "request_path": rec.request_path or "",
            "request_method": rec.request_method or "",
            "client_ip": rec.client_ip or "",
            "files": [],
        }

        # 如果是下载或自动上传记录，添加文件信息
        if rec.summary in (2, 3) and rec.file_path:
            # 根据 summary 类型确定下载路径
            if rec.summary == 3:
                # Bridge 上传的文件，路径格式: {app_id}/{date}/{filename}
                download_url = f"/api/apps/bridge-downloads/{rec.file_path}"
            else:
                # 普通下载，路径格式: {app_id}/{username}/{date}/{filename}
                download_url = f"/api/apps/downloads/{rec.file_path}"

            item["files"].append({
                "name": rec.file_original_name or Path(rec.file_path).name,
                "path": rec.file_path,
                "size": rec.file_size or 0,
                "category": "download",
                "download_url": download_url,
            })

        result.append(item)

    return result[:200]


# ── 记录 View ──────────────────────────────────

async def record_view(db: AsyncSession, app_id: int, username: str = "anonymous") -> dict:
    """记录应用访问到数据库。

    不再写本地 JSON 文件，直接写入 app_extra 表。
    """
    result = await db.execute(select(App).where(App.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        return {"ok": False, "reason": "app not found"}

    try:
        db.add(
            AppExtra(
                app_id=app_id,
                app_name=app.name,
                username=(username or "anonymous")[:255],
                timestamp=now_cst(),
                summary=1,  # 访问
                request_path="action:view",
            )
        )
        await db.commit()
    except Exception:
        return {"ok": False, "reason": "database error"}

    return {"ok": True}


# ── 文件下载（统一从 download_storage_dir 读取）─────────

async def get_download_file_path(
    db: AsyncSession,
    file_path: str,
    user_id: int,
    username: str,
    role: str,
) -> Path:
    """从统一下载目录获取文件路径。

    文件路径格式: {app_id}/{username}/{date}/{filename}
    权限检查: admin 可访问所有，普通用户只能访问自己的文件
    """
    base = Path(settings.download_storage_dir).resolve()
    target = (base / file_path).resolve()

    # 安全检查：路径必须在 download_storage_dir 内
    if not str(target).startswith(str(base)):
        raise Forbidden("访问被拒绝")

    if not target.exists():
        raise FileNotFoundError("文件不存在")

    # 权限检查：路径格式为 {app_id}/{username}/{date}/{filename}
    parts = file_path.split("/")
    if len(parts) >= 2:
        path_username = parts[1]
        if role != "admin" and path_username != username:
            raise Forbidden("访问被拒绝")

    return target

