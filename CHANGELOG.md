# 代码改动记录

---

## [2026-03-02] App 数据持久化支持

### 背景

原始版本中，App 容器启动时没有挂载任何 Volume。容器运行期间写入的文件（如 Excel 结果、日志）仅存在于容器的临时可写层，一旦重新部署（旧容器销毁 + 新容器创建），所有运行时数据全部丢失。

本次改造将每个 App 容器的 `/app/data/` 目录挂载到宿主机，实现**数据跨部署持久化**。

---

### 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `docker-compose.yml` | 修改 | 删除命名卷，改用 bind mount；新增 `HOST_UPLOAD_DIR` 环境变量 |
| `.env` | 修改 | 新增 `HOST_UPLOAD_DIR` 配置项 |
| `backend/app/config.py` | 修改 | 新增 `host_upload_dir` 配置字段 |
| `backend/app/services/docker_service.py` | 修改 | 启动 App 容器时挂载持久化数据目录 |

---

### 详细改动说明

#### 1. `docker-compose.yml`

**改动前：**
```yaml
volumes:
  postgres-data:
  uploads-data:          # ← 命名卷，宿主机不可直接访问

services:
  backend:
    environment:
      UPLOAD_DIR: /uploads/apps
    volumes:
      - uploads-data:/uploads/apps   # ← 命名卷挂载
```

**改动后：**
```yaml
volumes:
  postgres-data:          # uploads-data 命名卷已删除

services:
  backend:
    environment:
      UPLOAD_DIR: /uploads/apps
      HOST_UPLOAD_DIR: ${HOST_UPLOAD_DIR}   # ← 新增：宿主机绝对路径
    volumes:
      - ${HOST_UPLOAD_DIR}:/uploads/apps    # ← 改为 bind mount
```

**原因：** 命名卷对宿主机不透明，Backend 容器也无法获知其在宿主机上的真实路径。改为 bind mount 后，Backend 知道 `HOST_UPLOAD_DIR` 是宿主机的真实路径，从而可以把 `{HOST_UPLOAD_DIR}/{app_id}/data` 作为宿主机路径传给 Docker SDK，挂载进 App 容器。

---

#### 2. `.env`

**新增一行：**
```
HOST_UPLOAD_DIR=/root/tool-platform/uploads
```

该值需与服务器上 `docker compose` 所在目录对应，填写**宿主机绝对路径**。

---

#### 3. `backend/app/config.py`

**改动前：**
```python
class Settings(BaseSettings):
    upload_dir: str = "/uploads/apps"
    ...
```

**改动后：**
```python
class Settings(BaseSettings):
    upload_dir: str = "/uploads/apps"
    host_upload_dir: str = "/uploads/apps"  # 宿主机绝对路径，用于给 App 容器挂卷
    ...
```

`upload_dir` 是 Backend 容器内的路径（不变），`host_upload_dir` 是宿主机的真实路径（由环境变量注入）。两者在 bind mount 下指向同一个物理目录，但用途不同：前者用于 Backend 内部的文件读写，后者用于 Docker SDK 挂载卷时传入宿主机路径。

---

#### 4. `backend/app/services/docker_service.py`

**改动位置：** `build_and_run()` 函数，容器启动部分。

**改动前：**
```python
container = client.containers.run(
    image=image_tag,
    name=container_name,
    detach=True,
    ports={"8501/tcp": host_port},
    # 没有 volumes
    labels={...},
    restart_policy={"Name": "unless-stopped"},
)
```

**改动后：**
```python
# 准备持久化数据目录（宿主机路径），App 内通过 /app/data 读写
data_dir_host = Path(settings.host_upload_dir) / str(app_id) / "data"
data_dir_container = Path(settings.upload_dir) / str(app_id) / "data"
data_dir_container.mkdir(parents=True, exist_ok=True)

container = client.containers.run(
    image=image_tag,
    name=container_name,
    detach=True,
    ports={"8501/tcp": host_port},
    volumes={str(data_dir_host): {"bind": "/app/data", "mode": "rw"}},  # ← 新增
    labels={...},
    restart_policy={"Name": "unless-stopped"},
)
```

**逻辑说明：**
- `data_dir_container.mkdir()` —— 在 Backend 容器内（即宿主机 bind mount 目录）提前创建 `data/` 子目录，避免 Docker 将其自动创建为 root 权限目录
- `volumes={str(data_dir_host): {"bind": "/app/data", "mode": "rw"}}` —— 将宿主机的 `{HOST_UPLOAD_DIR}/{app_id}/data/` 挂载为 App 容器内的 `/app/data/`

---

### 数据库变更

**无。** 数据目录路径可由 `app.id` + `settings.host_upload_dir` 推导，不需要新增字段，无需 Alembic migration。

---

### 部署后的目录结构

```
宿主机 /root/tool-platform/uploads/
├── {app_id}/
│   ├── app.py               ← App 源码（zip 解压结果）
│   ├── requirements.txt
│   ├── ...
│   └── data/                ← ✅ 持久化数据目录，挂载进容器的 /app/data/
│       ├── result_xxx.xlsx  （App 运行时写入，重部署后依然保留）
│       └── ...
```

---

### 服务器升级步骤

```bash
# 1. 更新代码
cd ~/tool-platform
# （从本地同步或 git pull）

# 2. 创建 uploads 目录
mkdir -p /root/tool-platform/uploads

# 3. 迁移旧数据（命名卷 → bind mount 目录）
docker run --rm \
  -v tool-platform_uploads-data:/from \
  -v /root/tool-platform/uploads:/to \
  alpine sh -c "cp -a /from/. /to/"

# 4. 重新构建 backend 镜像
docker build -t tool-platform-backend:latest ./backend

# 5. 重启服务
docker compose down
docker compose up -d

# 6. 验证
ls /root/tool-platform/uploads     # 应能看到各 App 的目录
docker compose logs -f backend      # 观察启动日志
```

---

### App 开发者使用方式

改造完成后，Streamlit 代码中直接写入 `/app/data/` 即可实现持久化：

```python
from pathlib import Path

DATA_DIR = Path("/app/data")
DATA_DIR.mkdir(exist_ok=True)

# 保存结果
result_df.to_excel(DATA_DIR / "result.xlsx", index=False)

# 读取历史结果
for f in sorted(DATA_DIR.glob("*.xlsx")):
    st.write(f.name)
```

写入 `/app/data/` 的文件：
- ✅ 容器重启后保留
- ✅ 重新部署后保留
- ✅ 可在宿主机 `/root/tool-platform/uploads/{app_id}/data/` 直接访问
