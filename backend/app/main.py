from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, apps, auth, prompts

app = FastAPI(title="Tool Platform API", version="1.0.0")

# CORS：允许前端开发服务器访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(apps.router)
app.include_router(prompts.router)
app.include_router(admin.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
