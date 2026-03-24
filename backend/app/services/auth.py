"""认证服务：JWT 生成/解码、密码哈希、登录、修改密码、验证 App 访问。"""
from __future__ import annotations

import hmac
import uuid
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.exceptions import AccountDisabled, InvalidPassword
from app.models.user import User
from app.utils.time import now_cst

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── 密码工具 ──────────────────────────────────────────

def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


# ── JWT 工具 ──────────────────────────────────────────

def create_token(user_id: int, username: str, role: str, session_token: str = "") -> str:
    expire = datetime.utcnow() + timedelta(seconds=settings.jwt_expire_seconds)
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "sid": session_token,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError:
        return None


# ── 业务函数 ──────────────────────────────────────────

async def authenticate(db: AsyncSession, username: str, password: str) -> User:
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_pw):
        raise InvalidPassword()
    if not user.is_active:
        raise AccountDisabled()
    return user


async def login(db: AsyncSession, username: str, password: str) -> dict:
    user = await authenticate(db, username, password)
    # 生成 session_token 实现登录互踢
    new_sid = uuid.uuid4().hex[:16]
    user.session_token = new_sid
    await db.commit()
    await db.refresh(user)

    token = create_token(user.id, user.username, user.role, new_sid)
    return {"access_token": token, "user": user}


async def change_password(db: AsyncSession, user_id: int, old_password: str, new_password: str) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise InvalidPassword("用户不存在")
    if not verify_password(old_password, user.hashed_pw):
        raise InvalidPassword("原密码错误")
    if len(new_password) < 6:
        raise ValueError("新密码至少 6 位")
    user.hashed_pw = hash_password(new_password)
    user.updated_at = now_cst()
    await db.commit()
    return {"message": "密码修改成功"}


def verify_app_access(token: str | None) -> dict | None:
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    return {
        "username": payload.get("username", ""),
        "role": payload.get("role", ""),
        "user_id": int(payload["sub"]),
    }


# ── Bridge Secret (容器认证) ──────────────────────────────

def generate_bridge_secret(app_id: int) -> str:
    """生成容器专属密钥，用于 Bridge 进程向后端认证。"""
    return hmac.new(
        settings.jwt_secret.encode(),
        f"bridge:{app_id}".encode(),
        "sha256",
    ).hexdigest()[:32]


def verify_bridge_secret(app_id: int, secret: str) -> bool:
    """验证 Bridge 密钥。"""
    if not secret:
        return False
    expected = generate_bridge_secret(app_id)
    return hmac.compare_digest(expected, secret)
