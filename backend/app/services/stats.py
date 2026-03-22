"""统计服务。"""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.app import App
from app.models.user import User
from app.utils.upload_paths import app_data_dir
from app.utils.batch_grouping import count_run_groups, extract_timestamp


def _read_json_safe(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


async def get_stats(db: AsyncSession) -> dict:
    app_result = await db.execute(select(App))
    apps = list(app_result.scalars().all())

    user_result = await db.execute(select(User).order_by(User.id))
    users = list(user_result.scalars().all())

    user_map = {u.id: u for u in users}

    # ── 收集 tracking 数据 ────────────────────────────
    # app_id -> list of tracking records
    tracking_by_app: dict[int, list[dict]] = {}
    for app in apps:
        tracking_dir = app_data_dir(Path(settings.upload_dir), app) / "history" / "_tracking"
        if not tracking_dir.exists():
            continue
        records = []
        for f in tracking_dir.glob("*.json"):
            data = _read_json_safe(f)
            if data:
                data.setdefault("app_id", app.id)
                data.setdefault("app_name", app.name)
                records.append(data)
        if records:
            tracking_by_app[app.id] = records

    # ── 收集 run 分组和归属 ───────────────────────────
    app_run_count: dict[int, int] = {}
    app_run_users: dict[int, set] = {}
    user_app_runs: dict[str, dict[int, int]] = {}

    for app in apps:
        dd = app_data_dir(Path(settings.upload_dir), app)
        if not dd.exists():
            app_run_count[app.id] = 0
            app_run_users[app.id] = set()
            continue

        n_groups, group_ts_set = count_run_groups(dd)
        app_run_count[app.id] = n_groups
        app_run_users[app.id] = set()

        # 从 history/*.json 获取用户归属
        history_dir = dd / "history"
        if history_dir.exists():
            for f in history_dir.glob("*.json"):
                data = _read_json_safe(f)
                if data and data.get("username"):
                    ts = extract_timestamp(f.stem)
                    if ts and ts in group_ts_set:
                        uname = data["username"]
                        app_run_users[app.id].add(uname)
                        user_app_runs.setdefault(uname, {})
                        user_app_runs[uname][app.id] = user_app_runs[uname].get(app.id, 0) + 1

    # ── 计算 view 统计 ───────────────────────────────
    app_view_count: dict[int, int] = {}
    app_view_users: dict[int, set] = {}
    user_view_count: dict[str, int] = {}
    user_app_views: dict[str, dict[int, int]] = {}

    for app_id, records in tracking_by_app.items():
        views = [r for r in records if r.get("type") == "view"]
        app_view_count[app_id] = len(views)
        app_view_users[app_id] = {r.get("username", "") for r in views if r.get("username")}
        for r in views:
            uname = r.get("username", "")
            if uname and uname != "anonymous":
                user_view_count[uname] = user_view_count.get(uname, 0) + 1
                user_app_views.setdefault(uname, {})
                user_app_views[uname][app_id] = user_app_views[uname].get(app_id, 0) + 1

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
            "view_users": len(app_view_users.get(app.id, set())),
            "run_count": app_run_count.get(app.id, 0),
            "run_users": len(app_run_users.get(app.id, set())),
        })
    apps_stats.sort(key=lambda a: (a["run_count"], a["view_count"]), reverse=True)

    # ── 组装 users 统计 ──────────────────────────────
    # 每用户上传数
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
        app_ids = set(user_app_views.get(uname, {}).keys()) | set(user_app_runs.get(uname, {}).keys())
        for aid in app_ids:
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
