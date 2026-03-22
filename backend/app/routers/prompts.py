"""Prompt 路由。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.prompt import PromptCreate, PromptOut, PromptUpdate
from app.services import prompt as prompt_service

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.get("", response_model=list[PromptOut])
async def list_prompts(category: str = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    prompts = await prompt_service.list_prompts(db, category=category)
    return [PromptOut.model_validate(p) for p in prompts]


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await prompt_service.list_categories(db)


@router.post("", response_model=PromptOut, status_code=status.HTTP_201_CREATED)
async def create_prompt(body: PromptCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    p = await prompt_service.create_prompt(
        db, title=body.title, content=body.content,
        category=body.category, sort_order=body.sort_order,
        created_by=admin.id,
    )
    return PromptOut.model_validate(p)


@router.put("/{prompt_id}", response_model=PromptOut)
async def update_prompt(prompt_id: int, body: PromptUpdate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    p = await prompt_service.update_prompt(db, prompt_id, **body.model_dump(exclude_none=True))
    return PromptOut.model_validate(p)


@router.delete("/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt(prompt_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await prompt_service.delete_prompt(db, prompt_id)
