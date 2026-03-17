from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.deps import get_db, require_admin
from app.models.config import ConfigHistory, SystemConfig
from app.models.user import User
from app.routers.auth import SKILL_KEY_PREFIX, _get_skills, _seed_default_skills
from app.schemas.user import UserCreate, UserOut, UserUpdate, BatchUserCreate
from app.utils.security import hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


class SkillUpdate(BaseModel):
    content: str


# ── Skills 管理（管理员） ──────────────────────────────────────────────────────

@router.get("/skills")
def list_skills_admin(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    _seed_default_skills(db)
    rows = _get_skills(db)
    return [
        {"name": row.key[len(SKILL_KEY_PREFIX):], "content": row.value, "updated_at": row.updated_at}
        for row in rows
    ]


@router.put("/skills/{name}", status_code=200)
def upsert_skill(
    name: str,
    body: SkillUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    key = f"{SKILL_KEY_PREFIX}{name}"
    cfg = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    now = datetime.utcnow()
    if cfg:
        cfg.value = body.content
        cfg.updated_by = admin.id
        cfg.updated_at = now
    else:
        cfg = SystemConfig(key=key, value=body.content, updated_by=admin.id, updated_at=now)
        db.add(cfg)
    db.commit()
    db.add(ConfigHistory(
        config_key=key, value=body.content,
        updated_by=admin.id, updater_name=admin.username, updated_at=now,
    ))
    db.commit()
    return {"ok": True, "name": name}


@router.delete("/skills/{name}", status_code=204)
def delete_skill(
    name: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    key = f"{SKILL_KEY_PREFIX}{name}"
    deleted = db.query(SystemConfig).filter(SystemConfig.key == key).delete()
    db.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Skill 不存在")


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return db.query(User).order_by(User.id).all()


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")

    user = User(
        username=body.username,
        email=body.email,
        hashed_pw=hash_password(body.password),
        role=body.role,
        expires_at=body.expires_at,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/batch", response_model=list[UserOut], status_code=status.HTTP_201_CREATED)
def batch_create_users(
    body: BatchUserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    created = []
    hashed_pw = hash_password(body.password)
    for i in range(body.count):
        idx = body.start_index + i
        username = f"{body.project_name}_{idx:03d}"
        if db.query(User).filter(User.username == username).first():
            raise HTTPException(status_code=400, detail=f"用户名 {username} 已存在")
        user = User(
            username=username,
            hashed_pw=hashed_pw,
            role="annotator",
            expires_at=body.expires_at,
        )
        db.add(user)
        created.append(user)
    db.commit()
    for u in created:
        db.refresh(u)
    return created


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="不能删除自己的账号")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    db.delete(user)
    db.commit()


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from app.models.app import App

    return {
        "total_users": db.query(User).count(),
        "total_apps": db.query(App).count(),
        "running_apps": db.query(App).filter(App.status == "running").count(),
        "failed_apps": db.query(App).filter(App.status == "failed").count(),
    }
