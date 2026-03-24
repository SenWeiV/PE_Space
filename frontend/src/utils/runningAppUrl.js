/**
 * 运行中的应用实际监听在 Docker 映射的 host_port 上，路径为 /apps/{slug}/。
 * 直接访问容器端口，用户信息通过 URL 参数 pe_user 传递。
 */

/** Streamlit 在启用 baseUrlPath 时，路径无末尾 / 时易白屏（静态资源、重定向异常） */
function ensureStreamlitPathTrailingSlash(path) {
  if (!path || typeof path !== "string") return path;
  const q = path.indexOf("?");
  const base = q === -1 ? path : path.slice(0, q);
  const qs = q === -1 ? "" : path.slice(q);
  if (!base.endsWith("/")) return `${base}/${qs}`;
  return path;
}

export function runningAppOrigin(app) {
  if (typeof window === "undefined" || !app?.host_port) return "";
  return `${window.location.protocol}//${window.location.hostname}:${app.host_port}`;
}

/** 带 pe_user 的完整访问链接（必须含 host:port；禁止回退为同源 /apps/slug，否则会误进 Vue 路由） */
export function buildRunningAppUrl(app, username) {
  if (!app?.access_url) return "";
  const origin = runningAppOrigin(app);
  const path = ensureStreamlitPathTrailingSlash(app.access_url);
  const sep = path.includes("?") ? "&" : "?";
  const q = `pe_user=${encodeURIComponent(username || "")}`;
  if (!origin) return "";
  return `${origin}${path}${sep}${q}`;
}

/** 展示用：不含 query */
export function runningAppDisplayUrl(app) {
  if (!app?.access_url) return "";
  const o = runningAppOrigin(app);
  const path = ensureStreamlitPathTrailingSlash(app.access_url);
  return o ? `${o}${path}` : "";
}
