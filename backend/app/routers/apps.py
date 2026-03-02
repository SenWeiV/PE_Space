import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.app import App
from app.models.user import User
from app.schemas.app import AppCreate, AppListItem, AppListResponse, AppOut
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

    items = []
    for app in apps:
        owner = db.query(User).filter(User.id == app.owner_id).first()
        items.append(
            AppListItem(
                id=app.id,
                name=app.name,
                slug=app.slug,
                description=app.description,
                status=app.status,
                access_url=f"/apps/{app.slug}" if app.status == "running" else None,
                owner=UserOut.model_validate(owner),
                created_at=app.created_at,
                updated_at=app.updated_at,
            )
        )

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

    if file.content_type not in ("application/zip", "application/x-zip-compressed"):
        if not file.filename.endswith(".zip"):
            raise HTTPException(status_code=400, detail="只支持 .zip 格式")

    # 临时保存 zip 文件
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        ok, msg = validate_zip_structure(tmp_path)
        if not ok:
            raise HTTPException(status_code=400, detail=msg)

        extract_path = app_service.extract_upload(tmp_path, app_id)
        app.upload_path = extract_path
        app.status = "pending"
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
    if not app.upload_path:
        raise HTTPException(status_code=400, detail="请先上传代码文件")
    if app.status == "building":
        raise HTTPException(status_code=400, detail="正在构建中，请等待")

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
    if not app.container_name:
        raise HTTPException(status_code=400, detail="容器不存在，请重新部署")

    docker_service.restart_container(app.container_name)

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
