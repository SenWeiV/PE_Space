# 默认官方 Hub；国内可在 compose/.env 设 DOCKER_PYTHON_IMAGE=docker.m.daocloud.io/library/python:3.11-slim
ARG PYTHON_IMAGE=python:3.11-slim
FROM ${PYTHON_IMAGE}

WORKDIR /app

ENV PYTHONPATH=/app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Prepare persistent data directories.
# - /data/uploads/apps: uploaded app packages
# - /data/down: runtime outputs/history/results
# - /data/downloads: unified download file storage (proxy intercepted)
# - /data/traefik-dynamic: dynamic router config
# - /data/skills: skills marketplace extracted files
RUN mkdir -p /data/uploads/apps /data/down /data/downloads /data/traefik-dynamic /data/skills \
    && mkdir -p /app/data \
    && rm -rf /app/data/skills \
    && ln -s /data/skills /app/data/skills

VOLUME ["/data/uploads/apps", "/data/down", "/data/downloads", "/data/traefik-dynamic", "/data/skills"]

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
