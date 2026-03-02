from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.database import Base


class App(Base):
    __tablename__ = "apps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    slug = Column(String(64), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 部署状态: pending | building | running | stopped | failed
    status = Column(String(32), nullable=False, default="pending")

    # 容器信息
    container_id = Column(String(128), nullable=True)
    container_name = Column(String(128), nullable=True)
    host_port = Column(Integer, nullable=True)

    # 文件信息
    upload_path = Column(String(512), nullable=True)
    build_log = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
