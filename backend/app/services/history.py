"""历史记录服务：单应用历史、跨应用批次分组、访问埋点、文件下载路径。"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.exceptions import AppNotFound, Forbidden
from app.models.app import App
from app.utils.upload_paths import app_data_dir
from app.utils.batch_grouping import (
    extract_timestamp,
    group_by_batch,
    scan_data_dir,
)
from app.utils.time import CST, now_cst


def _read_json_safe(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


# ── 单应用历史 ────────────────────────────────────────

async def get_app_history(db: AsyncSession, app_id: int, username: str, role: str) -> list:
    result = await db.execute(select(App).where(App.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise AppNotFound(app_id=app_id)

    history_dir = app_data_dir(Path(settings.upload_dir), app) / "history"
    if not history_dir.exists():
        return []

    records = []
    for f in history_dir.glob("*.json"):
        data = _read_json_safe(f)
        if data:
            records.append(data)

    if role != "admin":
        records = [r for r in records if r.get("username") == username]

    records.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    return records


# ── 批次分组 ──────────────────────────────────────────

async def list_grouped_runs(db: AsyncSession, user_id: int, role: str) -> dict:
    result = await db.execute(select(App))
    apps = list(result.scalars().all())

    groups = []
    for app in apps:
        if role != "admin" and app.owner_id != user_id:
            continue
        dd = app_data_dir(Path(settings.upload_dir), app)
        if not dd.exists():
            continue

        raw_files, batch_ts_set = scan_data_dir(dd)
        if not raw_files:
            continue
        batches = group_by_batch(raw_files, batch_ts_set)

        # 读取元数据
        meta_map: dict[str, dict] = {}
        history_dir = dd / "history"
        if history_dir.exists():
            for f in history_dir.glob("*.json"):
                data = _read_json_safe(f)
                if data:
                    ts = extract_timestamp(f.stem)
                    if ts:
                        meta_map[ts] = data

        # 读取 tracking 数据
        tracking_records: list[dict] = []
        tracking_dir = dd / "history" / "_tracking"
        if tracking_dir.exists():
            for f in tracking_dir.glob("*.json"):
                data = _read_json_safe(f)
                if data and data.get("username") and data["username"] != "anonymous":
                    tracking_records.append(data)

        for ts_key, files in batches.items():
            try:
                ts_dt = datetime.strptime(ts_key, "%Y%m%d_%H%M%S").replace(
                    tzinfo=CST
                )
            except ValueError:
                ts_dt = now_cst()

            meta = meta_map.get(ts_key, {})
            username = meta.get("username", "")
            summary = meta.get("summary", "")

            # 从 tracking 中匹配用户
            if not username or username == "anonymous":
                best_track = None
                best_delta = None
                for tr in tracking_records:
                    try:
                        tr_time = datetime.fromisoformat(tr["timestamp"]).replace(tzinfo=None)
                        delta = abs((ts_dt.replace(tzinfo=None) - tr_time).total_seconds())
                        if delta <= 1800 and (best_delta is None or delta < best_delta):
                            best_track = tr
                            best_delta = delta
                    except Exception:
                        continue
                if best_track:
                    username = best_track.get("username", "")

            if not summary and files:
                summary = files[0].get("name", "")

            # 回写元数据
            if (username or summary) and ts_key not in meta_map:
                try:
                    history_dir = dd / "history"
                    history_dir.mkdir(parents=True, exist_ok=True)
                    meta_path = history_dir / f"{ts_key}.json"
                    if not meta_path.exists():
                        meta_path.write_text(json.dumps({
                            "run_id": ts_key,
                            "username": username,
                            "timestamp": ts_dt.isoformat(),
                            "summary": summary,
                        }, ensure_ascii=False), encoding="utf-8")
                except Exception:
                    pass

            groups.append({
                "ts_key": ts_key,
                "app_id": app.id,
                "app_name": app.name,
                "app_slug": app.slug,
                "timestamp": ts_dt.isoformat(),
                "username": username,
                "summary": summary,
                "files": files,
            })

    groups.sort(key=lambda g: g["timestamp"], reverse=True)
    return {"groups": groups[:200]}


# ── 记录 View / Run ──────────────────────────────────

async def record_view(db: AsyncSession, app_id: int, username: str = "anonymous") -> dict:
    result = await db.execute(select(App).where(App.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        return {"ok": False, "reason": "app not found"}

    try:
        tracking_dir = app_data_dir(Path(settings.upload_dir), app) / "history" / "_tracking"
        tracking_dir.mkdir(parents=True, exist_ok=True)
        view_id = uuid.uuid4().hex[:12]
        record = {
            "view_id": view_id,
            "type": "view",
            "username": username,
            "timestamp": now_cst().isoformat(),
            "app_id": app_id,
            "app_name": app.name,
        }
        path = tracking_dir / f"view_{view_id}.json"
        path.write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass
    return {"ok": True}


# ── 文件下载 ─────────────────────────────────────────

async def get_output_path(
    db: AsyncSession, app_id: int, run_id: str, filename: str, user_id: int, role: str,
) -> Path:
    result = await db.execute(select(App).where(App.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise AppNotFound(app_id=app_id)
    if role != "admin" and app.owner_id != user_id:
        raise Forbidden("访问被拒绝")

    base = app_data_dir(Path(settings.upload_dir), app) / "outputs"
    target = (base / run_id / filename).resolve()
    if not str(target).startswith(str(base.resolve())):
        raise Forbidden("访问被拒绝")
    if not target.exists():
        raise FileNotFoundError("文件不存在")
    return target


async def get_data_file_path(
    db: AsyncSession, app_id: int, file_path_str: str, user_id: int, role: str,
) -> Path:
    result = await db.execute(select(App).where(App.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise AppNotFound(app_id=app_id)
    if role != "admin" and app.owner_id != user_id:
        raise Forbidden("访问被拒绝")

    base = app_data_dir(Path(settings.upload_dir), app)
    target = (base / file_path_str).resolve()
    if not str(target).startswith(str(base.resolve())):
        raise Forbidden("访问被拒绝")
    if not target.exists():
        raise FileNotFoundError("文件不存在")
    return target
