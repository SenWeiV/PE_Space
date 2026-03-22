"""用户管理服务：CRUD、批量创建。"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import CannotDeleteSelf, UserNotFound, UsernameExists
from app.models.user import User
from app.services.auth import hash_password


async def list_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.id))
    return list(result.scalars().all())


async def create_user(
    db: AsyncSession,
    username: str,
    password: str,
    email: Optional[str] = None,
    role: str = "user",
    expires_at: Optional[datetime] = None,
) -> User:
    existing = await db.execute(select(User).where(User.username == username))
    if existing.scalar_one_or_none():
        raise UsernameExists(username)

    user = User(
        username=username,
        hashed_pw=hash_password(password),
        email=email,
        role=role,
        expires_at=expires_at,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def batch_create_users(
    db: AsyncSession,
    project_name: str,
    start_index: int,
    count: int,
    password: str,
    expires_at: Optional[datetime] = None,
) -> list[User]:
    hashed = hash_password(password)
    users: list[User] = []
    for i in range(count):
        uname = f"{project_name}_{start_index + i:03d}"
        existing = await db.execute(select(User).where(User.username == uname))
        if existing.scalar_one_or_none():
            raise UsernameExists(uname)
        user = User(
            username=uname,
            hashed_pw=hashed,
            role="annotator",
            expires_at=expires_at,
        )
        db.add(user)
        users.append(user)
    await db.commit()
    for u in users:
        await db.refresh(u)
    return users


async def update_user(db: AsyncSession, user_id: int, **kwargs) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise UserNotFound(user_id=user_id)
    for k, v in kwargs.items():
        if v is not None:
            setattr(user, k, v)
    await db.commit()
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user_id: int, admin_id: int) -> None:
    if user_id == admin_id:
        raise CannotDeleteSelf()
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise UserNotFound(user_id=user_id)
    await db.delete(user)
    await db.commit()


async def count_users(db: AsyncSession) -> int:
    from sqlalchemy import func
    result = await db.execute(select(func.count()).select_from(User))
    return result.scalar_one()
