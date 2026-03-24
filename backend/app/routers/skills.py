from __future__ import annotations

import io
import json
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_admin
from app.models.config import SystemConfig
from app.models.skill import Skill
from app.models.user import User

router = APIRouter(prefix="/api/skills", tags=["skills"])

VALID_CATEGORIES = ["dev-tools", "text", "data", "automation", "other"]
SPEC_KEY = "skills_specification"
SKILLS_STORAGE_DIR = Path(__file__).resolve().parents[2] / "data" / "skills"


def _skill_dir(name: str) -> Path:
    return SKILLS_STORAGE_DIR / name


def _resolve_skill_dir(name: str, storage_path: str | None = None) -> Path:
    if storage_path:
        return Path(storage_path)
    return _skill_dir(name)


def _safe_skill_name(raw: str) -> str:
    name = raw.strip().lower().replace(" ", "-")
    if not name or "/" in name or "\\" in name or ".." in name:
        raise HTTPException(status_code=400, detail="非法 Skill 名称")
    return name


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _build_content_disposition(filename: str) -> str:
    # Use ASCII fallback + RFC5987 filename* for non-ASCII names.
    ascii_fallback = "".join(ch if ord(ch) < 128 and ch not in {'"', "\\"} else "_" for ch in filename)
    if not ascii_fallback.strip("_"):
        ascii_fallback = "download.zip"
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename)}"


def _skill_to_meta_dict(skill: Skill) -> dict:
    return {
        "name": skill.name,
        "content": skill.content,
        "description": skill.description,
        "category": skill.category,
        "author_id": skill.author_id,
        "author_name": skill.author_name,
        "installs": skill.installs,
        "pinned": skill.pinned,
        "version": skill.version,
        "changelog": skill.changelog,
        "source": skill.source,
        "storage_path": skill.storage_path or str(_skill_dir(skill.name)),
        "created_at": skill.created_at.isoformat() if skill.created_at else _now_iso(),
        "updated_at": skill.updated_at.isoformat() if skill.updated_at else None,
    }


async def _get_skill_model(db: AsyncSession, name: str) -> Skill | None:
    return (
        await db.execute(select(Skill).where(Skill.name == name))
    ).scalar_one_or_none()


async def _list_skill_models(db: AsyncSession) -> list[Skill]:
    return list((await db.execute(select(Skill))).scalars().all())


def _list_skill_files(name: str, storage_path: str | None = None) -> list[dict]:
    skill_dir = _resolve_skill_dir(name, storage_path)
    files: list[dict] = []
    if not skill_dir.exists():
        return files
    for f in sorted(skill_dir.rglob("*")):
        if f.is_file():
            files.append({"name": str(f.relative_to(skill_dir)), "size": f.stat().st_size})
    return files


def _extract_zip_to_skill_dir(name: str, zip_bytes: bytes) -> str:
    skill_dir = _resolve_skill_dir(name)
    if skill_dir.exists():
        shutil.rmtree(skill_dir)
    skill_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        top_items = set()
        for info in zf.infolist():
            parts = info.filename.split("/")
            top_items.add(parts[0])

        strip_prefix = ""
        if len(top_items) == 1:
            one = next(iter(top_items))
            if all(info.filename.startswith(one + "/") or info.filename == one + "/" for info in zf.infolist()):
                strip_prefix = one + "/"

        for info in zf.infolist():
            if info.is_dir():
                continue
            target_name = info.filename
            if strip_prefix and target_name.startswith(strip_prefix):
                target_name = target_name[len(strip_prefix):]
            if not target_name or ".." in target_name:
                continue
            target_path = skill_dir / target_name
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src:
                target_path.write_bytes(src.read())

    skill_md = skill_dir / "SKILL.md"
    if skill_md.exists():
        return skill_md.read_text(encoding="utf-8", errors="replace")
    md_files = list(skill_dir.glob("*.md"))
    if md_files:
        return md_files[0].read_text(encoding="utf-8", errors="replace")
    return ""


async def _get_json_config(db: AsyncSession, key: str, default):
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    row = result.scalar_one_or_none()
    if not row:
        return default
    try:
        return json.loads(row.value)
    except (json.JSONDecodeError, TypeError):
        return default


async def _set_json_config(db: AsyncSession, key: str, value, updated_by: int | None = None) -> None:
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    row = result.scalar_one_or_none()
    now = datetime.utcnow()
    payload = json.dumps(value, ensure_ascii=False)
    if row:
        row.value = payload
        row.updated_by = updated_by
        row.updated_at = now
    else:
        db.add(SystemConfig(key=key, value=payload, updated_by=updated_by, updated_at=now))
    await db.commit()


