#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 启动本地开发环境..."

# 1. 启动 postgres + backend
cd "$PROJECT_DIR"
docker compose -f docker-compose.dev.yml up -d --build

echo "⏳ 等待后端就绪..."
for i in $(seq 1 30); do
  if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✅ 后端已就绪"
    break
  fi
  sleep 1
done

# 2. 启动前端
cd "$PROJECT_DIR/frontend"
if [ ! -d "node_modules" ]; then
  echo "📦 安装前端依赖..."
  npm install
fi

echo ""
echo "✅ 开发环境启动完毕！"
echo "   前端：http://localhost:5173"
echo "   后端：http://localhost:8000"
echo "   默认账号：admin / admin123"
echo ""

npm run dev
