import json
import logging
import os
import re
import tempfile
from collections import defaultdict
from datetime import datetime
from app.utils.time_utils import CST
from pathlib import Path

logger = logging.getLogger(__name__)
MAX_ZIP_SIZE = 100 * 1024 * 1024  # 100 MB

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import get_current_user, get_db, require_admin
from app.models.app import App
from app.models.user import User
from app.schemas.app import AppCreate, AppListItem, AppListResponse, AppOut, AppUpdate
from app.schemas.user import UserOut
from app.services import app_service, docker_service, traefik_service
from app.utils.file_utils import validate_zip_structure

router = APIRouter(prefix="/api/apps", tags=["apps"])


def _build_app_out(app: App, db: Session) -> dict:
    owner = db.query(User).filter(User.id == app.owner_id).first()
    data = {
        "id": app.id,
        "name": app.name,
        "slug": app.slug,
        "description": app.description,
        "status": app.status,
        "host_port": app.host_port,
        "build_log": app.build_log,
        "access_url": f"/apps/{app.slug}" if app.status == "running" else None,
        "owner": UserOut.model_validate(owner),
        "created_at": app.created_at,
        "updated_at": app.updated_at,
    }
    return data


@router.get("", response_model=AppListResponse)
def list_apps(
    page: int = 1,
    size: int = 20,
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(App)
    if status:
        query = query.filter(App.status == status)
    total = query.count()
    apps = query.order_by(App.created_at.desc()).offset((page - 1) * size).limit(size).all()

    # 批量加载 owner，避免 N+1 查询
    owner_ids = list({app.owner_id for app in apps})
    owners = {u.id: u for u in db.query(User).filter(User.id.in_(owner_ids)).all()} if owner_ids else {}

    items = [
        AppListItem(
            id=app.id,
            name=app.name,
            slug=app.slug,
            description=app.description,
            status=app.status,
            access_url=f"/apps/{app.slug}" if app.status == "running" else None,
            owner=UserOut.model_validate(owners[app.owner_id]),
            created_at=app.created_at,
            updated_at=app.updated_at,
        )
        for app in apps
    ]

    return AppListResponse(total=total, page=page, size=size, items=items)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_app(
    body: AppCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(App).filter(App.slug == body.slug).first():
        raise HTTPException(status_code=400, detail=f"slug '{body.slug}' 已被占用")

    app = App(
        name=body.name,
        slug=body.slug,
        description=body.description,
        owner_id=current_user.id,
        status="pending",
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return _build_app_out(app, db)


@router.get("/history/runs")
def list_all_runs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    apps = db.query(App).all()
    all_runs = []

    for app in apps:
        history_dir = Path(settings.upload_dir) / str(app.id) / "data" / "history"
        if not history_dir.exists():
            continue
        # 只取最新 50 条，避免全量读取
        files = sorted(history_dir.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True)[:50]
        for f in files:
            try:
                record = json.loads(f.read_text(encoding="utf-8"))
                if current_user.role != "admin" and record.get("username") != current_user.username:
                    continue
                all_runs.append({
                    **record,
                    "app_id": app.id,
                    "app_name": app.name,
                    "app_slug": app.slug,
                })
            except Exception as e:
                logger.warning("解析历史文件 %s 失败: %s", f, e)
                continue

    all_runs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return {"runs": all_runs[:200]}


@router.get("/history/files")
def list_all_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    apps = db.query(App).all()
    all_files = []

    for app in apps:
        # 权限：非管理员只能看自己拥有的应用的文件
        if current_user.role != "admin" and app.owner_id != current_user.id:
            continue
        data_dir = Path(settings.upload_dir) / str(app.id) / "data"
        if not data_dir.exists():
            continue
        for f in data_dir.rglob("*"):
            if f.is_file() and not f.name.startswith("."):
                stat = f.stat()
                all_files.append({
                    "app_id": app.id,
                    "app_name": app.name,
                    "app_slug": app.slug,
                    "name": f.name,
                    "path": str(f.relative_to(data_dir)),
                    "size": stat.st_size,
                    "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=CST).isoformat(),
                })

    all_files.sort(key=lambda x: x["modified_at"], reverse=True)
    return {"files": all_files[:500]}


# ---------- 时间戳正则：提取 YYYYMMDD_HHMMSS ----------
_TS_RE = re.compile(r"(\d{8}_\d{6})")
# batch_result_* 或 batch_*_all/_part 文件用于识别"主批次"时间戳
_BATCH_PREFIX_RE = re.compile(r"^batch_(?:result_)?(\d{8}_\d{6})")


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
        # 中间产物应该在主批次开始之后、60 分钟之内
        if 0 <= delta <= 3600:
            if best_delta is None or delta < best_delta:
                best = bts
                best_delta = delta
    return best


@router.get("/history/grouped")
def list_grouped_runs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """按批次时间戳聚合 results/ 和 history/batch/ 下的文件，返回分组列表。"""
    apps = db.query(App).all()
    all_groups: list[dict] = []

    for app in apps:
        # 权限：非管理员只能看自己拥有的应用的文件
        if current_user.role != "admin" and app.owner_id != current_user.id:
            continue

        data_dir = Path(settings.upload_dir) / str(app.id) / "data"
        results_dir = data_dir / "results"
        batch_dir = data_dir / "history" / "batch"

        # ---- 第一遍：收集所有文件和它们的原始时间戳 ----
        raw_files: list[tuple[str, dict]] = []  # (ts_key, file_info)
        batch_ts_set: set[str] = set()  # 主批次时间戳集合

        # 扫描 results/
        if results_dir.exists():
            for f in results_dir.iterdir():
                if not f.is_file() or f.name.startswith("."):
                    continue
                m = _TS_RE.search(f.name)
                if not m:
                    continue
                ts_key = m.group(1)
                stat = f.stat()
                info = {
                    "name": f.name,
                    "path": str(f.relative_to(data_dir)),
                    "size": stat.st_size,
                    "category": "result",
                }
                raw_files.append((ts_key, info))
                # batch_result_* 标记为主批次
                if f.name.startswith("batch_result_"):
                    batch_ts_set.add(ts_key)

        # 扫描 history/batch/
        if batch_dir.exists():
            for f in batch_dir.iterdir():
                if not f.is_file() or f.name.startswith("."):
                    continue
                m = _TS_RE.search(f.name)
                if not m:
                    continue
                ts_key = m.group(1)
                stat = f.stat()
                info = {
                    "name": f.name,
                    "path": str(f.relative_to(data_dir)),
                    "size": stat.st_size,
                    "category": "detail",
                }
                raw_files.append((ts_key, info))
                # batch_*_all / batch_*_part 也是主批次标记
                if _BATCH_PREFIX_RE.match(f.name):
                    batch_ts_set.add(ts_key)

        # 扫描 outputs/ (平台标准机制)
        outputs_dir = data_dir / "outputs"
        if outputs_dir.exists():
            for entry in outputs_dir.iterdir():
                if entry.is_dir():
                    # 子目录模式：outputs/{timestamp_dir}/file.csv
                    m = _TS_RE.search(entry.name)
                    if not m:
                        continue
                    ts_key = m.group(1)
                    for f in entry.iterdir():
                        if not f.is_file() or f.name.startswith("."):
                            continue
                        stat = f.stat()
                        raw_files.append((ts_key, {
                            "name": f.name,
                            "path": str(f.relative_to(data_dir)),
                            "size": stat.st_size,
                            "category": "output",
                        }))
                    batch_ts_set.add(ts_key)
                elif entry.is_file() and not entry.name.startswith("."):
                    # 散文件模式：outputs/20260317_100730_xxx_result.csv
                    m = _TS_RE.search(entry.name)
                    if not m:
                        continue
                    ts_key = m.group(1)
                    stat = entry.stat()
                    raw_files.append((ts_key, {
                        "name": entry.name,
                        "path": str(entry.relative_to(data_dir)),
                        "size": stat.st_size,
                        "category": "output",
                    }))
                    batch_ts_set.add(ts_key)

        # ---- 第二遍：将非主批次文件归并到最近的主批次 ----
        batch_ts_list = sorted(batch_ts_set)
        ts_files: dict[str, list[dict]] = defaultdict(list)

        for ts_key, info in raw_files:
            if ts_key in batch_ts_set:
                ts_files[ts_key].append(info)
            else:
                parent = _find_batch_ts(ts_key, batch_ts_list)
                if parent:
                    ts_files[parent].append(info)
                else:
                    # 找不到归属的主批次，单独成组
                    ts_files[ts_key].append(info)

        # 读取 history/*.json 元数据（平台标准机制）
        history_dir = data_dir / "history"
        run_meta: dict[str, dict] = {}
        if history_dir.exists():
            for f in history_dir.glob("*.json"):
                try:
                    record = json.loads(f.read_text(encoding="utf-8"))
                    rid = record.get("run_id", "")
                    m = _TS_RE.search(rid)
                    ts_key = m.group(1) if m else rid
                    run_meta[ts_key] = record
                except Exception:
                    continue

        # 从 _tracking/ 中读取 view 记录（用于匹配用户名），
        # 读取所有非 anonymous 的记录按时间排序
        tracking_dir = data_dir / "history" / "_tracking"
        tracking_records: list[dict] = []
        if tracking_dir.exists():
            for f in tracking_dir.iterdir():
                if not f.is_file() or not f.name.endswith(".json"):
                    continue
                try:
                    record = json.loads(f.read_text(encoding="utf-8"))
                    uname = record.get("username", "")
                    if uname and uname != "anonymous":
                        tracking_records.append(record)
                except Exception:
                    continue
            tracking_records.sort(key=lambda r: r.get("timestamp", ""))

        for ts_key, files in ts_files.items():
            meta = run_meta.get(ts_key, {})
            try:
                dt = datetime.strptime(ts_key, "%Y%m%d_%H%M%S").replace(tzinfo=CST)
                timestamp = dt.isoformat()
            except ValueError:
                timestamp = meta.get("timestamp", "")

            username = meta.get("username", "")
            summary = meta.get("summary", "")

            # 如果 meta 中没有 username，尝试从 _tracking 记录中匹配
            if not username and tracking_records:
                try:
                    group_dt = datetime.strptime(ts_key, "%Y%m%d_%H%M%S")
                except ValueError:
                    group_dt = None
                if group_dt:
                    best_user = ""
                    best_delta = None
                    for tr in tracking_records:
                        try:
                            tr_dt = datetime.fromisoformat(tr["timestamp"].replace("+08:00", "").replace("Z", ""))
                        except Exception:
                            continue
                        delta = abs((tr_dt - group_dt).total_seconds())
                        if delta <= 1800 and (best_delta is None or delta < best_delta):
                            best_user = tr.get("username", "")
                            best_delta = delta
                    username = best_user

            # 如果没有 summary，用主结果文件名作为默认摘要
            if not summary:
                result_files = [f for f in files if f.get("category") == "result"]
                if result_files:
                    summary = result_files[0]["name"]
                elif files:
                    summary = files[0]["name"]

            # 如果没有 metadata JSON 但有推断出的信息，自动补写到磁盘
            # （保底机制：让 stats.py 等其他读取方也能受益）
            if ts_key not in run_meta and (username or summary):
                try:
                    meta_path = history_dir / f"{ts_key}.json"
                    if not meta_path.exists():
                        history_dir.mkdir(parents=True, exist_ok=True)
                        backfill = {
                            "run_id": ts_key,
                            "username": username,
                            "timestamp": timestamp,
                            "summary": summary,
                        }
                        meta_path.write_text(
                            json.dumps(backfill, ensure_ascii=False), encoding="utf-8"
                        )
                except Exception:
                    pass

            all_groups.append({
                "ts_key": ts_key,
                "app_id": app.id,
                "app_name": app.name,
                "app_slug": app.slug,
                "timestamp": timestamp,
                "username": username if username != "anonymous" else "",
                "summary": summary,
                "files": sorted(files, key=lambda x: x["name"]),
            })

    all_groups.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"groups": all_groups[:200]}


@router.post("/internal/view/{app_id}")
def record_view_internal(app_id: int, body: dict = None, db: Session = Depends(get_db)):
    """前端点击 App 时调用，记录一次访问（view）"""
    import uuid
    from app.utils.time_utils import now_cst

    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        return {"ok": False, "reason": "app not found"}

    username = (body or {}).get("username", "anonymous") or "anonymous"

    tracking_dir = Path(settings.upload_dir) / str(app_id) / "data" / "history" / "_tracking"
    tracking_dir.mkdir(parents=True, exist_ok=True)

    view_id = str(uuid.uuid4())
    record = {
        "run_id": view_id,
        "type": "view",
        "username": username,
        "timestamp": now_cst().isoformat(),
        "app_id": app_id,
        "app_name": app.name,
    }
    (tracking_dir / f"{view_id}.json").write_text(
        json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return {"ok": True}


@router.post("/internal/run/{app_id}")
def record_run_internal(app_id: int, body: dict = None, db: Session = Depends(get_db)):
    """供 App 容器内部调用，无需鉴权，记录一次运行到 history 目录"""
    import uuid
    from app.utils.time_utils import now_cst

    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        return {"ok": False, "reason": "app not found"}

    username = (body or {}).get("username", "anonymous") or "anonymous"

    tracking_dir = Path(settings.upload_dir) / str(app_id) / "data" / "history" / "_tracking"
    tracking_dir.mkdir(parents=True, exist_ok=True)

    run_id = str(uuid.uuid4())
    record = {
        "run_id": run_id,
        "type": "run",
        "username": username,
        "timestamp": now_cst().isoformat(),
        "app_id": app_id,
        "app_name": app.name,
    }
    (tracking_dir / f"{run_id}.json").write_text(
        json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return {"ok": True, "run_id": run_id}


@router.get("/{app_id}")
def get_app(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App 不存在")
    return _build_app_out(app, db)


@router.patch("/{app_id}")
def update_app_info(
    app_id: int,
    body: AppUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """管理员修改应用信息（名称、描述、所有者）"""
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App 不存在")

    if body.name is not None:
        app.name = body.name
    if body.description is not None:
        app.description = body.description
    if body.owner_id is not None:
        owner = db.query(User).filter(User.id == body.owner_id).first()
        if not owner:
            raise HTTPException(status_code=400, detail="目标用户不存在")
        app.owner_id = body.owner_id

    db.commit()
    db.refresh(app)
    return _build_app_out(app, db)


@router.post("/{app_id}/upload")
async def upload_zip(
    app_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App 不存在")
    if current_user.role != "admin" and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限操作")

    if file.content_type not in ("application/zip", "application/x-zip-compressed"):
        if not file.filename.endswith(".zip"):
            raise HTTPException(status_code=400, detail="只支持 .zip 格式")

    # 临时保存 zip 文件
    content = await file.read()
    if len(content) > MAX_ZIP_SIZE:
        raise HTTPException(status_code=400, detail="文件过大，最大支持 100 MB")

    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        ok, msg = validate_zip_structure(tmp_path)
        if not ok:
            raise HTTPException(status_code=400, detail=msg)

        extract_path = app_service.extract_upload(tmp_path, app_id)
        app.upload_path = extract_path
        app.status = "pending"

        # 自动读取 README.md 作为应用说明
        readme_path = Path(extract_path) / "README.md"
        if readme_path.exists():
            try:
                app.description = readme_path.read_text(encoding="utf-8")
            except Exception:
                pass

        db.commit()
    finally:
        os.unlink(tmp_path)

    return {"message": "上传成功", "app_id": app_id, "upload_path": extract_path}


@router.post("/{app_id}/deploy", status_code=status.HTTP_202_ACCEPTED)
def deploy(
    app_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App 不存在")
    if current_user.role != "admin" and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限操作")
    if not app.upload_path:
        raise HTTPException(status_code=400, detail="请先上传代码文件")
    if app.status == "building":
        raise HTTPException(status_code=400, detail="正在构建中，请等待")

    # 立即标记 building 防止重复提交
    app.status = "building"
    db.commit()

    # 创建新的 db session 供 BackgroundTask 使用
    from app.database import SessionLocal

    def run_deploy():
        bg_db = SessionLocal()
        try:
            import asyncio
            asyncio.run(app_service.deploy_app(app_id, bg_db))
        finally:
            bg_db.close()

    background_tasks.add_task(run_deploy)

    return {
        "message": "部署任务已提交",
        "app_id": app_id,
        "status": "building",
        "access_url": f"/apps/{app.slug}",
    }


@router.post("/{app_id}/stop")
def stop_app(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App 不存在")
    if current_user.role != "admin" and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限操作")

    if app.container_name:
        docker_service.stop_container(app.container_name)
        traefik_service.remove_route(app_id)

    app.status = "stopped"
    db.commit()
    return {"message": "已停止", "app_id": app_id}


@router.post("/{app_id}/restart")
def restart_app(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App 不存在")
    if current_user.role != "admin" and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限操作")
    if not app.container_name:
        raise HTTPException(status_code=400, detail="容器不存在，请重新部署")

    try:
        docker_service.restart_container(app.container_name)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if app.host_port:
        traefik_service.write_route(app_id, app.slug, app.host_port)

    app.status = "running"
    db.commit()
    return {"message": "已重启", "app_id": app_id}


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_app(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App 不存在")
    if current_user.role != "admin" and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限操作")

    # 停容器 + 删路由
    if app.container_name:
        docker_service.remove_container(app.container_name)
    traefik_service.remove_route(app_id)

    # 删文件
    if app.upload_path and Path(app.upload_path).exists():
        import shutil
        shutil.rmtree(app.upload_path, ignore_errors=True)

    db.delete(app)
    db.commit()


@router.get("/{app_id}/history")
def get_history(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App 不存在")

    history_dir = Path(settings.upload_dir) / str(app_id) / "data" / "history"
    if not history_dir.exists():
        return []

    records = []
    for f in history_dir.glob("*.json"):
        try:
            record = json.loads(f.read_text(encoding="utf-8"))
            # 普通用户只能看自己的记录，管理员可看全部
            if current_user.role != "admin" and record.get("username") != current_user.username:
                continue
            records.append(record)
        except Exception:
            continue

    return sorted(records, key=lambda x: x.get("timestamp", ""), reverse=True)


@router.get("/{app_id}/outputs/{run_id}/{filename}")
def download_output(
    app_id: int,
    run_id: str,
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App 不存在")
    if current_user.role != "admin" and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限访问")

    allowed_base = (Path(settings.upload_dir) / str(app_id) / "data" / "outputs").resolve()
    file_path = (allowed_base / run_id / filename).resolve()

    # 防止路径穿越
    if not str(file_path).startswith(str(allowed_base)):
        raise HTTPException(status_code=403, detail="访问被拒绝")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(path=file_path, filename=filename)


@router.get("/{app_id}/files/{file_path:path}")
def download_data_file(
    app_id: int,
    file_path: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App 不存在")
    if current_user.role != "admin" and app.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限访问")

    allowed_base = (Path(settings.upload_dir) / str(app_id) / "data").resolve()
    target = (allowed_base / file_path).resolve()

    if not str(target).startswith(str(allowed_base)):
        raise HTTPException(status_code=403, detail="访问被拒绝")
    if not target.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(path=target, filename=target.name)


@router.get("/{app_id}/logs")
def get_logs(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App 不存在")
    return {"app_id": app_id, "status": app.status, "log": app.build_log or ""}
