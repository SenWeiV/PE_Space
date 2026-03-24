-- 扩展 app_extra 表，支持代理访问记录和文件下载记录
-- 执行前请备份数据库

-- 修改 file_path 字段长度并允许为空
ALTER TABLE app_extra
  MODIFY COLUMN file_path VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL;

-- 新增请求信息字段
ALTER TABLE app_extra
  ADD COLUMN request_path VARCHAR(512) NULL COMMENT '请求路径',
  ADD COLUMN request_method VARCHAR(10) NULL COMMENT '请求方法 GET/POST/WS',
  ADD COLUMN client_ip VARCHAR(45) NULL COMMENT '客户端 IP',
  ADD COLUMN response_status INT NULL COMMENT 'HTTP 响应状态码';

-- 新增文件信息字段
ALTER TABLE app_extra
  ADD COLUMN file_size INT NULL COMMENT '文件大小（字节）',
  ADD COLUMN file_original_name VARCHAR(255) NULL COMMENT '原始文件名';

-- 添加索引优化查询
CREATE INDEX idx_app_extra_timestamp ON app_extra(timestamp DESC);
CREATE INDEX idx_app_extra_app_user ON app_extra(app_id, username);
CREATE INDEX idx_app_extra_username ON app_extra(username);
