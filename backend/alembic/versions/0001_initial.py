"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-02-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("email", sa.String(128), nullable=True, unique=True),
        sa.Column("hashed_pw", sa.String(256), nullable=False),
        sa.Column("role", sa.String(16), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "apps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("container_id", sa.String(128), nullable=True),
        sa.Column("container_name", sa.String(128), nullable=True),
        sa.Column("host_port", sa.Integer(), nullable=True),
        sa.Column("upload_path", sa.String(512), nullable=True),
        sa.Column("build_log", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_apps_slug", "apps", ["slug"])
    op.create_index("ix_apps_owner_id", "apps", ["owner_id"])

    op.create_table(
        "prompts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(128), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", sa.String(64), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # 插入默认管理员账号（密码: admin123）
    op.execute(
        """
        INSERT INTO users (username, hashed_pw, role, is_active)
        VALUES ('admin', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'admin', true)
        """
    )


def downgrade() -> None:
    op.drop_table("prompts")
    op.drop_table("apps")
    op.drop_table("users")
