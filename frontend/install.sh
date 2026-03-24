#!/usr/bin/env bash
# OpenClaw + Codex + PE Space 团队一键安装（全部在 Docker 容器内）
# 用法:
#   ./install.sh
#   curl -fsSL http://YOUR_PLATFORM_HOST:8000/install.sh | bash
# 远程执行前需在 SETUP_BASE 上托管 docker/pe-space/* 三个文件，或设置 PE_SPACE_DOCKER_DIR 指向已解压目录。

set -euo pipefail

RESET="\033[0m"; BOLD="\033[1m"; GREEN="\033[32m"; YELLOW="\033[33m"; DIM="\033[2m"
ok()   { printf "  ${GREEN}✓${RESET} %s\n" "$*"; }
log()  { printf "  ${DIM}·${RESET} %s\n" "$*"; }
warn() { printf "  ${YELLOW}⚠${RESET}  %s\n" "$*"; }

SETUP_BASE="${SETUP_BASE:-http://YOUR_PLATFORM_HOST:8000}"
# pe login / 浏览器访问的平台根地址（与静态资源 SETUP_BASE 可不同）
PE_PLATFORM_URL="${PE_PLATFORM_URL:-http://YOUR_PLATFORM_HOST}"

printf "\n  ${BOLD}PE Space 团队环境安装（Docker）${RESET}\n\n"

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  printf "  ${YELLOW}⚠${RESET} 未检测到 docker，请先安装 Docker Desktop 或 docker.io。\n" >&2
  exit 1
fi
if ! docker info &>/dev/null; then
  printf "  ${YELLOW}⚠${RESET} Docker 未运行，请启动后再执行本脚本。\n" >&2
  exit 1
fi
ok "Docker 可用"

dc() {
  if docker compose version &>/dev/null; then
    (cd "$PE_DOCKER" && docker compose "$@")
  else
    (cd "$PE_DOCKER" && docker-compose "$@")
  fi
}

