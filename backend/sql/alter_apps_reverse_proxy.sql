-- 反向代理拼接字段（与 app_{id}.yml 一致，便于 SELECT 查询）
-- 在 backend 目录所在数据库执行一次即可

ALTER TABLE apps
  ADD COLUMN reverse_proxy_path_prefix VARCHAR(128) NULL COMMENT 'Traefik PathPrefix，如 /apps/my-slug' AFTER host_port;

ALTER TABLE apps
  ADD COLUMN reverse_proxy_backend_url VARCHAR(512) NULL COMMENT '上游 URL，如 http://10.0.0.1:8601' AFTER reverse_proxy_path_prefix;

ALTER TABLE apps
  ADD COLUMN reverse_proxy_middlewares VARCHAR(256) NULL COMMENT '中间件，逗号分隔，如 pe-auth' AFTER reverse_proxy_backend_url;
