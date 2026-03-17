#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 启动本地开发环境..."

# 创建本地目录
mkdir -p /tmp/pe_uploads /tmp/traefik-dynamic

# 只启动 postgres + backend（前端本地 npm run dev）
cd "$PROJECT_DIR"
docker compose -f docker-compose.dev.yml up -d --build postgres backend

echo "⏳ 等待后端就绪..."
for i in $(seq 1 30); do
  if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✅ 后端已就绪"
    break
  fi
  sleep 1
done

# 执行数据库迁移
echo "🗄️  执行数据库迁移..."
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head

# 检查是否有 admin 用户，没有则创建
echo "👤 检查管理员账号..."
docker compose -f docker-compose.dev.yml exec backend python3 -c "
from app.database import SessionLocal
from app.models.user import User
from app.utils.security import hash_password
db = SessionLocal()
if not db.query(User).filter(User.username == 'admin').first():
    db.add(User(username='admin', hashed_pw=hash_password('admin123'), role='admin', is_active=True))
    db.commit()
    print('✅ 已创建 admin / admin123')
else:
    print('✅ admin 账号已存在')
db.close()
" 2>&1 | grep -v "trapped\|bcrypt version"

# 启动前端（本地 npm run dev，proxy 指向 localhost:8000）
cd "$PROJECT_DIR/frontend"
if [ ! -d "node_modules" ]; then
  echo "📦 安装前端依赖..."
  npm install
fi

echo ""
echo "✅ 开发环境启动完毕！"
echo "   前端：http://localhost:5173"
echo "   后端：http://localhost:8000/api/docs"
echo "   账号：admin / admin123"
echo ""

VITE_API_TARGET=http://localhost:8000 npm run dev
