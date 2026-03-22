from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import async_session_factory
from app.models.user import User
from app.services.auth import decode_token

bearer_scheme = HTTPBearer()


async def get_db():
    async with async_session_factory() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的 Token")

    result = await db.execute(select(User).where(User.id == int(payload["sub"])))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已禁用")

    # 登录互踢
    jwt_sid = payload.get("sid", "")
    if user.session_token and jwt_sid != user.session_token:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="您的账号已在其他地方登录")

    # 过期检查
    if user.expires_at is not None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if user.expires_at < now:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已过期，请联系管理员")

    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return current_user
