from __future__ import annotations

import io
import zipfile
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.config import SystemConfig
from app.models.skill import Skill

router = APIRouter(prefix="/api/cli/skills", tags=["skills-cli"])

CLI_TOKEN_KEY = "cli_token"
SKILLS_STORAGE_DIR = Path(__file__).resolve().parents[2] / "data" / "skills"
BOOTSTRAP_MD = Path(__file__).resolve().parents[2] / "builtin_skills" / "openclaw-skills-guide" / "SKILL.md"


async def _verify_cli_token(request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == CLI_TOKEN_KEY))
    row = result.scalar_one_or_none()
    if not row or not row.value:
        return
    token = request.headers.get("X-CLI-Token") or request.query_params.get("token")
    if token != row.value.strip():
        raise HTTPException(status_code=401, detail="Invalid or missing CLI token")


def _build_content_disposition(filename: str) -> str:
    ascii_fallback = "".join(ch if ord(ch) < 128 and ch not in {'"', "\\"} else "_" for ch in filename)
    if not ascii_fallback.strip("_"):
        ascii_fallback = "download.zip"
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename)}"


def _parse_skill(model: Skill) -> dict:
    return {
        "name": model.name,
        "content": model.content,
        "description": model.description,
        "category": model.category,
        "version": model.version,
        "downloads": int(model.installs or 0),
        "author": model.author_name or "system",
        "pinned": bool(model.pinned),
        "changelog": model.changelog,
        "storage_path": model.storage_path or str(SKILLS_STORAGE_DIR / model.name),
        "created_at": model.created_at.isoformat() if model.created_at else None,
        "updated_at": model.updated_at.isoformat() if model.updated_at else None,
    }


async def _list_skills(db: AsyncSession) -> list[dict]:
    rows = list((await db.execute(select(Skill))).scalars().all())
    return [_parse_skill(row) for row in rows]


@router.get("", dependencies=[Depends(_verify_cli_token)])
async def cli_list_skills(
    q: str = Query("", description="Search keyword"),
    category: str = Query("", description="Filter by category"),
    db: AsyncSession = Depends(get_db),
):
    skills = await _list_skills(db)
    if q:
        q_lower = q.lower()
        skills = [s for s in skills if q_lower in s["name"].lower() or q_lower in s["description"].lower()]
    if category:
        skills = [s for s in skills if s["category"] == category]
    skills.sort(key=lambda s: (-int(s["pinned"]), -s["downloads"], s["name"]))
    return skills


@router.get("/bootstrap/download", dependencies=[])
async def cli_bootstrap_download():
    if not BOOTSTRAP_MD.exists():
        raise HTTPException(status_code=404, detail="Bootstrap skill not found")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("SKILL.md", BOOTSTRAP_MD.read_text(encoding="utf-8"))
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="openclaw-skills-guide.zip"'},
    )


@router.get("/{name}", dependencies=[Depends(_verify_cli_token)])
async def cli_skill_info(name: str, db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(Skill).where(Skill.name == name))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Skill not found: {name}")

    skill = _parse_skill(row)
    skill_dir = Path(row.storage_path) if row.storage_path else (SKILLS_STORAGE_DIR / name)
    files: list[str] = []
    if skill_dir.exists():
        for f in sorted(skill_dir.rglob("*")):
            if f.is_file():
                files.append(str(f.relative_to(skill_dir)))
    skill["files"] = files
    return skill


@router.get("/{name}/install", dependencies=[Depends(_verify_cli_token)])
async def cli_install_skill(name: str, db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(Skill).where(Skill.name == name))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Skill not found: {name}")

    skill_dir = Path(row.storage_path) if row.storage_path else (SKILLS_STORAGE_DIR / name)
    buf = io.BytesIO()
    skill = _parse_skill(row)
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if skill_dir.exists() and any(skill_dir.iterdir()):
            for f in skill_dir.rglob("*"):
                if f.is_file():
                    zf.write(f, f.relative_to(skill_dir))
        else:
            zf.writestr("SKILL.md", skill["content"])
    buf.seek(0)

    row.installs = int(row.installs or 0) + 1
    await db.commit()

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": _build_content_disposition(f"{name}.zip")},
    )