async def _skill_to_dict(db: AsyncSession, skill: dict, current_user: User) -> dict:
    user_favs: list[str] = await _get_json_config(db, f"skill_favorites:{current_user.id}", [])
    votes = await _get_json_config(db, f"skill_votes:{skill['name']}", {"up": [], "down": []})
    dl_times = await _get_json_config(db, f"skill_downloads:{current_user.id}", {})

    result = {
        "name": skill["name"],
        "content": skill["content"],
        "description": skill["description"],
        "category": skill["category"],
        "author_id": skill["author_id"],
        "author_name": skill["author_name"],
        "downloads": skill["installs"],
        "pinned": skill["pinned"],
        "version": skill["version"],
        "changelog": skill["changelog"],
        "source": skill["source"],
        "storage_path": skill.get("storage_path") or str(_skill_dir(skill["name"])),
        "files": _list_skill_files(skill["name"], skill.get("storage_path")),
        "created_at": skill["created_at"],
        "updated_at": skill["updated_at"],
        "favorited": skill["name"] in set(user_favs),
        "ups": len(votes.get("up", [])),
        "downs": len(votes.get("down", [])),
        "my_vote": (
            "up"
            if current_user.id in votes.get("up", [])
            else "down" if current_user.id in votes.get("down", []) else "none"
        ),
        "has_update": False,
    }

    if result["favorited"] and skill["updated_at"] and isinstance(dl_times, dict) and skill["name"] in dl_times:
        last_dl = _parse_dt(dl_times.get(skill["name"]))
        updated_at = _parse_dt(skill["updated_at"])
        if last_dl and updated_at and updated_at > last_dl:
            result["has_update"] = True
    return result


@router.get("")
async def list_skills(
    q: str = Query("", description="Search keyword"),
    category: str = Query("", description="Filter by category"),
    sort: str = Query("default", description="Sort: default, newest, most_downloads, recently_updated"),
    favorites_only: bool = Query(False, description="Only show favorites"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    models = await _list_skill_models(db)
    skills = [_skill_to_meta_dict(m) for m in models]
    user_favs = set(await _get_json_config(db, f"skill_favorites:{current_user.id}", []))

    if q:
        q_lower = q.lower()

        def _matches(item: dict) -> bool:
            if q_lower in item["name"].lower() or q_lower in item["description"].lower() or q_lower in item["content"].lower():
                return True
            skill_md = _resolve_skill_dir(item["name"], item.get("storage_path")) / "SKILL.md"
            if skill_md.exists():
                try:
                    return q_lower in skill_md.read_text(encoding="utf-8", errors="replace").lower()
                except Exception:
                    return False
            return False

        skills = [s for s in skills if _matches(s)]

    if category:
        skills = [s for s in skills if s["category"] == category]
    if favorites_only:
        skills = [s for s in skills if s["name"] in user_favs]

    if sort == "newest":
        skills.sort(key=lambda s: _parse_dt(s["created_at"]) or datetime.min, reverse=True)
    elif sort == "most_downloads":
        skills.sort(key=lambda s: s["installs"], reverse=True)
    elif sort == "recently_updated":
        skills.sort(key=lambda s: _parse_dt(s["updated_at"]) or datetime.min, reverse=True)
    else:
        skills.sort(key=lambda s: (-int(s["pinned"]), -s["installs"], s["name"]))

    return [await _skill_to_dict(db, s, current_user) for s in skills]


@router.get("/specification")
async def get_specification(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == SPEC_KEY))
    row = result.scalar_one_or_none()
    return {"content": row.value if row else ""}


class SpecBody(BaseModel):
    content: str


@router.put("/specification")
async def update_specification(
    body: SpecBody,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == SPEC_KEY))
    row = result.scalar_one_or_none()
    now = datetime.utcnow()
    if row:
        row.value = body.content
        row.updated_by = admin.id
        row.updated_at = now
    else:
        db.add(SystemConfig(key=SPEC_KEY, value=body.content, updated_by=admin.id, updated_at=now))
    await db.commit()
    return {"content": body.content}


@router.get("/categories")
async def list_categories(current_user: User = Depends(get_current_user)):
    return [
        {"value": "dev-tools", "label": "开发工具"},
        {"value": "text", "label": "文本处理"},
        {"value": "data", "label": "数据分析"},
        {"value": "automation", "label": "自动化"},
        {"value": "other", "label": "其他"},
    ]


