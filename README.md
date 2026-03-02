# Tool Platform

类似 HuggingFace Spaces 的内部工具托管平台。

## 快速启动

```bash
# 1. 复制环境变量配置
cp .env.example .env
# 编辑 .env，修改密码和密钥

# 2. 启动所有服务
docker compose up -d

# 3. 执行数据库迁移
docker compose exec backend alembic upgrade head

# 4. 访问
# 前端：http://localhost
# 后端 API 文档：http://localhost/api/docs
# Traefik Dashboard：http://localhost:8080
```

## 默认账号

- 用户名：`admin`
- 密码：`secret`（迁移后需通过 API 修改）

## 上传 App 要求

zip 包必须包含：
- `app.py` - Streamlit 入口文件
- `requirements.txt` - 依赖列表

平台会自动注入 Dockerfile，无需手动提供。

## 目录结构

```
tool-platform/
├── backend/        # FastAPI 后端
├── frontend/       # React 前端
├── traefik/        # Traefik 配置
└── docker-compose.yml
```
