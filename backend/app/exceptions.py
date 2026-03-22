from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


# ── 业务异常 ──────────────────────────────────────────


class AppNotFound(Exception):
    def __init__(self, app_id: int = 0, slug: str = ""):
        super().__init__(f"App 不存在: id={app_id} slug={slug}")


class SlugTaken(Exception):
    def __init__(self, slug: str):
        super().__init__(f"slug '{slug}' 已被占用")


class UserNotFound(Exception):
    def __init__(self, user_id: int = 0, username: str = ""):
        super().__init__(f"用户不存在: id={user_id} username={username}")


class UsernameExists(Exception):
    def __init__(self, username: str):
        super().__init__(f"用户名 {username} 已存在")


class Forbidden(Exception):
    def __init__(self, detail: str = "无权限操作"):
        super().__init__(detail)


class AccountDisabled(Exception):
    def __init__(self):
        super().__init__("账号已被禁用")


class InvalidPassword(Exception):
    def __init__(self, detail: str = "用户名或密码错误"):
        super().__init__(detail)


class AppBuildInProgress(Exception):
    def __init__(self):
        super().__init__("正在构建中，请等待")


class NoUploadedCode(Exception):
    def __init__(self):
        super().__init__("请先上传代码文件")


class NoContainer(Exception):
    def __init__(self):
        super().__init__("容器不存在，请重新部署")


class PromptNotFound(Exception):
    def __init__(self, prompt_id: int):
        super().__init__(f"Prompt 不存在: id={prompt_id}")


class InvalidFile(Exception):
    def __init__(self, detail: str):
        super().__init__(detail)


class CannotDeleteSelf(Exception):
    def __init__(self):
        super().__init__("不能删除自己的账号")


# ── 异常 → HTTP 状态码映射 ────────────────────────────

_STATUS_MAP: dict[type, int] = {
    AppNotFound: 404,
    UserNotFound: 404,
    PromptNotFound: 404,
    SlugTaken: 400,
    UsernameExists: 400,
    InvalidFile: 400,
    InvalidPassword: 400,
    AppBuildInProgress: 400,
    NoUploadedCode: 400,
    NoContainer: 400,
    CannotDeleteSelf: 400,
    AccountDisabled: 403,
    Forbidden: 403,
}


def setup_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def _handler(request: Request, exc: Exception):
        status_code = _STATUS_MAP.get(type(exc))
        if status_code is not None:
            return JSONResponse(status_code=status_code, content={"detail": str(exc)})
        raise exc
