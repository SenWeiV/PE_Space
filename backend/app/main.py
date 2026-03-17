from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pathlib import Path

from app.models import app_view  # noqa: F401 — ensure AppView table is registered
from app.routers import admin, apps, auth, config, prompts, stats

app = FastAPI(title="Tool Platform API", version="1.0.0")

# CORS：允许前端开发服务器访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(apps.router)
app.include_router(prompts.router)
app.include_router(admin.router)
app.include_router(config.router)
app.include_router(stats.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/install.sh", response_class=PlainTextResponse)
def install_script():
    """提供一键安装脚本下载（无需登录）"""
    script_path = Path("/install.sh")
    if script_path.exists():
        return PlainTextResponse(
            content=script_path.read_text(),
            media_type="text/x-sh",
            headers={"Content-Disposition": "inline; filename=install.sh"},
        )
    return PlainTextResponse("# Script not found\n", status_code=404)
