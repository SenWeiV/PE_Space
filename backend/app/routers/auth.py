"""认证路由。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.user import LoginRequest, LoginResponse, UserOut
from app.services import auth as auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await auth_service.login(db, body.username, body.password)
    token = result["access_token"]
    user = result["user"]

    response.set_cookie(
        key="pe_token", value=token,
        max_age=settings.jwt_expire_seconds, path="/",
        samesite="lax", httponly=True,
    )

    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_expire_seconds,
        user=UserOut.model_validate(user),
    )


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="pe_token", path="/")
    return {"message": "已退出"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await auth_service.change_password(db, current_user.id, body.old_password, body.new_password)


@router.get("/verify-app")
async def verify_app(request: Request):
    token = request.cookies.get("pe_token")
    result = auth_service.verify_app_access(token)
    if not result:
        return Response(status_code=status.HTTP_401_UNAUTHORIZED)

    return Response(
        status_code=200,
        headers={
            "X-PE-User": result["username"],
            "X-PE-Role": result["role"],
            "X-PE-User-Id": str(result["user_id"]),
        },
    )
