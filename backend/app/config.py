from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ 目录（与 uvicorn 工作目录无关，用于解析相对上传路径）
_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "mysql+aiomysql://root:root@localhost:3306/tool_platform?charset=utf8mb4"
    jwt_secret: str = "change-me"
    jwt_expire_seconds: int = 86400
    # 默认落在 backend/data/uploads/apps，本地可直接写入；生产可用环境变量设为绝对路径（如 /uploads/apps）
    upload_dir: str = str(_BACKEND_ROOT / "data" / "uploads" / "apps")
    host_upload_dir: str = str(_BACKEND_ROOT / "data" / "uploads" / "apps")
    # 应用运行产出（outputs/history/results 等）统一落在 down/{解压根目录名}/，与代码目录分离
    down_dir: str = str(_BACKEND_ROOT / "data" / "down")
    host_down_dir: str = str(_BACKEND_ROOT / "data" / "down")
    # 统一下载文件存储目录（代理转发时拦截保存）
    download_storage_dir: str = str(_BACKEND_ROOT / "data" / "downloads")
    # 本地默认写入 backend/data/traefik-dynamic；Docker 内可通过环境变量设为 /traefik-dynamic（与卷挂载一致）
    traefik_dynamic_dir: str = str(_BACKEND_ROOT / "data" / "traefik-dynamic")
    host_ip: str = "host.docker.internal"
    port_range_start: int = 8600
    port_range_end: int = 9600
    allowed_origins: str = ""
    # 集成配置（.env）：数据库无记录时，业务侧可读此回退；管理员在后台写入后以数据库为准
    team_api_key: str = ""
    team_base_url: str = ""
    codex_model: str = ""
    openclaw_model: str = ""
    # IP 白名单：库中无 ip_allowlist 记录时使用；多行或逗号分隔，支持 CIDR；为空表示不限制
    ip_allowlist: str = ""
    # 为 true 时优先取 X-Real-IP / X-Forwarded-For（前置反向代理时开启；直连开发可设 false）
    ip_allowlist_trust_x_forwarded_for: bool = True
    # 为 true 时 127.0.0.1、::1 及 IPv4 映射回环始终放行；要验证本机也被白名单约束请设 false
    ip_allowlist_allow_loopback: bool = True

    @model_validator(mode="after")
    def resolve_upload_paths(self) -> "Settings":
        for name in ("upload_dir", "host_upload_dir", "traefik_dynamic_dir", "down_dir", "host_down_dir", "download_storage_dir"):
            raw = getattr(self, name)
            p = Path(raw)
            if not p.is_absolute():
                setattr(self, name, str((_BACKEND_ROOT / p).resolve()))
        return self


settings = Settings()
