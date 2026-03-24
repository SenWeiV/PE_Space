"""Docker 容器运行时服务。"""
from __future__ import annotations

import re
import shutil
import socket
from functools import lru_cache
from pathlib import Path

import docker

from app.config import settings
from app.services.auth import generate_bridge_secret
from app.utils.upload_paths import app_upload_base_from_code_path

_DOCKERFILE_TEMPLATE_FILE = Path(__file__).with_name("Dockerfile.platform.template")


@lru_cache(maxsize=1)
def _load_dockerfile_template() -> str:
    """读取平台 Dockerfile 模板（与 docker.py 同目录的 Dockerfile.platform.template）。"""
    return _DOCKERFILE_TEMPLATE_FILE.read_text(encoding="utf-8")


def _sanitize_docker_repo_component(raw: str, fallback: str) -> str:
    """将用户名、应用名等转为 Docker 仓库名允许的字符（小写字母、数字、.-_）。"""
    s = (raw or "").strip().lower()
    s = re.sub(r"[^a-z0-9._-]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-_.")
    if not s:
        s = fallback
    # 单段不宜过长，避免超出引擎限制
    return s[:128] if len(s) > 128 else s


def _app_container_name(username: str, app_name: str, app_id: int) -> str:
    """容器名：规范化后的「用户名-应用名」（总长 ≤128，与 DB container_name 字段一致）。"""
    u = _sanitize_docker_repo_component(username, f"user{app_id}")
    n = _sanitize_docker_repo_component(app_name, f"app{app_id}")
    name = f"{u}-{n}"
    if len(name) > 128:
        name = name[:128].rstrip("-_.")
    return name or f"app-{app_id}"


def app_image_tag(username: str, app_name: str, slug: str, app_id: int) -> str:
    """镜像全名：规范化后的「用户名/应用名」作为仓库名，tag 为 slug（slug 全局唯一）。"""
    u = _sanitize_docker_repo_component(username, f"user{app_id}")
    n = _sanitize_docker_repo_component(app_name, slug)
    return f"{u}/{n}:{slug}"


def _legacy_app_image_tag_hyphen(username: str, app_name: str, slug: str, app_id: int) -> str:
    """历史格式「用户名-应用名:slug」，删除时一并尝试，避免旧规则构建的镜像残留。"""
    u = _sanitize_docker_repo_component(username, f"user{app_id}")
    n = _sanitize_docker_repo_component(app_name, slug)
    return f"{u}-{n}:{slug}"


def _docker_unavailable_message(exc: BaseException) -> str:
    """把 docker SDK 的底层异常转成可读的说明（常见：本机未启动 Docker Desktop）。"""
    err = exc
    visited: set[int] = set()
    while err is not None and id(err) not in visited:
        visited.add(id(err))
        if isinstance(err, FileNotFoundError):
            return (
                "Docker 不可用：未找到 Docker 套接字，通常表示本机未启动 Docker 或守护进程未就绪。"
                " macOS/Windows 请先打开 Docker Desktop，等状态变为 Running 后再部署。"
            )
        err = err.__cause__ or err.__context__  # type: ignore[assignment]
    text = str(exc)
    if "No such file or directory" in text or "Connection refused" in text:
        return (
            "Docker 不可用：无法连接 Docker 守护进程。请确认本机已安装 Docker，并已启动 Docker Desktop（或 Linux 上的 dockerd），然后再试。"
        )
    return f"Docker 服务不可用，请确保 Docker 正在运行。详情: {exc}"


