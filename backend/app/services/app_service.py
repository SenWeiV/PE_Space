"""
部署主流程，由 FastAPI BackgroundTasks 调用
"""
import shutil
import tempfile
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.app import App
from app.services import docker_service, traefik_service
from app.utils.file_utils import safe_extract_zip
from app.config import settings


async def deploy_app(app_id: int, db: Session) -> None:
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        return

    try:
        app.status = "building"
        app.build_log = "开始构建...\n"
        db.commit()

        result = docker_service.build_and_run(
            app_id=app.id,
            slug=app.slug,
            build_path=app.upload_path,
        )

        traefik_service.write_route(
            app_id=app.id,
            slug=app.slug,
            host_port=result["host_port"],
        )

        app.status = "running"
        app.container_id = result["container_id"]
        app.container_name = result["container_name"]
        app.host_port = result["host_port"]
        app.build_log = result["build_log"]
        db.commit()

    except Exception as e:
        app.status = "failed"
        app.build_log = (app.build_log or "") + f"\n构建失败: {str(e)}"
        db.commit()


def extract_upload(zip_path: str, app_id: int) -> str:
    """解压 zip 到 uploads 目录，自动定位 app.py 所在目录作为构建上下文"""
    extract_to = Path(settings.upload_dir) / str(app_id)
    if extract_to.exists():
        shutil.rmtree(extract_to)
    extract_to.mkdir(parents=True, exist_ok=True)
    safe_extract_zip(zip_path, str(extract_to))

    # 在解压目录内递归搜索 app.py（最多搜索 3 层），找到后用其所在目录作为构建上下文
    # 这样可以兼容 macOS 压缩产生的中文/多层目录结构
    for depth in range(3):
        pattern = "/".join(["*"] * (depth + 1)) + "/app.py"
        matches = list(extract_to.glob(pattern))
        if matches:
            # 取第一个 app.py 所在目录
            return str(matches[0].parent)

    # app.py 在根目录
    return str(extract_to)
