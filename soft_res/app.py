"""Application FastAPI : l'API et l'interface compilée (soft_res/static)."""

import base64
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

from .api import router
from .config import PACKAGE, settings
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

    password = settings().softres_demo_password

    @app.middleware("http")
    async def demo_password(request: Request, call_next):
        # Version en ligne : le navigateur demande un mot de passe (nom d'utilisateur libre).
        if password and not _password_ok(request.headers.get("authorization", ""), password):
            return Response(
                "Mot de passe requis",
                status_code=401,
                headers={"WWW-Authenticate": 'Basic realm="Soft - Res"'},
            )
        return await call_next(request)

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


def _password_ok(header: str, password: str) -> bool:
    scheme, _, value = header.partition(" ")
    if scheme.lower() != "basic":
        return False
    try:
        _, _, given = base64.b64decode(value).decode().partition(":")
    except ValueError:
        return False
    return secrets.compare_digest(given.encode(), password.encode())


app = create_app()
