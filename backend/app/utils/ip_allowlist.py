"""IP 白名单：解析配置文本、提取客户端 IP、判断是否放行。"""
from __future__ import annotations

import ipaddress
import logging

from starlette.requests import Request

logger = logging.getLogger(__name__)


def normalize_client_ip_string(ip: str) -> str:
    """把 ::ffff:x.x.x.x 规范为 IPv4 字符串，便于与 IPv4 CIDR 白名单匹配。"""
    ip = (ip or "").strip()
    if not ip:
        return ""
    if "%" in ip:
        ip = ip.split("%", 1)[0]
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return ip
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        return str(addr.ipv4_mapped)
    return ip


def parse_allowlist_entries(raw: str) -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    """将多行/逗号分隔的配置解析为 network 列表；忽略空行与 # 注释。"""
    nets: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for line in raw.replace(",", "\n").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            nets.append(ipaddress.ip_network(line, strict=False))
        except ValueError:
            logger.warning("忽略无法解析的 IP/CIDR 项: %s", line[:64])
    return nets


def client_in_allowlist(
    ip: str,
    nets: list[ipaddress.IPv4Network | ipaddress.IPv6Network],
    *,
    allow_loopback: bool = True,
) -> bool:
    if not nets:
        return True
    ip = normalize_client_ip_string(ip)
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    if allow_loopback and addr.is_loopback:
        return True
    return any(addr in net for net in nets)


def get_client_ip(request: Request, *, trust_x_forwarded_for: bool) -> str:
    if trust_x_forwarded_for:
        x_real = (request.headers.get("x-real-ip") or "").strip()
        if x_real:
            return normalize_client_ip_string(x_real)
        xff = request.headers.get("x-forwarded-for")
        if xff:
            first = xff.split(",")[0].strip()
            if first:
                if first.startswith('"') and first.endswith('"'):
                    first = first[1:-1]
                return normalize_client_ip_string(first)
    if request.client:
        return normalize_client_ip_string(request.client.host or "")
    return ""
