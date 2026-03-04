from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, require_admin
from app.models.config import ConfigHistory, SystemConfig
from app.models.user import User
from app.schemas.config import ConfigHistoryOut, ConfigOut, ConfigUpdate

router = APIRouter(prefix="/api/config", tags=["config"])

TEMPLATE_KEY = "code_rule_prompt"

# 默认代码规范 Prompt（首次访问时写入数据库）
DEFAULT_TEMPLATE = """# 角色定位
你是一位专业的 Streamlit 应用开发工程师，专门为企业内部工具平台开发数据处理类 Web 应用。

# 任务目标
根据用户提供的具体需求，生成一个完整的、可直接部署到内部工具平台的 Streamlit 应用。该应用必须满足以下所有技术规范，确保能够无缝集成到平台并稳定运行。

# 平台背景
- 这是一个类似 HuggingFace Spaces 的内部工具托管平台
- 用户上传包含 app.py 和 requirements.txt 的 zip 包即可部署
- 平台自动注入 Dockerfile，无需手动提供
- 应用需支持多人同时使用，数据隔离且可重复运行
- 部署路径：/app，持久化数据目录：/app/data（已挂载到宿主机）

---

## 一、文件结构要求（严格限制）

**只能输出两个文件，不允许任何其他文件：**

1. **app.py** - Streamlit 应用主入口
2. **requirements.txt** - Python 依赖列表

> ⚠️ 禁止输出：Dockerfile、配置文件、资源文件、目录结构说明等任何额外内容

---

## 二、技术规范（必须严格遵守）

### 2.1 禁止事项
- ❌ 禁止生成 Dockerfile（平台自动注入）
- ❌ 禁止使用 calamine 包，Excel 读写必须使用 openpyxl
- ❌ 禁止使用任何 Windows 专用包（pywin32、win32com、pythoncom 等）
- ❌ 禁止硬编码 localhost 或 127.0.0.1 的端口
- ❌ 禁止写死绝对路径（如 /Users/xxx、C:\\\\ 等）
- ❌ 禁止将异常直接抛到界面导致红色 Traceback
- ❌ 禁止使用全局可变状态存储用户数据

### 2.2 路径规范（强制执行）

```python
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = Path("/app/data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
```

### 2.3 错误处理规范（强制执行）
所有可能出错的地方必须捕获异常，使用 st.error() 友好展示。

---

## 三、输出格式（严格强制执行）

你只能输出两个代码块，按顺序：

```python
# app.py
# [完整代码内容]
```

```
# requirements.txt
# [依赖列表]
```"""


def _get_or_create(db: Session) -> SystemConfig:
    cfg = db.query(SystemConfig).filter(SystemConfig.key == TEMPLATE_KEY).first()
    if not cfg:
        cfg = SystemConfig(key=TEMPLATE_KEY, value=DEFAULT_TEMPLATE)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("/template", response_model=ConfigOut)
def get_template(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cfg = _get_or_create(db)
    # 查最后一次修改人名字
    last = (
        db.query(ConfigHistory)
        .filter(ConfigHistory.config_key == TEMPLATE_KEY)
        .order_by(ConfigHistory.id.desc())
        .first()
    )
    return ConfigOut(
        key=cfg.key,
        value=cfg.value,
        updated_by=cfg.updated_by,
        updater_name=last.updater_name if last else None,
        updated_at=cfg.updated_at,
    )


@router.put("/template", response_model=ConfigOut)
def update_template(
    body: ConfigUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    cfg = _get_or_create(db)
    cfg.value = body.value
    cfg.updated_by = admin.id
    cfg.updated_at = datetime.utcnow()
    db.commit()

    history = ConfigHistory(
        config_key=TEMPLATE_KEY,
        value=body.value,
        updated_by=admin.id,
        updater_name=admin.username,
        updated_at=cfg.updated_at,
    )
    db.add(history)
    db.commit()
    db.refresh(cfg)

    return ConfigOut(
        key=cfg.key,
        value=cfg.value,
        updated_by=cfg.updated_by,
        updater_name=admin.username,
        updated_at=cfg.updated_at,
    )


@router.get("/template/history", response_model=list[ConfigHistoryOut])
def get_template_history(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return (
        db.query(ConfigHistory)
        .filter(ConfigHistory.config_key == TEMPLATE_KEY)
        .order_by(ConfigHistory.id.desc())
        .limit(20)
        .all()
    )
