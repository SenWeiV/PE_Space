from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.schemas.user import UserOut


class AppCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$", v):
            raise ValueError("slug 只允许小写字母、数字、连字符，长度 3-64 字符")
        return v


class AppUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    owner_id: Optional[int] = None


class AppListItem(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    status: str
    host_port: Optional[int] = None
    container_ip: Optional[str] = None
    access_url: Optional[str] = None
    owner: Optional[UserOut] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AppListResponse(BaseModel):
    total: int
    page: int
    size: int
    items: list[AppListItem]
