"""Application FastAPI : l'API et l'interface compilée (soft_res/static)."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from .api import router
from .config import PACKAGE
from .db import init_db
from .privacy import vault

STATIC = PACKAGE / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Soft - Res", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json"
    )
    app.include_router(router)

    @app.middleware("http")
    async def keep_names_unlocked(request: Request, call_next):
        # Toute activité dans l'interface repousse le verrouillage automatique des noms réels.
        if request.url.path.startswith("/api/"):
            vault.touch()
        return await call_next(request)

    if (STATIC / "assets").exists():
        app.mount("/assets", StaticFiles(directory=STATIC / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        f = STATIC / path
        if path and f.is_file() and STATIC in f.resolve().parents:
            return FileResponse(f)
        index = STATIC / "index.html"
        if index.exists():
            return FileResponse(index)
        return HTMLResponse(
            "<h1>Interface non compilée</h1><p>Lancer <code>npm run build</code> dans "
            "<code>frontend</code>.</p>",
            status_code=503,
        )

    return app


app = create_app()
