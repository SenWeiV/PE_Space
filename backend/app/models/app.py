from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.utils.time import now_cst


class App(Base):
    __tablename__ = "apps"
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    container_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    container_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    host_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    container_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # 反向代理（与 Traefik 动态配置一致，便于在库中查询；停止后清空）
    reverse_proxy_path_prefix: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reverse_proxy_backend_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    reverse_proxy_middlewares: Mapped[str | None] = mapped_column(String(256), nullable=True)
    upload_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    build_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime, nullable=False, default=now_cst)
    updated_at: Mapped[str] = mapped_column(DateTime, nullable=False, default=now_cst, onupdate=now_cst)
