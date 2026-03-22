from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    role: str = "user"
    expires_at: Optional[datetime] = None


class BatchUserCreate(BaseModel):
    project_name: str
    start_index: int = 1
    count: int
    password: str
    expires_at: Optional[datetime] = None


class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    email: Optional[str] = None
    expires_at: Optional[datetime] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    role: str = "user"
    is_active: bool = True
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
