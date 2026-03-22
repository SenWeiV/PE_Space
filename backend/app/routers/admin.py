"""管理员路由：用户管理。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, status

from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin
from app.models.user import User
from app.schemas.user import BatchUserCreate, UserCreate, UserOut, UserUpdate
from app.services import user as user_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    users = await user_service.list_users(db)
    return [UserOut.model_validate(u) for u in users]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    user = await user_service.create_user(db, body.username, body.password, body.email, body.role, body.expires_at)
    return UserOut.model_validate(user)


@router.post("/users/batch", response_model=list[UserOut], status_code=status.HTTP_201_CREATED)
async def batch_create_users(body: BatchUserCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    users = await user_service.batch_create_users(db, body.project_name, body.start_index, body.count, body.password, body.expires_at)
    return [UserOut.model_validate(u) for u in users]


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: int, body: UserUpdate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    user = await user_service.update_user(db, user_id, **body.model_dump(exclude_none=True))
    return UserOut.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await user_service.delete_user(db, user_id, admin.id)