@router.get("/stats/overview")
async def skills_stats(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    models = await _list_skill_models(db)
    skills = [_skill_to_meta_dict(m) for m in models]
    total = len(skills)
    total_downloads = sum(s["installs"] for s in skills)

    category_breakdown: dict[str, int] = {}
    author_counts: dict[str, int] = {}
    for s in skills:
        category_breakdown[s["category"]] = category_breakdown.get(s["category"], 0) + 1
        author = s["author_name"] or "system"
        author_counts[author] = author_counts.get(author, 0) + 1

    top_downloaded = sorted(skills, key=lambda s: s["installs"], reverse=True)[:5]
    top_authors = sorted(author_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    return {
        "total_skills": total,
        "total_downloads": total_downloads,
        "category_breakdown": category_breakdown,
        "top_downloaded": [{"name": s["name"], "downloads": s["installs"]} for s in top_downloaded],
        "top_authors": [{"name": name, "count": count} for name, count in top_authors],
    }


@router.get("/{name}")
async def get_skill(name: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    skill_model = await _get_skill_model(db, name)
    if not skill_model:
        raise HTTPException(status_code=404, detail=f"Skill 不存在: {name}")
    return await _skill_to_dict(db, _skill_to_meta_dict(skill_model), current_user)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_skill(
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form("other"),
    source: str = Form("internal"),
    version: str = Form("1.0.0"),
    changelog: str = Form(""),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    skill_name = _safe_skill_name(name)
    existing = await _get_skill_model(db, skill_name)
    if existing:
        raise HTTPException(status_code=409, detail=f"Skill '{skill_name}' 已存在")

    file_bytes = await file.read()
    if not (file.filename or "").endswith(".zip"):
        raise HTTPException(status_code=400, detail="请上传 .zip 文件")
    try:
        content = _extract_zip_to_skill_dir(skill_name, file_bytes)
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="无效的 zip 文件") from exc

    model = Skill(
        name=skill_name,
        content=content,
        description=description,
        category=category if category in VALID_CATEGORIES else "other",
        author_id=current_user.id,
        author_name=current_user.username,
        installs=0,
        pinned=False,
        version=version,
        changelog=changelog,
        source=source if source in ("internal", "external") else "internal",
        storage_path=str(_skill_dir(skill_name)),
    )
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return await _skill_to_dict(db, _skill_to_meta_dict(model), current_user)


@router.put("/{name}")
async def update_skill(
    name: str,
    description: str | None = Form(None),
    category: str | None = Form(None),
    source: str | None = Form(None),
    version: str | None = Form(None),
    changelog: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = await _get_skill_model(db, name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Skill 不存在: {name}")
    if model.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="只有作者或管理员可以编辑")

    if file and file.filename:
        file_bytes = await file.read()
        if not file.filename.endswith(".zip"):
            raise HTTPException(status_code=400, detail="请上传 .zip 文件")
        try:
            model.content = _extract_zip_to_skill_dir(name, file_bytes)
        except zipfile.BadZipFile as exc:
            raise HTTPException(status_code=400, detail="无效的 zip 文件") from exc

    if description is not None:
        model.description = description
    if category is not None and category in VALID_CATEGORIES:
        model.category = category
    if source is not None and source in ("internal", "external"):
        model.source = source
    if version is not None:
        model.version = version
    if changelog is not None:
        model.changelog = changelog
    if not model.storage_path:
        model.storage_path = str(_skill_dir(name))

    await db.commit()
    await db.refresh(model)
    return await _skill_to_dict(db, _skill_to_meta_dict(model), current_user)


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = await _get_skill_model(db, name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Skill 不存在: {name}")
    if model.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="只有作者或管理员可以删除")

    await db.delete(model)
    await db.commit()
    skill_dir = _resolve_skill_dir(name, model.storage_path)
    if skill_dir.exists():
        shutil.rmtree(skill_dir)


@router.get("/{name}/download")
async def download_skill(
    name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = await _get_skill_model(db, name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Skill 不存在: {name}")

    skill_dir = _skill_dir(name)
    buf = io.BytesIO()
    if not skill_dir.exists() or not any(skill_dir.iterdir()):
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("SKILL.md", model.content or "")
    else:
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in skill_dir.rglob("*"):
                if f.is_file():
                    zf.write(f, f.relative_to(skill_dir))
    buf.seek(0)

    model.installs = int(model.installs) + 1
    await db.commit()

    user_downloads = await _get_json_config(db, f"skill_downloads:{current_user.id}", {})
    if not isinstance(user_downloads, dict):
        user_downloads = {}
    user_downloads[name] = _now_iso()
    await _set_json_config(db, f"skill_downloads:{current_user.id}", user_downloads, current_user.id)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": _build_content_disposition(f"{name}.zip")},
    )


@router.get("/{name}/files/{file_path:path}")
async def preview_file(
    name: str,
    file_path: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = await _get_skill_model(db, name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Skill 不存在: {name}")
    if ".." in file_path:
        raise HTTPException(status_code=400, detail="非法路径")

    target = _resolve_skill_dir(name, model.storage_path) / file_path
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail=f"文件不存在: {file_path}")
    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="二进制文件，无法预览") from exc
    return {"name": file_path, "content": content}


class SkillPinBody(BaseModel):
    pinned: bool


@router.put("/{name}/pin")
async def pin_skill(
    name: str,
    body: SkillPinBody,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    model = await _get_skill_model(db, name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Skill 不存在: {name}")
    model.pinned = body.pinned
    await db.commit()
    await db.refresh(model)
    return await _skill_to_dict(db, _skill_to_meta_dict(model), admin)


class SkillFavBody(BaseModel):
    favorite: bool


@router.put("/{name}/favorite")
async def toggle_favorite(
    name: str,
    body: SkillFavBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = await _get_skill_model(db, name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Skill 不存在: {name}")
    favs = await _get_json_config(db, f"skill_favorites:{current_user.id}", [])
    if not isinstance(favs, list):
        favs = []
    if body.favorite and name not in favs:
        favs.append(name)
    if not body.favorite and name in favs:
        favs.remove(name)
    await _set_json_config(db, f"skill_favorites:{current_user.id}", favs, current_user.id)
    return {"name": name, "favorited": body.favorite}


class SkillCommentBody(BaseModel):
    content: str


@router.get("/{name}/comments")
async def list_comments(name: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    model = await _get_skill_model(db, name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Skill 不存在: {name}")
    comments = await _get_json_config(db, f"skill_comments:{name}", [])
    return comments if isinstance(comments, list) else []


@router.post("/{name}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment(
    name: str,
    body: SkillCommentBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = await _get_skill_model(db, name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Skill 不存在: {name}")
    text = body.content.strip()
    if not text:
        raise HTTPException(status_code=400, detail="评论内容不能为空")
    if len(text) > 200:
        raise HTTPException(status_code=400, detail="评论不能超过 200 字")
    comments = await _get_json_config(db, f"skill_comments:{name}", [])
    if not isinstance(comments, list):
        comments = []
    comments.append(
        {
            "user_id": current_user.id,
            "user_name": current_user.username,
            "content": text,
            "created_at": _now_iso(),
        }
    )
    await _set_json_config(db, f"skill_comments:{name}", comments, current_user.id)
    return comments


@router.delete("/{name}/comments/{index}")
async def delete_comment(
    name: str,
    index: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = await _get_skill_model(db, name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Skill 不存在: {name}")
    comments = await _get_json_config(db, f"skill_comments:{name}", [])
    if not isinstance(comments, list):
        comments = []
    if index < 0 or index >= len(comments):
        raise HTTPException(status_code=404, detail="评论不存在")
    c = comments[index]
    if c.get("user_id") != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="只能删除自己的评论")
    comments.pop(index)
    await _set_json_config(db, f"skill_comments:{name}", comments, current_user.id)
    return comments


class SkillVoteBody(BaseModel):
    vote: str


@router.put("/{name}/vote")
async def vote_skill(
    name: str,
    body: SkillVoteBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = await _get_skill_model(db, name)
    if not model:
        raise HTTPException(status_code=404, detail=f"Skill 不存在: {name}")
    if body.vote not in ("up", "down", "none"):
        raise HTTPException(status_code=400, detail="vote 必须为 up, down 或 none")

    votes = await _get_json_config(db, f"skill_votes:{name}", {"up": [], "down": []})
    if not isinstance(votes, dict):
        votes = {"up": [], "down": []}
    votes["up"] = [uid for uid in votes.get("up", []) if uid != current_user.id]
    votes["down"] = [uid for uid in votes.get("down", []) if uid != current_user.id]
    if body.vote == "up":
        votes["up"].append(current_user.id)
    elif body.vote == "down":
        votes["down"].append(current_user.id)
    await _set_json_config(db, f"skill_votes:{name}", votes, current_user.id)
    return {"name": name, "ups": len(votes["up"]), "downs": len(votes["down"]), "my_vote": body.vote}
