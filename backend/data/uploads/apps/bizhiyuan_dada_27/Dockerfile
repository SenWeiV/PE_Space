# 平台生成应用镜像时使用的 Dockerfile 模板（由 docker.py 读取并写入各应用构建目录）。
# 占位符：adadad 会替换为应用的 URL 路径名。

FROM iregistry.baidu-int.com/baidu-base/python:3.11
WORKDIR /app
ENV PYTHONPATH=/app

RUN python -m ensurepip --upgrade 2>/dev/null || true && python -m pip install --upgrade pip

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mv /app/app.py /app/app_original.py

EXPOSE 8501
# 与上方 RUN mv 一致：用户入口已更名为 app_original.py（不再依赖仓库外的 pe_entry 注入）
CMD ["streamlit", "run", "app_original.py", \
     "--server.port=8501", \
     "--server.address=0.0.0.0", \
     "--server.headless=true", \
     "--server.baseUrlPath=/apps/adadad", \
     "--server.enableXsrfProtection=false", \
     "--browser.gatherUsageStats=false"]
