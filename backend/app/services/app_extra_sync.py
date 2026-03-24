"""将磁盘上的访问埋点同步到 app_extra（summary=0）。

「访问」= 仅打开应用页面，对应 POST …/internal/view 写入的 view_*.json。
「使用」= 其它带应用 ID 的 API 请求，由 AppUsageTrackingMiddleware 写入 summary=1。
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.app import App
from app.models.app_extra import AppExtra
from app.utils.upload_paths import app_data_dir
from app.utils.time import now_cst


def _read_json_safe(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _parse_tracking_ts(raw: str | None) -> datetime:
    if not raw:
        return now_cst()
    try:
        ts = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if ts.tzinfo is not None:
            ts = ts.replace(tzinfo=None)
        return ts
    except Exception:
        return now_cst()


def _sync_views_for_app(db: AsyncSession, app: App, dd: Path, existing_paths: set[str]) -> None:
    tracking_dir = dd / "history" / "_tracking"
    if not tracking_dir.exists():
        return
    for f in tracking_dir.glob("view_*.json"):
        try:
            rel = str(f.relative_to(dd)).replace("\\", "/")
        except ValueError:
            continue
        if rel in existing_paths:
            continue
        data = _read_json_safe(f)
        if not data or data.get("type") != "view":
            continue
        uname = str(data.get("username", "anonymous"))[:255]
        ts = _parse_tracking_ts(data.get("timestamp"))
        db.add(
            AppExtra(
                app_id=app.id,
                username=uname,
                timestamp=ts,
                summary=0,
                file_path=rel[:255],
            )
        )
        existing_paths.add(rel)


async def sync_app_extra_views_from_disk(db: AsyncSession, apps: list[App]) -> None:
    """补全仅访问记录：来自 history/_tracking/view_*.json（与 record_view 一致）。"""
    for app in apps:
        dd = app_data_dir(Path(settings.upload_dir), Path(settings.down_dir), app)
        if not dd.exists():
            continue

        r0 = await db.execute(
            select(AppExtra.file_path).where(AppExtra.app_id == app.id, AppExtra.summary == 0)
        )
        existing_paths = set(r0.scalars().all())

        _sync_views_for_app(db, app, dd, existing_paths)

    await db.commit()
