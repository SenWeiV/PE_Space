import json
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import get_db, require_admin
from app.models.app import App
from app.models.user import User

router = APIRouter(prefix="/api/stats", tags=["stats"])

_TS_RE = re.compile(r"(\d{8}_\d{6})")
_BATCH_PREFIX_RE = re.compile(r"^batch_(?:result_)?(\d{8}_\d{6})")


def _load_history(apps):
    """读取所有 app 的 _tracking 目录下的 JSON 文件，返回 views 列表"""
    views = []
    for app in apps:
        tracking_dir = Path(settings.upload_dir) / str(app.id) / "data" / "history" / "_tracking"
        if not tracking_dir.exists():
            continue
        for f in tracking_dir.glob("*.json"):
            try:
                record = json.loads(f.read_text(encoding="utf-8"))
                record.setdefault("app_id", app.id)
                record.setdefault("app_name", app.name)
                views.append(record)
            except Exception:
                continue
    return views


def _find_batch_ts(ts_key: str, batch_ts_list: list[str]) -> str | None:
    """将非主批次时间戳归属到最近的前序主批次（60 分钟内）。"""
    if not batch_ts_list:
        return None
    try:
        t = datetime.strptime(ts_key, "%Y%m%d_%H%M%S")
    except ValueError:
        return None
    best = None
    best_delta = None
    for bts in batch_ts_list:
        try:
            bt = datetime.strptime(bts, "%Y%m%d_%H%M%S")
        except ValueError:
            continue
        delta = (t - bt).total_seconds()
        if 0 <= delta <= 3600:
            if best_delta is None or delta < best_delta:
                best = bts
                best_delta = delta
    return best


def _collect_runs(apps):
    """统计每个 app 的实际运行次数和每次运行的用户名。

    使用与 /history/grouped 端点完全一致的合并逻辑：
    1. 识别主批次时间戳（batch_result_* 或 batch_*_all/_part）
    2. 将非主批次时间戳归并到 60 分钟内最近的主批次
    3. 最终分组数 = 运行次数

    返回:
        app_run_count: {app_id: int}  每个 app 的总运行次数
        app_run_users: {app_id: set}  每个 app 有运行记录的用户集合
        user_app_runs: {username: {app_id: int}}  每用户每 app 的运行次数
    """
    app_run_count: dict[int, int] = defaultdict(int)
    app_run_users: dict[int, set] = defaultdict(set)
    user_app_runs: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))

    for app in apps:
        data_dir = Path(settings.upload_dir) / str(app.id) / "data"

        # ── 第一遍：收集所有带时间戳的文件，标记主批次 ──
        all_ts: set[str] = set()
        batch_ts_set: set[str] = set()

        results_dir = data_dir / "results"
        if results_dir.exists():
            for f in results_dir.iterdir():
                if f.is_file() and not f.name.startswith("."):
                    m = _TS_RE.search(f.name)
                    if m:
                        ts_key = m.group(1)
                        all_ts.add(ts_key)
                        if f.name.startswith("batch_result_"):
                            batch_ts_set.add(ts_key)

        batch_dir = data_dir / "history" / "batch"
        if batch_dir.exists():
            for f in batch_dir.iterdir():
                if f.is_file() and not f.name.startswith("."):
                    m = _TS_RE.search(f.name)
                    if m:
                        ts_key = m.group(1)
                        all_ts.add(ts_key)
                        if _BATCH_PREFIX_RE.match(f.name):
                            batch_ts_set.add(ts_key)

        outputs_dir = data_dir / "outputs"
        if outputs_dir.exists():
            for entry in outputs_dir.iterdir():
                if entry.is_dir():
                    m = _TS_RE.search(entry.name)
                    if m:
                        ts_key = m.group(1)
                        all_ts.add(ts_key)
                        batch_ts_set.add(ts_key)
                elif entry.is_file() and not entry.name.startswith("."):
                    m = _TS_RE.search(entry.name)
                    if m:
                        ts_key = m.group(1)
                        all_ts.add(ts_key)
                        batch_ts_set.add(ts_key)

        # ── 第二遍：合并非主批次到主批次（与 grouped 一致） ──
        batch_ts_list = sorted(batch_ts_set)
        final_groups: set[str] = set()

        for ts_key in all_ts:
            if ts_key in batch_ts_set:
                final_groups.add(ts_key)
            else:
                parent = _find_batch_ts(ts_key, batch_ts_list)
                if parent:
                    final_groups.add(parent)
                else:
                    final_groups.add(ts_key)

        app_run_count[app.id] = len(final_groups)

        # ── 读取 history/*.json 元数据匹配 username ──
        history_dir = data_dir / "history"
        meta_map: dict[str, str] = {}
        if history_dir.exists():
            for f in history_dir.glob("*.json"):
                try:
                    record = json.loads(f.read_text(encoding="utf-8"))
                    rid = record.get("run_id", "")
                    m = _TS_RE.search(rid)
                    ts = m.group(1) if m else rid
                    uname = record.get("username", "")
                    if uname and uname != "anonymous":
                        meta_map[ts] = uname
                except Exception:
                    continue

        for ts_key in final_groups:
            uname = meta_map.get(ts_key, "")
            if uname:
                app_run_users[app.id].add(uname)
                user_app_runs[uname][app.id] += 1

    return app_run_count, app_run_users, user_app_runs