class DockerService:
    def __init__(self) -> None:
        self._client = None
        self._docker_available = False

    def _ensure_client(self):
        """延迟初始化 Docker 客户端"""
        if self._client is None:
            try:
                self._client = docker.from_env()
                self._client.ping()  # 测试连接
                self._docker_available = True
            except Exception as e:
                self._client = None
                self._docker_available = False
                raise RuntimeError(_docker_unavailable_message(e)) from e

    def _check_docker_available(self):
        """检查 Docker 是否可用"""
        if not self._docker_available:
            raise RuntimeError("Docker 服务不可用，请确保 Docker 正在运行")

    def build_and_run(
        self, app_id: int, slug: str, build_path: str, owner_username: str, app_name: str
    ) -> dict:
        self._ensure_client()
        image_tag = app_image_tag(owner_username, app_name, slug, app_id)
        container_name = _app_container_name(owner_username, app_name, app_id)
        legacy_container_name = f"app_{app_id}_{slug}"
        bp = Path(build_path)

        # 生成 Dockerfile
        bp.joinpath("Dockerfile").write_text(_load_dockerfile_template().format(slug=slug))

        # 可选：注入平台文件（pe_bridge.py, pe_utils.py, app_wrapper.py 等）
        injected_dir = Path(__file__).parent / "injected"
        for fname in ("pe_entry.py", "pe_utils.py", "pe_bridge.py", "app_wrapper.py"):
            src = injected_dir / fname
            if src.exists():
                (bp / fname).write_text(src.read_text(encoding="utf-8"), encoding="utf-8")

        # 构建镜像
        build_logs = []
        try:
            _, log_iter = self._client.images.build(
                path=build_path, tag=image_tag, rm=True, forcerm=True,
            )
            for chunk in log_iter:
                if "stream" in chunk:
                    build_logs.append(chunk["stream"])
                if "error" in chunk:
                    build_logs.append(f"ERROR: {chunk['error']}\n")
        except docker.errors.BuildError as e:
            for line in e.build_log:
                if "stream" in line:
                    build_logs.append(line["stream"])
                if "error" in line:
                    build_logs.append(f"ERROR: {line['error']}\n")
            raise RuntimeError("".join(build_logs)) from e

        host_port = self._find_free_port()

        # 移除旧容器（当前命名 + 历史 app_{id}_{slug}）
        for cn in (container_name, legacy_container_name):
            try:
                old = self._client.containers.get(cn)
                old.stop()
                old.remove()
            except docker.errors.NotFound:
                pass

        # 运行产出统一挂载到 host_down_dir/{解压根名}/，对应容器内 /app/data
        base_host = app_upload_base_from_code_path(Path(settings.host_upload_dir), build_path, app_id)
        data_dir_host = Path(settings.host_down_dir) / base_host.name
        data_dir_host.parent.mkdir(parents=True, exist_ok=True)

        legacy_data = base_host / "data"
        if legacy_data.is_dir():
            if not data_dir_host.exists():
                shutil.move(str(legacy_data), str(data_dir_host))
            elif data_dir_host.is_dir() and not any(data_dir_host.iterdir()):
                shutil.rmtree(data_dir_host)
                shutil.move(str(legacy_data), str(data_dir_host))

        data_dir_api = Path(settings.down_dir) / base_host.name
        data_dir_api.mkdir(parents=True, exist_ok=True)

        # 生成 Bridge 密钥
        bridge_secret = generate_bridge_secret(app_id)

        container = self._client.containers.run(
            image=image_tag, name=container_name, detach=True,
            ports={"8501/tcp": host_port},
            volumes={str(data_dir_host): {"bind": "/app/data", "mode": "rw"}},
            environment={
                "HOST_IP": settings.host_ip,
                "PE_APP_ID": str(app_id),
                "PE_API_BASE": f"http://{settings.host_ip}:8000/api/app-data",
                "PE_BRIDGE_SECRET": bridge_secret,
                "PE_WATCH_DIR": "/app/data/outputs",
            },
            labels={"tool-platform.app_id": str(app_id), "tool-platform.slug": slug},
            restart_policy={"Name": "unless-stopped"},
        )

        return {
            "container_id": container.id,
            "container_name": container_name,
            "host_port": host_port,
            "build_log": "".join(build_logs),
        }

    def stop(self, container_name: str) -> None:
        self._ensure_client()
        try:
            self._client.containers.get(container_name).stop()
        except docker.errors.NotFound:
            pass

    def restart(self, container_name: str) -> None:
        self._ensure_client()
        try:
            self._client.containers.get(container_name).restart()
        except docker.errors.NotFound:
            raise RuntimeError(f"容器 {container_name} 不存在，请重新部署")

    def remove(self, container_name: str) -> None:
        # 与 remove_image 一致：尚未成功连过 Docker 时先尝试连接；不可用则跳过（避免删除应用 500）
        try:
            self._ensure_client()
        except RuntimeError:
            return
        try:
            c = self._client.containers.get(container_name)
            c.stop()
            c.remove()
        except docker.errors.NotFound:
            pass

    def remove_image(self, app_id: int, slug: str, owner_username: str, app_name: str) -> None:
        """删除该平台为该应用构建的镜像（当前命名规则 + 历史连字符格式）。Docker 不可用或镜像不存在时静默跳过。"""
        try:
            self._ensure_client()
        except RuntimeError:
            return
        for tag in (
            app_image_tag(owner_username, app_name, slug, app_id),
            _legacy_app_image_tag_hyphen(owner_username, app_name, slug, app_id),
        ):
            try:
                self._client.images.remove(tag, force=True)
            except docker.errors.ImageNotFound:
                pass
            except docker.errors.APIError:
                pass

    def _find_free_port(self) -> int:
        self._check_docker_available()
        used_ports: set[int] = set()
        for container in self._client.containers.list():
            for port_bindings in container.ports.values():
                if port_bindings:
                    for binding in port_bindings:
                        try:
                            used_ports.add(int(binding["HostPort"]))
                        except (KeyError, ValueError):
                            pass

        for port in range(settings.port_range_start, settings.port_range_end):
            if port not in used_ports:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    if s.connect_ex(("localhost", port)) != 0:
                        return port
        raise RuntimeError("端口池已耗尽，无可用端口")
