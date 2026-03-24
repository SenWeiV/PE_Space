# 平台生成应用镜像时使用的 Dockerfile 模板（由 docker.py 读取并写入各应用构建目录）。
# 占位符：ssssssss 会替换为应用的 URL 路径名。

FROM iregistry.baidu-int.com/baidu-base/python:3.11
WORKDIR /app
ENV PYTHONPATH=/app

RUN python -m ensurepip --upgrade 2>/dev/null || true && python -m pip install --upgrade pip

# 安装 Bridge 依赖
RUN pip install --no-cache-dir watchdog requests

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 重命名用户入口，使用平台包装器作为新入口
RUN mv /app/app.py /app/app_original.py

# 创建输出目录
RUN mkdir -p /app/data/outputs /app/data/history

EXPOSE 8501

# 启动脚本：同时运行 Bridge 和 Streamlit
# Bridge 在后台监听文件变化，Streamlit 运行包装器（自动初始化用户后加载原始应用）
CMD ["sh", "-c", "python /app/pe_bridge.py & exec streamlit run app_wrapper.py \
     --server.port=8501 \
     --server.address=0.0.0.0 \
     --server.headless=true \
     --server.baseUrlPath=/apps/ssssssss \
     --server.enableXsrfProtection=false \
     --browser.gatherUsageStats=false"]
