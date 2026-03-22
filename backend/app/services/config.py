"""配置服务：代码规范模板、集成密钥与模型（与前端管理页对应）。"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.config import ConfigHistory, SystemConfig

TEMPLATE_KEY = "code_rule_prompt"

# 与 system_configs.key 一致，供管理员在后台维护；业务读取请用 get_integration_runtime
INTEGRATION_FIELDS = (
    "team_api_key",
    "team_base_url",
    "codex_model",
    "openclaw_model",
)

IP_ALLOWLIST_KEY = "ip_allowlist"

_default_template: str | None = None


def _get_default_template() -> str:
    global _default_template
    if _default_template is None:
        rules_path = Path(__file__).parent.parent / "utils" / "default_code_rules.md"
        if rules_path.exists():
            _default_template = rules_path.read_text(encoding="utf-8")
        else:
            _default_template = "# 代码规范模板\n\n请在管理后台配置。"
    return _default_template


async def _get_config(db: AsyncSession, key: str) -> SystemConfig | None:
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    return result.scalar_one_or_none()


async def _upsert_config(
    db: AsyncSession,
    key: str,
    value: str,
    updated_by: int | None = None,
    *,
    commit: bool = True,
) -> SystemConfig:
    row = await _get_config(db, key)
    if row:
        row.value = value
        row.updated_by = updated_by
        row.updated_at = datetime.utcnow()
    else:
        row = SystemConfig(key=key, value=value, updated_by=updated_by, updated_at=datetime.utcnow())
        db.add(row)
    if commit:
        await db.commit()
        await db.refresh(row)
    else:
        await db.flush()
        await db.refresh(row)
    return row


async def _add_history(
    db: AsyncSession,
    config_key: str,
    value: str,
    updated_by: int | None = None,
    updater_name: str | None = None,
    *,
    commit: bool = True,
) -> ConfigHistory:
    h = ConfigHistory(
        config_key=config_key,
        value=value,
        updated_by=updated_by,
        updater_name=updater_name,
        updated_at=datetime.utcnow(),
    )
    db.add(h)
    if commit:
        await db.commit()
        await db.refresh(h)
    else:
        await db.flush()
        await db.refresh(h)
    return h


async def _get_last_history(db: AsyncSession, key: str) -> ConfigHistory | None:
    result = await db.execute(
        select(ConfigHistory)
        .where(ConfigHistory.config_key == key)
        .order_by(ConfigHistory.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_template(db: AsyncSession) -> dict:
    row = await _get_config(db, TEMPLATE_KEY)
    if not row:
        row = await _upsert_config(db, TEMPLATE_KEY, _get_default_template())

    last = await _get_last_history(db, TEMPLATE_KEY)
    return {
        "key": row.key,
        "value": row.value,
        "updated_by": row.updated_by,
        "updater_name": last.updater_name if last else None,
        "updated_at": row.updated_at,
    }


async def update_template(db: AsyncSession, value: str, admin_id: int, admin_username: str) -> dict:
    row = await _get_config(db, TEMPLATE_KEY)
    if not row:
        row = await _upsert_config(db, TEMPLATE_KEY, _get_default_template())

    row.value = value
    row.updated_by = admin_id
    row.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(row)

    await _add_history(db, TEMPLATE_KEY, value, admin_id, admin_username)

    return {
        "key": row.key,
        "value": row.value,
        "updated_by": row.updated_by,
        "updater_name": admin_username,
        "updated_at": row.updated_at,
    }


async def get_template_history(db: AsyncSession) -> list[ConfigHistory]:
    result = await db.execute(
        select(ConfigHistory)
        .where(ConfigHistory.config_key == TEMPLATE_KEY)
        .order_by(ConfigHistory.id.desc())
        .limit(20)
    )
    return list(result.scalars().all())


async def get_integration_settings(db: AsyncSession) -> dict:
    """管理员查看：仅数据库中已保存的值（不含 .env 回退）。"""
    latest: datetime | None = None
    out: dict[str, str] = {}
    for field in INTEGRATION_FIELDS:
        row = await _get_config(db, field)
        out[field] = row.value if row else ""
        if row and (latest is None or row.updated_at > latest):
            latest = row.updated_at
    return {**out, "updated_at": latest}


async def update_integration_settings(
    db: AsyncSession, data: dict[str, str], admin_id: int, admin_username: str,
) -> dict:
    changed = False
    for field in INTEGRATION_FIELDS:
        new_val = data.get(field, "") or ""
        old_row = await _get_config(db, field)
        old_val = old_row.value if old_row else ""
        if new_val == old_val:
            continue
        changed = True
        await _upsert_config(db, field, new_val, admin_id, commit=False)
        await _add_history(db, field, new_val, admin_id, admin_username, commit=False)

    if changed:
        await db.commit()

    return await get_integration_settings(db)


async def get_ip_allowlist_admin(db: AsyncSession) -> dict:
    """管理员查看 IP 白名单：仅数据库内容（不含 .env）。"""
    row = await _get_config(db, IP_ALLOWLIST_KEY)
    return {
        "value": row.value if row else "",
        "updated_at": row.updated_at if row else None,
    }


async def update_ip_allowlist(
    db: AsyncSession, value: str, admin_id: int, admin_username: str,
) -> dict:
    new_norm = (value or "").strip()
    ip_old_row = await _get_config(db, IP_ALLOWLIST_KEY)
    ip_old = (ip_old_row.value if ip_old_row else "").strip()
    if new_norm != ip_old:
        await _upsert_config(db, IP_ALLOWLIST_KEY, new_norm, admin_id, commit=False)
        await _add_history(db, IP_ALLOWLIST_KEY, new_norm, admin_id, admin_username, commit=False)
        await db.commit()
    return await get_ip_allowlist_admin(db)


async def get_ip_allowlist_runtime_raw(db: AsyncSession) -> str:
    """中间件使用：库中已有 ip_allowlist 记录（含空串）以库为准；无记录时回退 .env。"""
    row = await _get_config(db, IP_ALLOWLIST_KEY)
    if row is not None:
        return row.value or ""
    return (settings.ip_allowlist or "").strip()


async def get_integration_runtime(db: AsyncSession) -> dict[str, str]:
    """业务使用：数据库优先，空则回退 Settings（.env）。"""
    out: dict[str, str] = {}
    for field in INTEGRATION_FIELDS:
        row = await _get_config(db, field)
        v = (row.value if row else "").strip()
        if not v:
            v = (getattr(settings, field, None) or "").strip()
        out[field] = v
    return out
