import socket
from pathlib import Path

import docker

from app.config import settings

client = docker.from_env()

STANDARD_DOCKERFILE_TEMPLATE = """\
FROM iregistry.baidu-int.com/baidu-base/python:3.11
WORKDIR /app
ENV PYTHONPATH=/app

# 安装 pip 并升级
RUN python -m ensurepip --upgrade 2>/dev/null || true && python -m pip install --upgrade pip

# 安装应用依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制用户应用代码
COPY . .

# 注入平台文件（放在 COPY . . 之后，确保不被用户文件覆盖）
# pe_entry.py: 访问追踪 + 后台守护线程（自动为 results/ 下的新文件补写 metadata）
# pe_utils.py: 平台工具库（save_result / _write_meta 等标准接口）
COPY pe_entry.py /app/pe_entry.py
COPY pe_utils.py /app/pe_utils.py

# 将用户的 app.py 重命名，由追踪入口代理执行
RUN mv /app/app.py /app/app_original.py

EXPOSE 8501
CMD ["streamlit", "run", "pe_entry.py", \
     "--server.port=8501", \
     "--server.address=0.0.0.0", \
     "--server.headless=true", \
     "--server.baseUrlPath=/apps/{slug}", \
     "--browser.gatherUsageStats=false"]
"""


def find_free_port() -> int:
    # 查询所有容器已占用的宿主机端口
    used_ports: set[int] = set()
    for container in client.containers.list():
        for port_bindings in container.ports.values():
            if port_bindings:
                for binding in port_bindings:
                    try:
                        used_ports.add(int(binding["HostPort"]))
                    except (KeyError, ValueError):
                        pass

    for port in range(settings.port_range_start, settings.port_range_end):
        if port not in used_ports:
            # 双重检查：socket 层面也确认端口未被占用
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex(("localhost", port)) != 0:
                    return port
    raise RuntimeError("端口池已耗尽，无可用端口")


def inject_dockerfile(build_path: str, slug: str) -> None:
    """在构建目录写入平台标准 Dockerfile + pe_entry.py + pe_utils.py"""
    bp = Path(build_path)
    bp.joinpath("Dockerfile").write_text(
        STANDARD_DOCKERFILE_TEMPLATE.format(slug=slug)
    )
    # 注入平台入口和工具库（源文件与本模块同目录）
    src_dir = Path(__file__).parent
    for fname in ("pe_entry.py", "pe_utils.py"):
        src = src_dir / fname
        dst = bp / fname
        dst.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")


def build_and_run(app_id: int, slug: str, build_path: str) -> dict:
    image_tag = f"tool-platform/app-{app_id}:{slug}"
    container_name = f"app_{app_id}_{slug}"

    # 注入标准 Dockerfile
    inject_dockerfile(build_path, slug)

    # 构建镜像，收集日志（包含 error 和 stream）
    build_logs = []
    try:
        _, log_iter = client.images.build(
            path=build_path,
            tag=image_tag,
            rm=True,
            forcerm=True,
        )
        for chunk in log_iter:
            if "stream" in chunk:
                build_logs.append(chunk["stream"])
            if "error" in chunk:
                build_logs.append(f"ERROR: {chunk['error']}\n")
    except docker.errors.BuildError as e:
        # 捕获构建失败，收集所有日志行后重新抛出
        for line in e.build_log:
            if "stream" in line:
                build_logs.append(line["stream"])
            if "error" in line:
                build_logs.append(f"ERROR: {line['error']}\n")
        raise RuntimeError("".join(build_logs)) from e

    # 分配端口
    host_port = find_free_port()

    # 停止并删除同名容器（重新部署时）
    try:
        old = client.containers.get(container_name)
        old.stop()
        old.remove()
    except docker.errors.NotFound:
        pass

    # 准备持久化数据目录（宿主机路径），App 内通过 /app/data 读写
    data_dir_host = Path(settings.host_upload_dir) / str(app_id) / "data"
    data_dir_container = Path(settings.upload_dir) / str(app_id) / "data"
    data_dir_container.mkdir(parents=True, exist_ok=True)

    # 启动容器
    container = client.containers.run(
        image=image_tag,
        name=container_name,
        detach=True,
        ports={"8501/tcp": host_port},
        volumes={str(data_dir_host): {"bind": "/app/data", "mode": "rw"}},
        environment={
            "HOST_IP": settings.host_ip,
            "PE_APP_ID": str(app_id),
        },
        labels={
            "tool-platform.app_id": str(app_id),
            "tool-platform.slug": slug,
        },
        restart_policy={"Name": "unless-stopped"},
    )

    return {
        "container_id": container.id,
        "container_name": container_name,
        "host_port": host_port,
        "build_log": "".join(build_logs),
    }


def stop_container(container_name: str) -> None:
    try:
        container = client.containers.get(container_name)
        container.stop()
    except docker.errors.NotFound:
        pass


def remove_container(container_name: str) -> None:
    try:
        container = client.containers.get(container_name)
        container.stop()
        container.remove()
    except docker.errors.NotFound:
        pass


def restart_container(container_name: str) -> None:
    try:
        container = client.containers.get(container_name)
        container.restart()
    except docker.errors.NotFound:
        raise RuntimeError(f"容器 {container_name} 不存在，请重新部署")
