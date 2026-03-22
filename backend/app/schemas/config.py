from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ConfigOut(BaseModel):
    key: str
    value: str
    updated_by: Optional[int] = None
    updater_name: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class ConfigUpdate(BaseModel):
    value: str


class IntegrationSettingsOut(BaseModel):
    team_api_key: str
    team_base_url: str
    codex_model: str
    openclaw_model: str
    updated_at: Optional[datetime] = None


class IntegrationSettingsUpdate(BaseModel):
    team_api_key: str = ""
    team_base_url: str = ""
    codex_model: str = ""
    openclaw_model: str = ""


class IpAllowlistOut(BaseModel):
    """库中已保存的白名单原文；无记录时 value 为空（运行时可能仍回退 .env）。"""

    value: str
    updated_at: Optional[datetime] = None


class IpAllowlistUpdate(BaseModel):
    value: str = ""


class ConfigHistoryOut(BaseModel):
    id: int
    config_key: str
    value: str
    updater_name: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True
