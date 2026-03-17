import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.deps import get_current_user, get_db
from app.models.app import App
from app.models.app_view import AppView
from app.models.config import SystemConfig
from app.models.user import User
from app.schemas.user import LoginRequest, LoginResponse, UserOut
from app.utils.security import create_access_token, decode_access_token, hash_password, verify_password
from app.utils.time_utils import now_cst


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_pw):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已被禁用")

    # 登录互踢：刷新 session_token，旧 JWT 的 sid 不再匹配
    new_sid = uuid.uuid4().hex[:16]
    user.session_token = new_sid
    db.commit()

    token = create_access_token(user.id, user.username, user.role, new_sid)

    # 同时写 Cookie，供 ForwardAuth 使用（浏览器访问 /apps/* 时自动携带）
    response.set_cookie(
        key="pe_token",
        value=token,
        max_age=settings.jwt_expire_seconds,
        path="/",
        samesite="lax",
        httponly=False,
    )

    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_expire_seconds,
        user=UserOut.model_validate(user),
    )


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="pe_token", path="/")
    return {"message": "已退出"}


@router.get("/team-config")
def team_config(current_user: User = Depends(get_current_user)):
    """登录后获取团队 AI 配置（API Key 透传，不在安装包里暴露）"""
    return {
        "api_key": settings.team_api_key,
        "base_url": settings.team_base_url,
        "codex_model": settings.codex_model,
        "openclaw_model": settings.openclaw_model,
    }


SKILL_KEY_PREFIX = "skill:"

DEFAULT_PE_SPACE_SKILL = """\
---
name: pe-space
description: "Deploy Streamlit apps to PE Space platform via pe CLI. Use when: user wants to build or deploy an app, use pe deploy/list/logs/stop, or manage PE Space applications."
metadata: { "openclaw": { "emoji": "🚀", "requires": { "bins": ["pe"] } } }
---
# PE Space Skill — 需求到上线全流程

请运行 `pe rules` 获取最新代码规范，然后根据用户需求用 Codex 生成代码，最后用 `pe deploy` 部署到平台。
"""


def _get_skills(db: Session) -> list:
    return db.query(SystemConfig).filter(
        SystemConfig.key.like(f"{SKILL_KEY_PREFIX}%")
    ).all()


def _seed_default_skills(db: Session):
    key = f"{SKILL_KEY_PREFIX}pe-space"
    if not db.query(SystemConfig).filter(SystemConfig.key == key).first():
        db.add(SystemConfig(key=key, value=DEFAULT_PE_SPACE_SKILL))
        db.commit()


@router.get("/skills")
def list_skills(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """登录后同步 skills 到本地 ~/.openclaw/skills/"""
    _seed_default_skills(db)
    rows = _get_skills(db)
    return [
        {"name": row.key[len(SKILL_KEY_PREFIX):], "content": row.value}
        for row in rows
    ]


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.old_password, current_user.hashed_pw):
        raise HTTPException(status_code=400, detail="原密码错误")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码至少 6 位")
    current_user.hashed_pw = hash_password(body.new_password)
    current_user.updated_at = now_cst()
    db.commit()
    return {"message": "密码修改成功"}


@router.get("/verify-app")
def verify_app(request: Request):
    """
    Traefik ForwardAuth 验证接口。
    验证 Cookie 中的 JWT，通过则注入 X-PE-User / X-PE-Role Header。
    失败则返回 401（Traefik 会将此响应直接返回给浏览器）。
    """
    token = request.cookies.get("pe_token")
    if not token:
        return Response(status_code=status.HTTP_401_UNAUTHORIZED)

    payload = decode_access_token(token)
    if not payload:
        return Response(status_code=status.HTTP_401_UNAUTHORIZED)

    username = payload.get("username", "")
    role = payload.get("role", "user")
    user_id = int(payload.get("sub", 0))

    headers = {
        "X-PE-User": username,
        "X-PE-Role": role,
        "X-PE-User-Id": str(user_id),
    }
    return Response(status_code=200, headers=headers)


def _record_view(uri: str, user_id: int, username: str, role: str):
    """异步记录访问日志，不阻塞主流程"""
    try:
        # uri 形如 /apps/excel-translator/...，取 slug
        parts = uri.strip("/").split("/")
        if len(parts) < 2 or parts[0] != "apps":
            return
        slug = parts[1]

        db = SessionLocal()
        try:
            app = db.query(App).filter(App.slug == slug).first()
            if not app:
                return
            view = AppView(
                app_id=app.id,
                user_id=user_id if user_id else None,
                username=username,
                role=role,
                viewed_at=now_cst(),
            )
            db.add(view)
            db.commit()
        finally:
            db.close()
    except Exception:
        pass  # 访问日志记录失败不影响主流程