@router.get("")
def get_stats(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    apps = db.query(App).all()
    users = db.query(User).all()
    views = _load_history(apps)
    app_run_count, app_run_users, user_app_runs = _collect_runs(apps)

    # ── 每个 App 维度统计 ─────────────────────────────────────
    app_view_count: dict[int, int] = defaultdict(int)
    app_view_users: dict[int, set] = defaultdict(set)

    for v in views:
        aid = v.get("app_id")
        uname = v.get("username", "anonymous")
        app_view_count[aid] += 1
        if uname != "anonymous":
            app_view_users[aid].add(uname)

    # ── 每个用户维度统计 ──────────────────────────────────────
    user_upload: dict[int, int] = defaultdict(int)
    for app in apps:
        user_upload[app.owner_id] += 1

    user_view_count: dict[str, int] = defaultdict(int)
    user_run_count: dict[str, int] = defaultdict(int)
    for v in views:
        uname = v.get("username", "anonymous")
        user_view_count[uname] += 1
    for uname, app_map in user_app_runs.items():
        user_run_count[uname] = sum(app_map.values())

    # ── 每用户×每App 的详细使用记录 ───────────────────────────
    user_app_detail: dict[str, dict[int, dict]] = defaultdict(lambda: defaultdict(lambda: {"view": 0, "run": 0}))
    for v in views:
        uname = v.get("username", "anonymous")
        if uname == "anonymous":
            continue
        aid = v.get("app_id")
        user_app_detail[uname][aid]["view"] += 1

    for uname, app_map in user_app_runs.items():
        for aid, cnt in app_map.items():
            user_app_detail[uname][aid]["run"] += cnt

    # ── 组装结果 ─────────────────────────────────────────────
    owner_map = {u.id: u.username for u in users}
    app_name_map = {a.id: a.name for a in apps}

    apps_stats = [
        {
            "id": app.id,
            "name": app.name,
            "slug": app.slug,
            "status": app.status,
            "owner": owner_map.get(app.owner_id, ""),
            "created_at": app.created_at,
            "view_count": app_view_count[app.id],
            "view_users": len(app_view_users[app.id]),
            "run_count": app_run_count[app.id],
            "run_users": len(app_run_users[app.id]),
        }
        for app in sorted(apps, key=lambda a: (app_run_count[a.id], app_view_count[a.id]), reverse=True)
    ]

    users_stats = [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "is_active": u.is_active,
            "upload_count": user_upload[u.id],
            "view_count": user_view_count[u.username],
            "run_count": user_run_count.get(u.username, 0),
        }
        for u in sorted(users, key=lambda u: user_view_count[u.username] + user_run_count.get(u.username, 0), reverse=True)
    ]

    usage_detail = []
    for uname, app_map in user_app_detail.items():
        for aid, counts in app_map.items():
            usage_detail.append({
                "username": uname,
                "app_id": aid,
                "app_name": app_name_map.get(aid, f"App#{aid}"),
                "view_count": counts["view"],
                "run_count": counts["run"],
            })
    usage_detail.sort(key=lambda x: x["view_count"] + x["run_count"], reverse=True)

    return {
        "apps": apps_stats,
        "users": users_stats,
        "usage_detail": usage_detail,
    }
