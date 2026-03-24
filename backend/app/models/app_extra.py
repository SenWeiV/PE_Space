from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Index
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AppExtra(Base):
    """应用访问和使用记录。

    summary 类型:
    - 0: 仅打开应用页（访问）
    - 1: 对该应用发起 API 请求（使用）
    - 2: 下载文件
    - 3: Bridge 自动上传

    注意：app_id 不再是外键，删除应用不会影响历史记录。
    """

    __tablename__ = "app_extra"
    __table_args__ = (
        Index("idx_app_extra_timestamp", "timestamp", mysql_using="BTREE"),
        Index("idx_app_extra_app_user", "app_id", "username"),
        {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_0900_ai_ci"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 不再使用外键，删除应用不影响记录
    app_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 冗余存储应用名称，便于应用删除后仍可查询
    app_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    summary: Mapped[int] = mapped_column(TINYINT, nullable=False)

    # 请求信息（代理记录）
    request_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    request_method: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    client_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    response_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # 文件信息（下载记录）
    file_path: Mapped[Optional[str]] = mapped_column(
        String(512, collation="utf8mb4_0900_ai_ci"),
        nullable=True,
    )
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_original_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
