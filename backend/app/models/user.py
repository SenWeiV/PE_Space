from typing import Optional
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from app.database import Base
from app.utils.time_utils import now_cst


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(128), unique=True, nullable=True)
    hashed_pw = Column(String(256), nullable=False)
    role = Column(String(16), nullable=False, default="user")  # user | admin | annotator
    is_active = Column(Boolean, nullable=False, default=True)
    session_token = Column(String(64), nullable=True)  # 登录互踢：每次登录刷新，旧 JWT 失效
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=now_cst)
    updated_at = Column(DateTime, nullable=False, default=now_cst, onupdate=now_cst)
