import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import settings
from app.database import engine
from app.exceptions import setup_error_handlers
from app.middleware.app_usage_tracking import AppUsageTrackingMiddleware
from app.middleware.ip_allowlist import IPAllowlistMiddleware, reload_ip_allowlist_cache

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# 注册 ORM 模型到 Base.metadata
from app.models import App, AppExtra, ConfigHistory, Prompt, Skill, SystemConfig, User  # noqa: F401
from app.models.config import SystemConfig as SystemConfigModel
from app.models.skill import Skill as SkillModel

from app.routers import admin, apps, app_data, app_proxy, auth, config, prompts, skills, skills_cli, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    from sqlalchemy import text

    async with engine.begin() as conn:
        # Ensure dedicated skills table exists.
        await conn.run_sync(lambda sync_conn: SkillModel.__table__.create(bind=sync_conn, checkfirst=True))
        # Backward-compatible schema evolution when table was created earlier without this column.
        try:
            await conn.execute(
                text("ALTER TABLE skills ADD COLUMN storage_path VARCHAR(255) NOT NULL DEFAULT ''")
            )
        except Exception:
            # Column likely already exists.
            pass

    # One-time compatibility migration: system_configs(skill:*) -> skills.
    from sqlalchemy import select
    from app.database import async_session_factory
    import json

    async with async_session_factory() as db:
        legacy_rows = (
            await db.execute(select(SystemConfigModel).where(SystemConfigModel.key.like("skill:%")))
        ).scalars().all()
        if legacy_rows:
            existing_names = {
                n for n in (await db.execute(select(SkillModel.name))).scalars().all()
            }
            for row in legacy_rows:
                name = row.key[len("skill:"):]
                if name in existing_names:
                    continue
                try:
                    payload = json.loads(row.value)
                    if not isinstance(payload, dict):
                        payload = {}
                except Exception:
                    payload = {}
                db.add(
                    SkillModel(
                        name=name,
                        content=payload.get("content", row.value),
                        description=payload.get("description", ""),
                        category=payload.get("category", "other"),
                        author_id=payload.get("author_id", row.updated_by),
                        author_name=payload.get("author_name", ""),
                        installs=int(payload.get("installs", 0) or 0),
                        pinned=bool(payload.get("pinned", False)),
                        version=payload.get("version", "1.0.0"),
                        changelog=payload.get("changelog", ""),
                        source=payload.get("source", "internal"),
                        storage_path=str((Path(__file__).resolve().parents[1] / "data" / "skills" / name)),
                    )
                )
            await db.commit()

        # Fill storage_path for existing records created before this field was introduced.
        skills_without_path = (
            await db.execute(select(SkillModel).where((SkillModel.storage_path == "") | (SkillModel.storage_path.is_(None))))
        ).scalars().all()
        if skills_without_path:
            for skill in skills_without_path:
                skill.storage_path = str((Path(__file__).resolve().parents[1] / "data" / "skills" / skill.name))
            await db.commit()

    await reload_ip_allowlist_cache(app)
    yield


app = FastAPI(title="Tool Platform API", version="2.0.0", lifespan=lifespan)

# 先注册 IP 白名单（内层），再注册 CORS（外层），以便拦截响应仍带 CORS 头
# 使用统计：在成功响应后记录 /api/apps/{id}/*（不含 internal/view 路径形态）为「使用」
app.add_middleware(AppUsageTrackingMiddleware)
app.add_middleware(IPAllowlistMiddleware)
_origins_str = settings.allowed_origins.strip()
_origins = [o.strip() for o in _origins_str.split(",") if o.strip()] if _origins_str else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_error_handlers(app)

app.include_router(auth.router)
app.include_router(apps.router)
app.include_router(app_data.router)  # 应用数据 API（供 Streamlit 调用）
app.include_router(app_proxy.router, prefix="/proxy")  # 应用代理路由
app.include_router(prompts.router)
app.include_router(admin.router)
app.include_router(config.router)
app.include_router(stats.router)
app.include_router(skills.router)
app.include_router(skills_cli.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/install.sh", include_in_schema=False)
async def get_install_script():
    script_path = Path(__file__).with_name("install.sh")
    return FileResponse(path=script_path, media_type="text/x-shellscript", filename="install.sh")


@app.get("/docker/pe-space/docker-compose.yml", include_in_schema=False)
async def get_pe_space_docker_compose():
    path = Path(__file__).resolve().parents[1] / "docker" / "pe-space" / "docker-compose.yml"
    return FileResponse(path=path, media_type="text/yaml", filename="docker-compose.yml")


@app.get("/docker/pe-space/Dockerfile", include_in_schema=False)
async def get_pe_space_dockerfile():
    path = Path(__file__).resolve().parents[1] / "docker" / "pe-space" / "Dockerfile"
    return FileResponse(path=path, media_type="text/plain", filename="Dockerfile")


@app.get("/docker/pe-space/docker-entrypoint.sh", include_in_schema=False)
async def get_pe_space_entrypoint():
    path = Path(__file__).resolve().parents[1] / "docker" / "pe-space" / "docker-entrypoint.sh"
    return FileResponse(path=path, media_type="text/x-shellscript", filename="docker-entrypoint.sh")
