"""Prompt 管理服务。"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import PromptNotFound
from app.models.prompt import Prompt


async def list_prompts(db: AsyncSession, category: Optional[str] = None) -> list[Prompt]:
    query = select(Prompt).where(Prompt.is_active == True)
    if category:
        query = query.where(Prompt.category == category)
    result = await db.execute(query.order_by(Prompt.sort_order, Prompt.id))
    return list(result.scalars().all())


async def list_categories(db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(Prompt.category)
        .where(Prompt.is_active == True, Prompt.category != None)
        .distinct()
    )
    return [r[0] for r in result.all() if r[0]]


async def create_prompt(
    db: AsyncSession,
    title: str, content: str,
    category: Optional[str] = None,
    sort_order: int = 0,
    created_by: Optional[int] = None,
) -> Prompt:
    p = Prompt(
        title=title, content=content,
        category=category, sort_order=sort_order,
        created_by=created_by,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def update_prompt(db: AsyncSession, prompt_id: int, **kwargs) -> Prompt:
    result = await db.execute(select(Prompt).where(Prompt.id == prompt_id))
    p = result.scalar_one_or_none()
    if not p:
        raise PromptNotFound(prompt_id)
    for k, v in kwargs.items():
        if v is not None:
            setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return p


async def delete_prompt(db: AsyncSession, prompt_id: int) -> None:
    result = await db.execute(select(Prompt).where(Prompt.id == prompt_id))
    p = result.scalar_one_or_none()
    if not p:
        raise PromptNotFound(prompt_id)
    await db.delete(p)
    await db.commit()