# ── 定位 docker/pe-space 目录 ────────────────────────────────────────────────
_install_src="${BASH_SOURCE[0]:-}"
SCRIPT_DIR=""
if [[ -n "$_install_src" && "$_install_src" != bash && "$_install_src" != */bash && -f "$_install_src" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$_install_src")" && pwd)"
fi

if [[ -n "${PE_SPACE_DOCKER_DIR:-}" ]]; then
  PE_DOCKER="$(cd "$PE_SPACE_DOCKER_DIR" && pwd)"
elif [[ -n "$SCRIPT_DIR" ]]; then
  _cur="$SCRIPT_DIR"
  PE_DOCKER=""
  while [[ -n "$_cur" && "$_cur" != "/" ]]; do
    if [[ -f "$_cur/docker/pe-space/docker-compose.yml" ]]; then
      PE_DOCKER="$_cur/docker/pe-space"
      break
    fi
    _cur="$(dirname "$_cur")"
  done
  if [[ -z "$PE_DOCKER" ]]; then
    PE_DOCKER="${HOME}/.pe-space-docker/bundle"
    mkdir -p "$PE_DOCKER"
  fi
else
  PE_DOCKER="${HOME}/.pe-space-docker/bundle"
  mkdir -p "$PE_DOCKER"
fi

ensure_bundle_from_server() {
  if [[ -f "$PE_DOCKER/docker-compose.yml" ]]; then
    return 0
  fi
  log "本地未找到 docker-compose.yml，尝试从 SETUP_BASE 拉取 ..."
  curl -fsSL "${SETUP_BASE}/docker/pe-space/docker-compose.yml" -o "$PE_DOCKER/docker-compose.yml"
  curl -fsSL "${SETUP_BASE}/docker/pe-space/Dockerfile" -o "$PE_DOCKER/Dockerfile"
  curl -fsSL "${SETUP_BASE}/docker/pe-space/docker-entrypoint.sh" -o "$PE_DOCKER/docker-entrypoint.sh"
  chmod +x "$PE_DOCKER/docker-entrypoint.sh"
}

if ! ensure_bundle_from_server; then
  printf "  ${YELLOW}⚠${RESET} 无法获取 Docker 配置。请克隆本仓库后执行 ./install.sh，或设置 PE_SPACE_DOCKER_DIR。\n" >&2
  exit 1
fi

# compose 读取同目录 .env
printf 'SETUP_BASE=%s\n' "$SETUP_BASE" >"$PE_DOCKER/.env"

# ── 构建并启动容器（内：Node / Codex / OpenClaw / Gateway / pe）──────────────
log "构建并启动 pe-space-tools 容器 ..."
dc build --pull
dc up -d
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if docker inspect -f '{{.State.Running}}' pe-space-tools 2>/dev/null | grep -q true; then
    ok "容器 pe-space-tools 已运行"; break
  fi
  [[ $i -eq 10 ]] && warn "容器未在预期时间内 Running，请执行: cd \"$PE_DOCKER\" && docker compose ps"
done

if dc exec -T pe-space-tools openclaw gateway status 2>/dev/null | grep -q "running"; then
  ok "OpenClaw Gateway 已启动"
else
  warn "Gateway 状态请稍后确认: docker compose -f \"$PE_DOCKER/docker-compose.yml\" exec pe-space-tools openclaw gateway status"
fi

# ── 宿主机包装命令：pe / codex / openclaw ────────────────────────────────────
STATE_DIR="${HOME}/.pe-space-docker"
mkdir -p "$STATE_DIR"
printf "PE_DOCKER=%q\n" "$PE_DOCKER" >"$STATE_DIR/env.sh"

write_wrapper() {
  local name="$1" cmd="$2"
  local bin="${HOME}/.local/bin/${name}"
  mkdir -p "${HOME}/.local/bin"
  # 未加引号的 WRAPPER 仅展开 $cmd，其余 \$ 保留到脚本内
  cat >"$bin" <<WRAPPER
#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=/dev/null
. "\${HOME}/.pe-space-docker/env.sh"
_flags=(-T)
if [[ -t 0 ]] && [[ -t 1 ]]; then _flags=(-it); fi
if docker compose version &>/dev/null; then
  cd "\$PE_DOCKER" && docker compose exec "\${_flags[@]}" pe-space-tools ${cmd} "\$@"
else
  cd "\$PE_DOCKER" && docker-compose exec "\${_flags[@]}" pe-space-tools ${cmd} "\$@"
fi
WRAPPER
  chmod +x "$bin"
}

write_wrapper pe pe
write_wrapper codex codex
write_wrapper openclaw openclaw

if [[ ":$PATH:" != *":${HOME}/.local/bin:"* ]]; then
  export PATH="${HOME}/.local/bin:${PATH}"
  for rc in "${HOME}/.zshrc" "${HOME}/.bashrc" "${HOME}/.bash_profile"; do
    [[ -f "$rc" ]] && grep -q '\.local/bin' "$rc" && continue
    [[ -f "$rc" ]] && echo 'export PATH="$HOME/.local/bin:$PATH"' >>"$rc"
  done
fi
ok "已写入 ~/.local/bin 下的 pe / codex / openclaw（转发到容器）"

# ── PE Space 登录 ─────────────────────────────────────────────────────────────
printf "\n  ${BOLD}登录 PE Space 平台${RESET}  (%s)\n" "$PE_PLATFORM_URL"
printf "  账号格式：姓名全拼，密码：全拼+123\n\n"
dc exec -it pe-space-tools pe login --url "$PE_PLATFORM_URL"

# ── 安装 PE Space Skill ───────────────────────────────────────────────────────
SKILL_DIR_CONTAINER="/root/.openclaw/workspace/skills/pe-space"
dc exec -T pe-space-tools mkdir -p "$SKILL_DIR_CONTAINER"
if dc exec -T pe-space-tools sh -c "curl -fsSL '${SETUP_BASE}/pe-space-skill.md' -o '${SKILL_DIR_CONTAINER}/SKILL.md'"; then
  ok "PE Space Skill 已安装（容器内 ${SKILL_DIR_CONTAINER}）"
else
  warn "未能从 SETUP_BASE 下载 pe-space-skill.md，可稍后手动放入卷 pe-space-openclaw"
fi

# ── 交给 Codex 接管验证 ───────────────────────────────────────────────────────
printf "\n  ${BOLD}脚本完成，启动 AI 助手进行验证 ...${RESET}\n\n"
TMPSETUP=$(mktemp /tmp/openclaw-setup-XXXX.md)
curl -fsSL "${SETUP_BASE}/SETUP.md" -o "$TMPSETUP" 2>/dev/null || true
if [[ ! -s "$TMPSETUP" && -n "$SCRIPT_DIR" ]]; then
  _s="$SCRIPT_DIR"
  while [[ -n "$_s" && "$_s" != "/" ]]; do
    if [[ -f "$_s/SETUP.md" ]]; then cp "$_s/SETUP.md" "$TMPSETUP"; break; fi
    _s="$(dirname "$_s")"
  done
fi

if [[ -f "$TMPSETUP" ]] && [[ -s "$TMPSETUP" ]]; then
  docker cp "$TMPSETUP" pe-space-tools:/tmp/SETUP.md
  dc exec -it pe-space-tools codex "请读取容器内文件 /tmp/SETUP.md 的安装说明并执行验证，中文沟通。"
else
  dc exec -it pe-space-tools codex "环境已在 Docker 容器 pe-space-tools 内安装完成，请验证 codex、openclaw、pe 均正常，有问题自动修复，中文沟通。"
fi
rm -f "$TMPSETUP"
