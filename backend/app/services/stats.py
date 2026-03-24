"""统计服务。"""
from __future__ import annotations

from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app import App
from app.models.app_extra import AppExtra
from app.models.user import User
from app.services.app_extra_sync import sync_app_extra_views_from_disk


async def get_stats(db: AsyncSession) -> dict:
    app_result = await db.execute(select(App))
    apps = list(app_result.scalars().all())

    user_result = await db.execute(select(User).order_by(User.id))
    users = list(user_result.scalars().all())

    user_map = {u.id: u for u in users}

    # ── 访问（仅页面）先补全磁盘埋点；使用（其它 API）由中间件实时写入 ──
    await sync_app_extra_views_from_disk(db, apps)

    app_ids = [a.id for a in apps]

    app_view_count: dict[int, int] = {}
    app_view_users_count: dict[int, int] = {}
    app_run_count: dict[int, int] = {}
    app_run_users_count: dict[int, int] = {}
    user_view_count: dict[str, int] = {}
    user_app_views: dict[str, dict[int, int]] = defaultdict(dict)
    user_app_runs: dict[str, dict[int, int]] = defaultdict(dict)

    if app_ids:
        vc = await db.execute(
            select(AppExtra.app_id, func.count(AppExtra.id))
            .where(AppExtra.app_id.in_(app_ids), AppExtra.summary == 0)
            .group_by(AppExtra.app_id)
        )
        app_view_count = {row[0]: row[1] for row in vc.all()}

        vu = await db.execute(
            select(AppExtra.app_id, func.count(func.distinct(AppExtra.username)))
            .where(AppExtra.app_id.in_(app_ids), AppExtra.summary == 0)
            .group_by(AppExtra.app_id)
        )
        app_view_users_count = {row[0]: row[1] for row in vu.all()}

        rc = await db.execute(
            select(AppExtra.app_id, func.count(AppExtra.id))
            .where(AppExtra.app_id.in_(app_ids), AppExtra.summary == 1)
            .group_by(AppExtra.app_id)
        )
        app_run_count = {row[0]: row[1] for row in rc.all()}

        ru = await db.execute(
            select(AppExtra.app_id, func.count(func.distinct(AppExtra.username)))
            .where(AppExtra.app_id.in_(app_ids), AppExtra.summary == 1)
            .group_by(AppExtra.app_id)
        )
        app_run_users_count = {row[0]: row[1] for row in ru.all()}

        uvc = await db.execute(
            select(AppExtra.username, func.count(AppExtra.id))
            .where(
                AppExtra.app_id.in_(app_ids),
                AppExtra.summary == 0,
                AppExtra.username != "anonymous",
            )
            .group_by(AppExtra.username)
        )
        user_view_count = {row[0]: row[1] for row in uvc.all()}

        uav = await db.execute(
            select(AppExtra.username, AppExtra.app_id, func.count(AppExtra.id))
            .where(
                AppExtra.app_id.in_(app_ids),
                AppExtra.summary == 0,
                AppExtra.username != "anonymous",
            )
            .group_by(AppExtra.username, AppExtra.app_id)
        )
        for uname, aid, cnt in uav.all():
            user_app_views[uname][aid] = cnt

        uar = await db.execute(
            select(AppExtra.username, AppExtra.app_id, func.count(AppExtra.id))
            .where(AppExtra.app_id.in_(app_ids), AppExtra.summary == 1)
            .group_by(AppExtra.username, AppExtra.app_id)
        )
        for uname, aid, cnt in uar.all():
            user_app_runs[uname][aid] = cnt

    # ── 组装 apps 统计 ───────────────────────────────
    apps_stats = []
    for app in apps:
        owner = user_map.get(app.owner_id)
        apps_stats.append({
            "id": app.id,
            "name": app.name,
            "slug": app.slug,
            "status": app.status,
            "owner": owner.username if owner else "unknown",
            "created_at": app.created_at.isoformat() if app.created_at else "",
            "view_count": app_view_count.get(app.id, 0),
            "view_users": app_view_users_count.get(app.id, 0),
            "run_count": app_run_count.get(app.id, 0),
            "run_users": app_run_users_count.get(app.id, 0),
        })
    apps_stats.sort(key=lambda a: (a["run_count"], a["view_count"]), reverse=True)

    # ── 组装 users 统计 ──────────────────────────────
    user_upload_count: dict[int, int] = {}
    for app in apps:
        user_upload_count[app.owner_id] = user_upload_count.get(app.owner_id, 0) + 1

    users_stats = []
    for u in users:
        uname = u.username
        vc = user_view_count.get(uname, 0)
        rc = sum(user_app_runs.get(uname, {}).values())
        users_stats.append({
            "id": u.id,
            "username": uname,
            "role": u.role,
            "is_active": u.is_active,
            "upload_count": user_upload_count.get(u.id, 0),
            "view_count": vc,
            "run_count": rc,
        })
    users_stats.sort(key=lambda u: (u["view_count"] + u["run_count"]), reverse=True)

    # ── 组装 usage_detail ────────────────────────────
    usage_detail = []
    all_usernames = set(user_app_views.keys()) | set(user_app_runs.keys())
    app_name_map = {a.id: a.name for a in apps}

    for uname in all_usernames:
        if uname == "anonymous":
            continue
        detail_app_ids = set(user_app_views.get(uname, {}).keys()) | set(user_app_runs.get(uname, {}).keys())
        for aid in detail_app_ids:
            vc = user_app_views.get(uname, {}).get(aid, 0)
            rc = user_app_runs.get(uname, {}).get(aid, 0)
            usage_detail.append({
                "username": uname,
                "app_id": aid,
                "app_name": app_name_map.get(aid, ""),
                "view_count": vc,
                "run_count": rc,
            })
    usage_detail.sort(key=lambda d: (d["view_count"] + d["run_count"]), reverse=True)

    return {"apps": apps_stats, "users": users_stats, "usage_detail": usage_detail}
