from pathlib import Path

from app.config import settings


def write_route(app_id: int, slug: str, host_port: int) -> None:
    """在 Traefik 动态配置目录写入路由文件，Traefik 会自动热加载"""
    config = f"""\
http:
  routers:
    app-{app_id}:
      rule: "PathPrefix(`/apps/{slug}`)"
      service: app-{app_id}-svc
      priority: 5

  services:
    app-{app_id}-svc:
      loadBalancer:
        servers:
          - url: "http://{settings.host_ip}:{host_port}"
"""
    route_file = Path(settings.traefik_dynamic_dir) / f"app_{app_id}.yml"
    route_file.write_text(config)


def remove_route(app_id: int) -> None:
    """删除路由文件，Traefik 立即停止代理该路径"""
    route_file = Path(settings.traefik_dynamic_dir) / f"app_{app_id}.yml"
    if route_file.exists():
        route_file.unlink()
