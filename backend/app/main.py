import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.exceptions import setup_error_handlers
from app.middleware.ip_allowlist import IPAllowlistMiddleware, reload_ip_allowlist_cache

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# 注册 ORM 模型到 Base.metadata
from app.models import App, ConfigHistory, Prompt, SystemConfig, User  # noqa: F401

from app.routers import admin, apps, auth, config, prompts, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    await reload_ip_allowlist_cache(app)
    yield


app = FastAPI(title="Tool Platform API", version="2.0.0", lifespan=lifespan)

# 先注册 IP 白名单（内层），再注册 CORS（外层），以便拦截响应仍带 CORS 头
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
app.include_router(prompts.router)
app.include_router(admin.router)
app.include_router(config.router)
app.include_router(stats.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
